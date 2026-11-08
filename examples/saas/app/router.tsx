import type { Session } from 'kitr/auth'
import { dehydrate, hydrate, type DehydratedState } from 'kitr/query'
import type { KitrApp } from 'kitr/app'
import { createKitrRouter } from 'kitr/router'
import type { User } from '#app/abilities'
import { app } from './app'
import { routes } from './routes'

export function getRouter() {
  // On the server the router forks `app` per request, and the session lives in that fork.
  const scope: { app: KitrApp } = { app }
  // Route contexts are copied as they are built, before `ensureSession` has loaded anything, so
  // hand out a stand-in that reads the request's session when a guard asks.
  const live = new Proxy({} as Session<User>, {
    get(_target, key) {
      const { container } = scope.app
      const session = container.has('auth') ? (container.use('auth').session as Session<User>) : null
      return session ? Reflect.get(session, key) : key === 'user' ? null : undefined
    },
  })
  const router = createKitrRouter({
    routes,
    app,
    context: {
      session: live,
    },
    // Pages render on the server with the signed-in user's data: send the query cache along, and
    // pick it up in the browser, so hydration finds the data it was rendered with.
    dehydrate: (): { queries: DehydratedState } => ({ queries: dehydrate(router.options.context.queryClient) }),
    hydrate: (data: { queries: DehydratedState }): void =>
      hydrate(router.options.context.queryClient, data.queries),
  })
  scope.app = router.options.context.app
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}

declare module '@kitr/router' {
  interface KitrRouterContext {
    session: Session<User> | null
  }
}
