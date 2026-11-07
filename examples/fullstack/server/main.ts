import { mountRoutes } from 'kitr/api'
import { createServer } from 'kitr/server'
import { config } from '../config'
import rc from '../kitrrc'
import { realtime } from '#server/realtime'
import { routes } from '#server/routes'

/** The kitr server: providers from kitrrc.ts, config from config/. What `kitr dev api` runs, what the web platform's /api route delegates to, what tests call. */
export const server = createServer({ providers: rc.providers, config })
mountRoutes(server, routes)
// Realtime on /api/ws (config/realtime.ts), next to the routes.
realtime.attach(server)

/** Fetch handler for runtimes that call it (Cloudflare Workers, Deno Deploy). */
export default server

const isMain = (import.meta as { main?: boolean }).main ?? process.argv[1]?.endsWith("main.ts")
if (isMain) {
  server.listen({
    port: Number(process.env.PORT) || 3001,
    host: process.env.HOST,
  })
}
