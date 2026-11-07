import { mountRoutes } from 'kitr/api'
import { createServer } from 'kitr/server'
import { routes } from '#app/api/routes'
import { sockets } from '#app/api/socket'
import serverConfig from '#config/server'

/** The kitr server behind Start's /api/* catch-all route; also what tests call. */
export const server = createServer({ config: { server: serverConfig } })
mountRoutes(server, routes)
// WebSocket upgrades on /api/ws, next to the REST routes.
sockets.attach(server, '/api/ws')
