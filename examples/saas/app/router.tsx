import type { Session } from 'kitr/auth'
import { dehydrate, hydrate, type DehydratedState } from 'kitr/query'
import { createKitrRouter } from 'kitr/router'
import type { User } from '#app/abilities'
import { app } from './app'
import { routes } from './routes'

export function getRouter() {
  const router = createKitrRouter({
    routes,
    app,
    context: {
      // A live getter, so `requireAuth()` sees the session the auth provider restores during boot.
      get session() {
        return app.container.has('auth') ? (app.container.use('auth').session as Session<User>) : null
      },
    },
    // Pages render on the server with the signed-in user's data: send the query cache along, and
    // pick it up in the browser, so hydration finds the data it was rendered with.
    dehydrate: (): { queries: DehydratedState } => ({ queries: dehydrate(router.options.context.queryClient) }),
    hydrate: (data: { queries: DehydratedState }): void =>
      hydrate(router.options.context.queryClient, data.queries),
  })
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
