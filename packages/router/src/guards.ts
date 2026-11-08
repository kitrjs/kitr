import { buildPlatform, KitrError } from '@kitr/core'
import { notFound, redirect } from '@tanstack/react-router'

/** What the guards read from `context.session`: a user when signed in, and an optional permission check. */
export interface GuardSession {
  /** The signed-in user. `requireAuth()` redirects when it is missing or null. */
  user?: unknown | null
  /** Answers `can(permission, { subject })`. Without it, every `can()` check fails. */
  can?: (permission: string, subject?: unknown) => boolean
}

/** Options of `requireAuth()`: where anonymous visitors go and which search param remembers their page. */
export interface RequireAuthOptions {
  /** Where to send anonymous users. Default: `signInPath` from `config/auth.ts`, else `/sign-in`. */
  to?: string
  /** Name of the search param carrying the original URL. Default `redirect`. */
  redirectParam?: string | false
}

type AppWithConfig = { config: { has(key: string): boolean; get(key: string): unknown } }

/** `signInPath` from `config/auth.ts`, when the app in the router context has one. */
function signInPath(app: AppWithConfig | undefined): string | undefined {
  if (!app?.config?.has('auth')) return undefined
  const path = (app.config.get('auth') as { signInPath?: unknown } | undefined)?.signInPath
  return typeof path === 'string' ? path : undefined
}

/**
 * `beforeLoad` guard. Reads `context.session` (set by `@kitr/auth` or your own
 * provider) and redirects anonymous users, remembering where they were going.
 *
 *   export const Route = createFileRoute('/_app')({ beforeLoad: requireAuth() })
 */
export function requireAuth(options: RequireAuthOptions = {}) {
  const { redirectParam = 'redirect' } = options
  return ({
    context,
    location,
  }: {
    context: { session?: GuardSession | null; app?: AppWithConfig }
    location: { href: string }
  }) => {
    const session = context.session
    if (!session?.user) {
      throw redirect({
        to: options.to ?? signInPath(context.app) ?? '/sign-in',
        search: redirectParam ? ({ [redirectParam]: location.href } as any) : undefined,
      })
    }
    return { session }
  }
}

/**
 * `beforeLoad` permission guard: passes when `context.session.can(permission, subject)` is true.
 * Otherwise throws a FORBIDDEN KitrError (403) that the route's error screen renders, or redirects when `to` is given.
 */
export function can(permission: string, options: { subject?: unknown; to?: string } = {}) {
  return ({ context }: { context: { session?: GuardSession | null } }) => {
    const session = context.session
    const allowed = session?.can?.(permission, options.subject) ?? false
    if (!allowed) {
      if (options.to) throw redirect({ to: options.to })
      throw KitrError.forbidden(`Missing permission "${permission}"`)
    }
  }
}

/**
 * Compose several `beforeLoad` guards into one. They run in order and are awaited; the objects
 * they return are merged into the route context, and the first throw stops the rest.
 */
export function guards<Ctx>(...fns: Array<(ctx: Ctx) => unknown | Promise<unknown>>) {
  return async (ctx: Ctx) => {
    let merged: Record<string, unknown> = {}
    for (const fn of fns) {
      const result = await fn(ctx)
      if (result && typeof result === 'object') merged = { ...merged, ...(result as object) }
    }
    return merged
  }
}

/** What `onlyPlatform()` reads: the platform service when `@kitr/platform` is installed, else the build's name and type. */
export interface GuardPlatform {
  name?: string | undefined
  type?: string
  native?: boolean
  os?: string
}

/** Options of `onlyPlatform()`: where other platforms go instead of a 404. */
export interface OnlyPlatformOptions {
  /** Redirect other platforms here instead of rendering not-found. */
  to?: string
}

const platformMatches = (platform: GuardPlatform, keys: string[]) =>
  keys.some(
    (key) =>
      key === platform.name ||
      key === platform.type ||
      key === platform.os ||
      (key === 'native' && platform.native === true),
  )

/**
 * `beforeLoad` guard that limits a route to some platforms: the marketing pages exist on the
 * `www` build only, the account pages on the authed web app and the phone. Keys are platform
 * names from kitrrc.ts, platform types (`web`, `mobile`), OS names or `native`. Other platforms
 * get the route's not-found page, or a redirect with `to`. Reads `context.platform` (the service
 * from `@kitr/platform`, put in context by `createKitrRouter`) and falls back to the build's
 * `KITR_PLATFORM` / `KITR_PLATFORM_TYPE`, so it works with no platform package at all.
 *
 *   export const Route = createFileRoute('/pricing')({ beforeLoad: onlyPlatform('www') })
 */
export function onlyPlatform(platforms: string | string[], options: OnlyPlatformOptions = {}) {
  const keys = Array.isArray(platforms) ? platforms : [platforms]
  return ({ context }: { context: { platform?: GuardPlatform | null } }) => {
    const current: GuardPlatform = context.platform ?? buildPlatform()
    if (platformMatches(current, keys)) return
    if (options.to) throw redirect({ to: options.to })
    throw notFound()
  }
}
