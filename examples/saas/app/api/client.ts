import { createApiClient, registerRoutes } from '@kitr/api/client'
import type { ServerRoutes } from '#server/routes'
import { routeTable } from './routes.gen'

/**
 * While a page renders on the server, an API call runs in this process against the kitr server,
 * carrying the visitor's cookie and address, so loaders see the signed-in user and the rate limit
 * counts the visitor. `import.meta.env.SSR` is false in the browser bundle, which drops all of it.
 */
async function serverFetch(request: Request): Promise<Response> {
  const [{ getRequest }, { server }] = await Promise.all([
    import('@tanstack/react-start/server'),
    import('#server/main'),
  ])
  const incoming = getRequest()
  const cookie = incoming.headers.get('cookie')
  if (cookie) request.headers.set('cookie', cookie)
  const ip = (incoming as { ip?: string }).ip
  if (ip) Object.defineProperty(request, 'ip', { value: ip })
  return server.fetch(request)
}

/** Typed from the server table: route names, params, bodies and outputs; routes.gen.ts (kitr api:sync) carries the paths at run time. The browser's cookie and CSRF token ride along. */
export const api = createApiClient<ServerRoutes>({
  baseUrl: import.meta.env.SSR ? 'http://localhost' : '',
  ...(import.meta.env.SSR ? { fetch: serverFetch } : {}),
})
registerRoutes(api, [...routeTable])
