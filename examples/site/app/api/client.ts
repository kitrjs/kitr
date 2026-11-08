import { createApiClient, registerRoutes } from '@kitr/api/client'
import type { ServerRoutes } from '#server/routes'
import { routeTable } from './routes.gen'

/** Typed from the server table: route names, params, bodies and outputs; routes.gen.ts (kitr api:sync) carries the paths at run time. */
export const api = createApiClient<ServerRoutes>({
  baseUrl: typeof window === 'undefined' ? 'http://localhost:' + (process.env.PORT ?? 3000) : '',
})
registerRoutes(api, [...routeTable])
