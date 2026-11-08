import { AsyncLocalStorage } from 'node:async_hooks'
import { KitrError } from '@kitr/core'
import { tryUseRequest } from '@kitr/server'
import type { Abilities } from './abilities'
import type { CookieSessions } from './cookie-session'
import { setServerSessionResolver } from './session'
import type { SessionRecord } from './store'
import type { AuthUser, UserProvider } from './users'

/** What the request scope and the middleware need: the session service and where the users are. */
export interface SessionAuth<TUser extends AuthUser = AuthUser> {
  /** From `createCookieSession`. */
  sessions: CookieSessions
  /** Your `UserProvider`. */
  users: UserProvider<TUser>
}

/** A request's signed-in user and the session record behind it. */
export interface ResolvedSession<TUser extends AuthUser = AuthUser> {
  user: TUser
  session: SessionRecord
}

/** Where the resolved session lives in `RequestContext.locals` and `HttpContext.locals`. */
export const SESSION_LOCALS_KEY = 'kitr.auth.session'

/**
 * The session of one request: the cookie, the store lookup and the user. A record whose user is
 * gone is revoked and reads as anonymous. Pass `response` to let sliding expiry refresh the cookie.
 */
export async function resolveSession<TUser extends AuthUser>(
  auth: SessionAuth<TUser>,
  request: Request | Headers,
  response?: Headers,
): Promise<ResolvedSession<TUser> | null> {
  const session = await auth.sessions.resolve(request, response)
  if (!session) return null
  const user = await auth.users.findById(session.userId)
  if (!user) {
    await auth.sessions.revoke(session.id)
    return null
  }
  return { user, session }
}

interface Scope {
  auth: SessionAuth<any>
  request: Request
  headers: Headers
  resolved?: Promise<ResolvedSession<any> | null>
}
const scopes = new AsyncLocalStorage<Scope>()

/**
 * The session of the current server request, or `undefined` when no request scope is active.
 * `null` means anonymous. Works in three places: inside `runWithSession` (page rendering), in an
 * API route behind `sessionMiddleware` (it reads the `@kitr/server` request context), and
 * anywhere either of those called.
 */
export async function getRequestSession<TUser extends AuthUser = AuthUser>(): Promise<
  ResolvedSession<TUser> | null | undefined
> {
  const scope = scopes.getStore()
  if (scope) {
    scope.resolved ??= resolveSession(scope.auth, scope.request, scope.headers)
    return scope.resolved
  }
  const fromContext = tryUseRequest()?.locals[SESSION_LOCALS_KEY] as
    | ResolvedSession<TUser>
    | null
    | undefined
  return fromContext
}

/**
 * The signed-in user of the current server request, or `null`. Throws outside a request scope,
 * where "anonymous" would be a guess.
 */
export async function getRequestUser<TUser extends AuthUser = AuthUser>(): Promise<TUser | null> {
  const session = await getRequestSession<TUser>()
  if (session === undefined)
    throw new Error(
      '[kitr/auth] getRequestUser() needs a request: call it inside runWithSession() or behind sessionMiddleware().',
    )
  return session?.user ?? null
}

/**
 * Run server rendering with the request's session available, so `beforeLoad` and loaders that
 * run during SSR see it (`auth.load()` reads it through the adapter). Wrap the page handler in
 * the server entry; it also sends the refreshed cookie when sliding expiry extended the session:
 *
 *   return runWithSession(auth, request, () => handler.fetch(request, options))
 */
export async function runWithSession<T>(
  auth: SessionAuth<any>,
  request: Request,
  fn: () => T | Promise<T>,
): Promise<T> {
  setServerSessionResolver(async () => {
    const found = await getRequestSession()
    if (found === undefined) return undefined
    return found ? { user: found.user, expiresAt: found.session.expiresAt } : null
  })
  const scope: Scope = { auth, request, headers: new Headers() }
  const result = await scopes.run(scope, fn)
  // Sliding expiry may have extended the session during rendering: hand the new cookie to the browser.
  const cookies = scope.headers.getSetCookie()
  if (cookies.length && result instanceof Response) {
    const headers = new Headers(result.headers)
    for (const cookie of cookies) headers.append('set-cookie', cookie)
    return new Response(result.body, {
      status: result.status,
      statusText: result.statusText,
      headers,
    }) as T
  }
  return result
}

/** The slice of an `@kitr/api` `HttpContext` the session middleware uses. */
interface MiddlewareContext {
  request: { headers: Headers }
  event: { res: { headers: Headers } }
  locals: Record<string, unknown>
}

/** Options for `sessionMiddleware`. */
export interface SessionMiddlewareOptions<TUser extends AuthUser> extends SessionAuth<TUser> {
  /** Anonymous requests pass through with `locals.user = null` instead of 401. */
  optional?: boolean
  /** Abilities for `locals.can`, so `can('projects.update')` middleware works. */
  abilities?: Abilities<TUser, any>
}

/**
 * API middleware: resolve the cookie session and put `user` and `can` on `ctx.locals`, the same
 * keys `authMiddleware` sets, so `requireUser(ctx)`, `currentUser(ctx)` and `can()` work behind
 * it. Also records the session in the `@kitr/server` request context for `getRequestSession()`.
 *
 *   router.group({ prefix: '/api', middleware: [sessionMiddleware({ sessions, users })] }, ...)
 */
export function sessionMiddleware<TUser extends AuthUser>(
  options: SessionMiddlewareOptions<TUser>,
) {
  return async (ctx: MiddlewareContext, next: () => Promise<unknown>) => {
    setServerSessionResolver(async () => {
      const found = await getRequestSession()
      if (found === undefined) return undefined
      return found ? { user: found.user, expiresAt: found.session.expiresAt } : null
    })
    const found = await resolveSession(options, ctx.request.headers, ctx.event.res.headers)
    if (!found && !options.optional) throw KitrError.unauthorized()
    const user = found?.user ?? null
    ctx.locals.user = user
    ctx.locals[SESSION_LOCALS_KEY] = found
    ctx.locals.can = (ability: string, subject?: unknown) =>
      options.abilities ? options.abilities.can(user, ability, subject) : !!user
    return next()
  }
}
