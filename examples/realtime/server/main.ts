import { mountRoutes } from 'kitr/api'
import { createServer } from 'kitr/server'
import { config } from '../config'
import rc from '../kitrrc'
import { routes } from '#server/routes'
import { realtime } from '#server/realtime'

/** The kitr server behind Start's /api/* catch-all route; also what tests call. Providers from kitrrc.ts, config from config/. */
export const server = createServer({ providers: rc.providers, config })
mountRoutes(server, routes)
// WebSocket upgrades on /api/ws, next to the REST routes.
realtime.attach(server, '/api/ws')
