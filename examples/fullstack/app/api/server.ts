import { createServer } from 'kitr/server'
import { mountRoutes } from 'kitr/api'
import serverConfig from '#config/server'
import { routes } from '#app/api/routes'
import { sockets } from '#app/api/socket'

/** The kitr server behind Start's /api/* catch-all route; also what tests call. */
export const server = createServer({ config: { server: serverConfig } })
mountRoutes(server, routes)
sockets.attach(server, '/api/ws')
