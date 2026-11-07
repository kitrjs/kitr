import type { KitrApp } from '@kitr/core'
import { KitrProvider } from '@kitr/react'
import type { QueryClient } from '@tanstack/react-query'
import {
  type AnyRoute,
  createRouter,
  type Router,
  type RouterOptions,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { DefaultError, DefaultNotFound, DefaultPending } from './defaults'

export interface CreateKitrRouterOptions<TRouteTree extends AnyRoute>
  extends Omit<RouterOptions<TRouteTree, 'never', false, any, any>, 'context'> {
  app: KitrApp
  /** Defaults to the container's `queryClient` (from @kitr/query). */
  queryClient?: QueryClient
  /** Extra context merged into every route (e.g. `session`). */
  context?: Record<string, unknown>
}

/**
 * `createRouter` with kitr's defaults: queryClient and app in context, intent
 * preload, scroll restoration, default pending/error/not-found components,
 * and the app's providers wrapped around the whole tree.
 *
 * With `@kitr/query` installed, loaders can `context.queryClient.ensureQueryData(...)`.
 */
export function createKitrRouter<TRouteTree extends AnyRoute>(
  options: CreateKitrRouterOptions<TRouteTree>,
): Router<TRouteTree, 'never', true> {
  const { app, queryClient, context, ...rest } = options
  const client =
    queryClient ?? (app.container.has('queryClient') ? app.container.use('queryClient') : undefined)
  const router = createRouter({
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultPendingComponent: DefaultPending,
    defaultErrorComponent: DefaultError,
    defaultNotFoundComponent: DefaultNotFound,
    defaultStructuralSharing: true,
    ...rest,
    context: { app, queryClient: client, ...context } as any,
    Wrap: ({ children }: { children: ReactNode }) => (
      <KitrProvider app={app}>{children}</KitrProvider>
    ),
  })
  return router as unknown as Router<TRouteTree, 'never', true>
}
