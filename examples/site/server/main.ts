import { mountRoutes } from 'kitr/api'
import { createServer } from 'kitr/server'
import serverConfig from '#config/server'
import { routes } from '#server/routes'

/** The kitr server: what `kitr dev api` runs, what the web platform's /api route delegates to, what tests call. */
export const server = createServer({ config: { server: serverConfig } })
mountRoutes(server, routes)

/** Fetch handler for runtimes that call it (Cloudflare Workers, Deno Deploy). */
export default server

const isMain = (import.meta as { main?: boolean }).main ?? process.argv[1]?.endsWith("main.ts")
if (isMain) {
  server.listen({
    port: Number(process.env.PORT) || 3001,
    host: process.env.HOST,
  })
}
