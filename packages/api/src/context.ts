import {
  type InferOutput,
  type KitrApp,
  KitrError,
  type StandardSchemaV1,
  validate,
} from '@kitr/core'
import type { Logger } from '@kitr/logger'
import type { RequestContext } from '@kitr/server'
import { getQuery, getRequestIP, getRouterParams, type H3Event, readBody, redirect } from 'h3'

/** The incoming request as handlers see it: `ctx.request`. */
export interface KitrRequest {
  /** HTTP method, upper case. */
  method: string
  /** The full request URL. */
  url: URL
  /** The request headers. */
  headers: Headers
  /** One header value, or `null`. */
  header(name: string): string | null
  /** The client IP, or `undefined` when the runtime does not expose it. */
  ip(): string | undefined
  /** Raw query params. Prefer `ctx.query` when a schema is set. */
  qs(): Record<string, string | string[]>
  /** Raw body (JSON, form or text by content type). Prefer `ctx.body` when a schema is set. */
  raw(): Promise<unknown>
  /** The underlying Request. */
  native: Request
}

/** Helpers for shaping the response: `ctx.response`. */
export interface KitrResponse {
  /** Set the status for the value the handler returns. */
  status(code: number): KitrResponse
  /** Set a response header. */
  header(name: string, value: string): KitrResponse
  /** A redirect response; return it from the handler. Default status 302. */
  redirect(location: string, status?: number): Response
  /** An empty 204 response; return it from the handler. */
  noContent(): Response
  /** A JSON response with your own status and headers; return it from the handler. */
  json(data: unknown, init?: ResponseInit): Response
}

/**
 * The Adonis-style context handed to every handler and middleware.
 * `params`, `query` and `body` are validated when the route declares schemas.
 */
export interface HttpContext<
  P = Record<string, string>,
  Q = Record<string, string | string[]>,
  B = unknown,
> {
  /** The underlying h3 event. */
  event: H3Event
  /** The request-scoped app: its container holds per-request services. */
  app: KitrApp
  /** The request logger; adds the request id to every line. */
  logger: Logger
  /** The request id from `@kitr/server`, or `''` outside a kitr server. */
  requestId: string
  /** The incoming request. */
  request: KitrRequest
  /** Status, headers and response helpers. */
  response: KitrResponse
  /** Path parameters, validated when the route has a `params` schema. */
  params: P
  /** Query values, validated when the route has a `query` schema. */
  query: Q
  /** The parsed body on writes, validated when the route has a `body` schema. */
  body: B
  /** Set by middleware (auth puts `user` here). Shared with `@kitr/server`'s request context. */
  locals: Record<string, unknown>
  /** Validate any source on demand; throws KitrError.validation on failure. */
  validate<S extends StandardSchemaV1>(
    schema: S,
    source?: 'body' | 'query' | 'params',
  ): Promise<InferOutput<S>>
}

/** Build the HttpContext for an h3 event. The router calls it per request; use it to run a handler outside the router. */
export async function createHttpContext(
  event: H3Event,
  fallbackApp: KitrApp,
): Promise<HttpContext<any, any, any>> {
  const kitr: RequestContext | undefined = event.context.kitr
  const app = kitr?.app ?? fallbackApp
  const logger: Logger =
    kitr?.logger ??
    (app.container.has('logger') ? app.container.use('logger') : (console as unknown as Logger))
  let bodyPromise: Promise<unknown> | undefined

  const request: KitrRequest = {
    method: event.req.method,
    url: event.url,
    headers: event.req.headers,
    header: (name) => event.req.headers.get(name),
    ip: () => {
      try {
        return getRequestIP(event)
      } catch {
        return undefined
      }
    },
    qs: () => getQuery(event) as Record<string, string | string[]>,
    raw: () => {
      bodyPromise ??= readBody(event).catch((error) => {
        throw new KitrError(
          'BAD_REQUEST',
          `Could not read request body: ${(error as Error).message}`,
        )
      })
      return bodyPromise
    },
    native: event.req,
  }

  const response: KitrResponse = {
    status(code) {
      event.res.status = code
      return response
    },
    header(name, value) {
      event.res.headers.set(name, value)
      return response
    },
    redirect: (location, status = 302) => redirect(location, status) as unknown as Response,
    noContent: () => new Response(null, { status: 204 }),
    json: (data, init) =>
      new Response(JSON.stringify(data), {
        ...init,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          ...(init?.headers as Record<string, string>),
        },
      }),
  }

  const ctx: HttpContext<any, any, any> = {
    event,
    app,
    logger,
    requestId: kitr?.requestId ?? '',
    request,
    response,
    params: getRouterParams(event, { decode: true }),
    query: request.qs(),
    body: undefined,
    locals: kitr?.locals ?? {},
    async validate(schema, source = 'body') {
      const input =
        source === 'body' ? await request.raw() : source === 'query' ? request.qs() : ctx.params
      const result = await validate(schema, input)
      if (!result.success) throw KitrError.validation(result.fieldErrors)
      return result.data
    },
  }
  return ctx
}
