import { getDevtools, type KitrApp } from '@kitr/core'
import { KitrProvider } from '@kitr/react'
import type { QueryClient } from '@tanstack/react-query'
import {
  type AnyRoute,
  type AnyRouter,
  createRouter,
  type Router,
  type RouterOptions,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { DefaultError, DefaultNotFound, DefaultPending } from './defaults'
import type { CompileTreeOptions, RouteTreeOf } from './routes'

/** A route table with pages (`defineRoutes([pages], ...)`): what `createKitrRouter({ routes })` compiles. */
export interface PageRoutes<R = any> {
  $types: R
  compile(target: 'tanstack', options?: CompileTreeOptions): Record<string, unknown>
}

/** Options of `createKitrRouter`: TanStack's router options without `context`, plus the kitr app and extra context. */
export interface CreateKitrRouterBaseOptions<TRouteTree extends AnyRoute>
  extends Omit<RouterOptions<TRouteTree, 'never', false, any, any>, 'context' | 'routeTree'> {
  /** The app from `app/app.ts`. Put in every route's context as `context.app`; forked per request on the server. */
  app: KitrApp
  /** Defaults to the container's `queryClient` (from @kitr/query). */
  queryClient?: QueryClient
  /** Extra context merged into every route (e.g. `session`). */
  context?: Record<string, unknown>
  /** The platform this router is built for. Default `import.meta.env.KITR_PLATFORM`. */
  platform?: string
}

/** `createKitrRouter({ routeTree })`: a TanStack route tree, from `createRootRoute().addChildren` or file-based routes. */
export interface CreateKitrRouterOptions<TRouteTree extends AnyRoute>
  extends CreateKitrRouterBaseOptions<TRouteTree> {
  routeTree: TRouteTree
  routes?: never
}

/** The TanStack route tree of a table's `$types`, as a route (never `unknown`, so the router stays typed). */
export type TreeOf<R> = RouteTreeOf<R> extends infer T extends AnyRoute ? T : never

/** `createKitrRouter({ routes })`: the kitr route table from `app/routes.ts`, compiled to a route tree. */
export interface CreateKitrRouterFromRoutesOptions<R>
  extends CreateKitrRouterBaseOptions<TreeOf<R>> {
  routes: PageRoutes<R>
  routeTree?: never
}

declare module '@kitr/core' {
  interface ContainerBindings {
    router: AnyRouter
  }
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
): Router<TRouteTree, 'never', true>
export function createKitrRouter<R>(
  options: CreateKitrRouterFromRoutesOptions<R>,
): Router<TreeOf<R>, 'never', true>
export function createKitrRouter(
  options: CreateKitrRouterBaseOptions<any> & { routes?: PageRoutes; routeTree?: AnyRoute },
): Router<any, 'never', true> {
  const {
    app: rootApp,
    queryClient,
    context,
    routes,
    routeTree: givenTree,
    platform,
    ...rest
  } = options
  // The route table compiles to a TanStack tree once per router; the platform drops the pages
  // that do not ship on it.
  const routeTree: AnyRoute =
    givenTree ??
    (routes!.compile('tanstack', { platform: platform ?? (import.meta as any).env?.KITR_PLATFORM })
      .pages as AnyRoute)
  // On the server the router is built once per request (TanStack Start calls getRouter() each
  // time) while the app is a module singleton. Fork it so request-scoped services, like the
  // query cache, and the `router` binding below belong to this request only.
  const app = typeof window === 'undefined' ? rootApp.fork() : rootApp
  // The router can be created before the app has booted (Start calls getRouter() first), when
  // providers haven't registered `queryClient` yet. Resolve it when a loader first reads it.
  const routerContext: Record<string, unknown> = { app, ...context }
  if (!context || !('queryClient' in context))
    Object.defineProperty(routerContext, 'queryClient', {
      enumerable: true,
      configurable: true,
      get: () =>
        queryClient ??
        (app.container.has('queryClient') ? app.container.use('queryClient') : undefined),
    })
  // The session (`@kitr/auth`) and the platform (`@kitr/platform`) the same way: live getters,
  // so `requireAuth()` sees the session the auth provider restores during boot and
  // `onlyPlatform()` sees the platform service, without the app wiring either by hand.
  const lazyBinding = (
    field: 'session' | 'platform',
    binding: 'auth' | 'platform',
    pick: (service: any) => unknown,
  ) => {
    if (context && field in context) return
    Object.defineProperty(routerContext, field, {
      enumerable: true,
      configurable: true,
      get: () => (app.container.has(binding) ? pick(app.container.use(binding)) : undefined),
    })
  }
  lazyBinding('session', 'auth', (auth) => auth?.session ?? null)
  lazyBinding('platform', 'platform', (platform) => platform)
  const router = createRouter({
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultPendingComponent: DefaultPending,
    defaultErrorComponent: DefaultError,
    defaultNotFoundComponent: DefaultNotFound,
    defaultStructuralSharing: true,
    ...(rest as Omit<RouterOptions<AnyRoute, 'never', false, any, any>, 'context' | 'routeTree'>),
    routeTree,
    context: routerContext as any,
    Wrap: ({ children }: { children: ReactNode }) => (
      <KitrProvider app={app}>{children}</KitrProvider>
    ),
  })
  // `ssr` in config/seo.ts is the default for routes that set none; ssrRoute() still wins. It is
  // written onto the routes because Start replaces the router's `defaultSsr` with its own.
  const seo = rootApp.config.has('seo')
    ? (rootApp.config.get('seo') as { ssr?: boolean | 'data-only' } | undefined)
    : undefined
  if (seo?.ssr !== undefined)
    for (const route of Object.values(router.routesById) as Array<{ options: { ssr?: unknown } }>)
      if (route.options.ssr === undefined) route.options.ssr = seo.ssr
  // Loaders read services from the container, so boot before the first load (idempotent).
  const load = router.load.bind(router)
  router.load = (async (...args: Parameters<typeof load>) => {
    if (app.status === 'created' || app.status === 'registered') await app.boot()
    return load(...args)
  }) as typeof router.load
  // Devtools and services can reach the router without importing the route tree.
  app.container.value('router', router as unknown as AnyRouter)
  const hub = getDevtools(app)
  if (hub)
    router.subscribe('onResolved', (e) =>
      hub.log('router', `${e.pathChanged ? 'navigated' : 'resolved'} ${e.toLocation.pathname}`, {
        from: e.fromLocation?.pathname,
        search: e.toLocation.search,
      }),
    )
  return router as unknown as Router<any, 'never', true>
}
