import { KitrError } from '@kitr/core'
import { redirect } from '@tanstack/react-router'

/** What the guards read from `context.session`: a user when signed in, and an optional permission check. */
export interface GuardSession {
  /** The signed-in user. `requireAuth()` redirects when it is missing or null. */
  user?: unknown | null
  /** Answers `can(permission, { subject })`. Without it, every `can()` check fails. */
  can?: (permission: string, subject?: unknown) => boolean
}

/** Options of `requireAuth()`: where anonymous visitors go and which search param remembers their page. */
export interface RequireAuthOptions {
  /** Where to send anonymous users. Default `/sign-in`. */
  to?: string
  /** Name of the search param carrying the original URL. Default `redirect`. */
  redirectParam?: string | false
}

/**
 * `beforeLoad` guard. Reads `context.session` (set by `@kitr/auth` or your own
 * provider) and redirects anonymous users, remembering where they were going.
 *
 *   export const Route = createFileRoute('/_app')({ beforeLoad: requireAuth() })
 */
export function requireAuth(options: RequireAuthOptions = {}) {
  const { to = '/sign-in', redirectParam = 'redirect' } = options
  return ({
    context,
    location,
  }: {
    context: { session?: GuardSession | null }
    location: { href: string }
  }) => {
    const session = context.session
    if (!session?.user) {
      throw redirect({
        to,
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
