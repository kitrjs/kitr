// Registry-only: stand-in for app/routeTree.gen.ts so page items typecheck without a generated tree.
import type { Route as RootRoute } from './routes/__root'
import type { Route as ItemsRoute } from './routes/items'
import type { Route as SignInRoute } from './routes/sign-in'

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/items': {
      id: '/items'
      path: '/items'
      fullPath: '/items'
      preLoaderRoute: typeof ItemsRoute
      parentRoute: typeof RootRoute
    }
    '/sign-in': {
      id: '/sign-in'
      path: '/sign-in'
      fullPath: '/sign-in'
      preLoaderRoute: typeof SignInRoute
      parentRoute: typeof RootRoute
    }
  }
}
