import { createApiClient, registerRoutes } from 'kitr/api/client'
import type { AppRoutes } from '#server/routes'
import { routeTable } from './routes.gen'

/** Typed, no codegen: route names, params, bodies and outputs come from the router. */
export const api = createApiClient<AppRoutes>({ baseUrl: typeof window === 'undefined' ? `http://localhost:${process.env.PORT ?? 3000}` : '' })
registerRoutes(api, [...routeTable])
