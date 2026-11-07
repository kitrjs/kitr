import { mountRoutes } from 'kitr/api'
import { createServer } from 'kitr/server'
import { routes } from '#server/routes'
import { realtime } from '#server/realtime'
import serverConfig from '#config/server'

/** The kitr server behind Start's /api/* catch-all route; also what tests call. */
export const server = createServer({ config: { server: serverConfig } })
mountRoutes(server, routes)
// WebSocket upgrades on /api/ws, next to the REST routes.
realtime.attach(server, '/api/ws')
