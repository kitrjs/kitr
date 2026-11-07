import { createApiClient } from 'kitr/api/client'
import type { AppRoutes } from '#server/routes'

/** Typed, no codegen: route names, params, bodies and outputs come from the router. */
export const api = createApiClient<AppRoutes>({ baseUrl: typeof window === 'undefined' ? `http://localhost:${process.env.PORT ?? 3000}` : '' })
