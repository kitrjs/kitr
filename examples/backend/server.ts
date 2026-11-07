import { createServer } from 'kitr/server'
import { mountRoutes } from 'kitr/api'
import rc from './kitrrc'
import { config } from './config'
import { routes } from './start/routes'
import { sockets } from './start/socket'

/** Providers from kitrrc.ts, config from config/index.ts (kept in sync by `kitr add`). */
export const server = createServer({ providers: rc.providers, config })
mountRoutes(server, routes)
sockets.attach(server, config.socket.path)

if (import.meta.main ?? process.argv[1]?.endsWith('server.ts')) {
  server.listen()
}
