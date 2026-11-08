import { loadRc } from 'kitr/app'
import { createServer } from '@kitr/server'
import { mailPreview } from '@kitr/mail'
import { resetPasswordMail, verifyEmailMail } from './mail/auth'
import { welcomeMail } from './mail/welcome'
import { shield } from '@kitr/shield'
import { routes } from '#server/routes'
import { config } from '../config'
import rc from '../kitrrc'

/** The kitr server: providers from kitrrc.ts, config from config/, routes from server/routes.ts. What `kitr dev api` runs, what app/server.ts hands the app's own requests to, what tests call with `server.fetch(new Request(...))`. */
export const server = createServer({ ...loadRc(rc, config), routes })
// Security headers, CORS, rate limit and CSRF from config/shield.ts.
shield(server)
// Rendered templates at /_kitr/mail in development.
if (server.app.isDevelopment) mailPreview(server, [welcomeMail, verifyEmailMail, resetPasswordMail])

/** Fetch handler for runtimes that call it (Cloudflare Workers, Deno Deploy). */
export default server

const isMain = (import.meta as { main?: boolean }).main ?? process.argv[1]?.endsWith("main.ts")
if (isMain) {
  server.listen({
    port: Number(process.env.PORT) || 3001,
    host: process.env.HOST,
  })
}
