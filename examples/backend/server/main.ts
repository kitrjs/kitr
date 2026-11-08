import { createServer } from 'kitr/server'
import { routes } from './routes'
import { config } from '../config'
import rc from '../kitrrc'

/** The kitr server: providers from kitrrc.ts, config from config/, routes from server/routes.ts. What `kitr dev api` runs, what tests call with `server.fetch(new Request(...))`. */
export const server = createServer({ providers: rc.providers, config, routes })

/** Fetch handler for runtimes that call it (Cloudflare Workers, Deno Deploy). */
export default server

const isMain = (import.meta as { main?: boolean }).main ?? process.argv[1]?.endsWith("main.ts")
if (isMain) {
  server.listen({
    port: Number(process.env.PORT) || 3001,
    host: process.env.HOST,
  })
}
