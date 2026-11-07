import { KitrError } from '@kitr/core'
import { redirect } from '@tanstack/react-router'

export interface GuardSession {
  user?: unknown | null
  can?: (permission: string, subject?: unknown) => boolean
}

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
 * `beforeLoad` permission guard. Throws a FORBIDDEN KitrError that the route's
 * errorComponent renders, or redirects when `to` is given.
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

/** Compose several `beforeLoad` guards; each may return context to merge. */
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
