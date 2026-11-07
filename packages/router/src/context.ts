import type { KitrApp } from '@kitr/core'
import type { QueryClient } from '@tanstack/react-query'

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

/** The router context plus your own fields, for typing a route's context without augmenting `KitrRouterContext`. */
export type RouterContextWith<T> = KitrRouterContext & T
