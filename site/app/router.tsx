import { createKitrRouter } from 'kitr/router'
import { app } from './app'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createKitrRouter({ routeTree, app, defaultPreload: 'intent' })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
