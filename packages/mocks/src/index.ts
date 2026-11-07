import { KitrError, type KitrErrorShape } from '@kitr/core'
import { HttpResponse, http, type RequestHandler } from 'msw'

export { HttpResponse, http }

export interface RouteDescriptor {
  name: string
  method: string
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

/** Node (tests): `const server = await setupNodeMocks(handlers)`; browser (dev): `await setupBrowserMocks(handlers)`. */
export async function setupNodeMocks(handlers: RequestHandler[]) {
  const { setupServer } = await import('msw/node')
  const server = setupServer(...handlers)
  server.listen({ onUnhandledFrame: 'bypass' })
  return server
}

export async function setupBrowserMocks(
  handlers: RequestHandler[],
  options: { quiet?: boolean } = {},
) {
  const { setupWorker } = await import('msw/browser')
  const worker = setupWorker(...handlers)
  await worker.start({ onUnhandledFrame: 'bypass', quiet: options.quiet ?? true })
  return worker
}
