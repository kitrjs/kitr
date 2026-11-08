import { KitrError, type KitrErrorShape } from '@kitr/core'
import { HttpResponse, http, type RequestHandler } from 'msw'

export { HttpResponse, http }

/** One route of a kitr route table, as `routes.toJSON()` and `kitr api:sync` describe it. */
export interface RouteDescriptor {
  /** The route name that `mockRoutes` resolvers are keyed by, such as `orders.show`. */
  name: string
  /** The HTTP method, in any case: `GET`, `post`. */
  method: string
  /** The path pattern with `:params`, such as `/api/orders/:id`. */
  path: string
}

type Resolver = (info: {
  params: Record<string, string | readonly string[] | undefined>
  request: Request
  body: () => Promise<unknown>
}) => unknown | Promise<unknown>

/**
 * MSW handlers from a kitr route table (`routes.toJSON()`) or an OpenAPI-ish list.
 * Unhandled routes get a 501 so a missing mock is loud, not silent.
 *
 *   const handlers = mockRoutes(routeTable, 'http://localhost:3000', {
 *     'projects.index': () => [{ id: '1', name: 'Alpha' }],
 *     'projects.show': ({ params }) => ({ id: params.id, name: 'Alpha' }),
 *   })
 */
export function mockRoutes(
  table: RouteDescriptor[],
  baseUrl: string,
  resolvers: Record<string, Resolver | unknown>,
): RequestHandler[] {
  const base = baseUrl.replace(/\/$/, '')
  return table.map((route) => {
    const method = route.method.toLowerCase() as keyof typeof http
    const pattern = `${base}${route.path}`
    const resolver = resolvers[route.name]
    return (http[method] as typeof http.get)(pattern, async ({ params, request }) => {
      if (resolver === undefined)
        return kitrErrorResponse(
          new KitrError('UNAVAILABLE', `No mock for ${route.name}`, { status: 501 }),
        )
      try {
        const value =
          typeof resolver === 'function'
            ? await (resolver as Resolver)({ params, request, body: () => request.json() })
            : resolver
        if (value instanceof Response) return value
        if (value === undefined) return new HttpResponse(null, { status: 204 })
        return HttpResponse.json(value as any)
      } catch (error) {
        return kitrErrorResponse(error)
      }
    })
  })
}

/**
 * Turns anything thrown into the JSON response a kitr server sends for it: a `KitrError` keeps its
 * code and status, anything else becomes `INTERNAL` with status 500.
 */
export function kitrErrorResponse(error: unknown) {
  const e =
    error instanceof KitrError
      ? error
      : new KitrError('INTERNAL', String((error as Error)?.message ?? error))
  return HttpResponse.json(e.toJSON() as KitrErrorShape, { status: e.status })
}

/** A handler that throws a kitr validation error, to test form error mapping. */
export function mockValidationError(
  method: 'post' | 'put' | 'patch',
  url: string,
  fieldErrors: Record<string, string[]>,
) {
  return http[method](url, () => kitrErrorResponse(KitrError.validation(fieldErrors)))
}

/**
 * Starts MSW in Node for tests: `const mocks = await setupNodeMocks(handlers)`. Requests no handler
 * matches go to the real network. Returns MSW's server, so `use`, `resetHandlers` and `close` work.
 */
export async function setupNodeMocks(handlers: RequestHandler[]) {
  const { setupServer } = await import('msw/node')
  const server = setupServer(...handlers)
  server.listen({ onUnhandledFrame: 'bypass' })
  return server
}

/**
 * Starts MSW's service worker in the browser for development: `await setupBrowserMocks(handlers)`.
 * Needs `mockServiceWorker.js` in the public folder. Pass `quiet: false` to see MSW's console messages.
 */
export async function setupBrowserMocks(
  handlers: RequestHandler[],
  options: { quiet?: boolean } = {},
) {
  const { setupWorker } = await import('msw/browser')
  const worker = setupWorker(...handlers)
  await worker.start({ onUnhandledFrame: 'bypass', quiet: options.quiet ?? true })
  return worker
}
