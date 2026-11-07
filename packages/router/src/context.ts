import type { KitrApp } from '@kitr/core'
import type { QueryClient } from '@tanstack/react-query'
import type { GuardPlatform, GuardSession } from './guards'

/**
 * The router context every kitr route sees. Packages extend it by augmentation:
 *
 *   declare module '@kitr/router' { interface KitrRouterContext { session: Session | null } }
 */
export interface KitrRouterContext {
  /** The query client loaders fill with `ensureQueryData`. Per request on the server. */
  queryClient: QueryClient
  /** The kitr app, forked per request on the server. Read services with `context.app.container.use()`. */
  app: KitrApp
}

/**
 * Fields `createKitrRouter` fills from the container when the packages are installed, as live
 * getters: `session` from `@kitr/auth` (what `requireAuth()` and `can()` read) and `platform`
 * from `@kitr/platform` (what `onlyPlatform()` reads). Each package augments `KitrRouterContext`
 * with its own precise type; this is their shape as the guards see it.
 */
export interface KitrRouterBindings {
  session?: GuardSession | null
  platform?: GuardPlatform
}

/** The router context plus your own fields, for typing a route's context without augmenting `KitrRouterContext`. */
export type RouterContextWith<T> = KitrRouterContext & T
