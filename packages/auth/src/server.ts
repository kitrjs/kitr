import { KitrError } from '@kitr/core'
import type { Abilities } from './abilities'

export * from './abilities'

/** The minimal context the auth middleware needs; matches @kitr/api's HttpContext. */
interface AuthContextLike {
  request: { header(name: string): string | null }
  locals: Record<string, unknown>
}
type Next = () => Promise<unknown>

export interface AuthMiddlewareOptions<TUser> {
  /** Turn a bearer token (or cookie value) into a user. Return null when invalid. */
  verify: (token: string, ctx: AuthContextLike) => Promise<TUser | null> | TUser | null
  /** Read from the `Authorization: Bearer` header (default) or a cookie by name. */
  from?: 'bearer' | { cookie: string }
  /** Anonymous requests pass through with `locals.user = null` instead of 401. */
  optional?: boolean
  abilities?: Abilities<TUser, any>
}

/**
 * API middleware: authenticate the request and put `user` on `ctx.locals`.
 * Works with any `@kitr/api` router and any token format.
 *
 *   const auth = authMiddleware({ verify: (token) => jwt.verify(token) })
 *   router.group({ prefix: '/api', middleware: [auth] }, ...)
 */
export function authMiddleware<TUser>(options: AuthMiddlewareOptions<TUser>) {
  const from = options.from ?? 'bearer'
  return async (ctx: AuthContextLike, next: Next) => {
    let token: string | undefined
    if (from === 'bearer') {
      const header = ctx.request.header('authorization')
      token = header?.match(/^Bearer\s+(.+)$/i)?.[1]
    } else {
      const cookies = ctx.request.header('cookie') ?? ''
      const name = from.cookie.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      token = cookies.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1]
      if (token) {
        try {
          token = decodeURIComponent(token)
        } catch {
          // A malformed cookie is an anonymous request, not a server error.
          token = undefined
        }
      }
    }
    const user = token ? await options.verify(token, ctx) : null
    if (!user && !options.optional) throw KitrError.unauthorized()
    ctx.locals.user = user
    ctx.locals.can = (ability: string, subject?: unknown) =>
      options.abilities ? options.abilities.can(user, ability, subject) : !!user
    return next()
  }
}

/** Typed access to the authenticated user set by `authMiddleware`. Throws 401 when missing. */
export function requireUser<TUser>(ctx: { locals: Record<string, unknown> }): TUser {
  const user = ctx.locals.user as TUser | null | undefined
  if (!user) throw KitrError.unauthorized()
  return user
}

export function currentUser<TUser>(ctx: { locals: Record<string, unknown> }): TUser | null {
  return (ctx.locals.user as TUser | null | undefined) ?? null
}

/** Middleware: require an ability. The subject can be resolved from the context (e.g. load the project). */
export function can(ability: string, subject?: (ctx: any) => unknown | Promise<unknown>) {
  return async (ctx: AuthContextLike, next: Next) => {
    const check = ctx.locals.can as ((a: string, s?: unknown) => boolean) | undefined
    const s = subject ? await subject(ctx) : undefined
    if (!check?.(ability, s)) throw KitrError.forbidden(`Missing permission "${ability}"`)
    return next()
  }
}
