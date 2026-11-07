import { createKitrRouter } from 'kitr/router'
import { app } from './app'
import { routes } from './routes'

export function getRouter() {
  return createKitrRouter({ routes, app })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
