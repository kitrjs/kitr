import { type CreateAppOptions, createApp, inProduction, type KitrApp } from '@kitr/core'
import { createLogger, type Logger } from '@kitr/logger'
import { bodyLimit, getRequestIP, H3, type H3Event, HTTPError, type Middleware } from 'h3'
import type { ServerConfig } from './config'
import { type RequestContext, runWithRequest } from './context'
import { errorToResponse } from './errors'

/**
 * The route table `createServer({ routes })` compiles: `defineRoutes([api, realtime], ...)` from
 * `@kitr/core`. Each extension with an `h3` target mounts its own entries (endpoints, sockets).
 */
export interface ServerRoutes {
  readonly entries: ReadonlyArray<{ kind: string; path: string; [field: string]: unknown }>
  readonly extensions: ReadonlyArray<{
    kinds: readonly string[]
    targets?: Record<string, unknown>
  }>
  compile(target: 'h3', server: KitrServer): Record<string, unknown>
}

/** Options for `createServer()`: the app options (providers, config, mode) plus server overrides. */
export interface CreateServerOptions extends CreateAppOptions {
  /** Reuse an existing app (e.g. shared with an SSR entry). */
  app?: KitrApp
  /** The route table: its endpoints and sockets are mounted on this server. */
  routes?: ServerRoutes
  /** Server options; override the `server` key of `config`. */
  server?: ServerConfig
  /** Logger to use instead of the container's `logger` binding (`silentLogger` in tests). */
  logger?: Logger
}

/** Where `listen()` binds. Falls back to the server config. */
export interface ListenOptions {
  /** Port to listen on; `0` picks a free one. */
  port?: number
  /** Interface to bind. */
  host?: string
}

/** Options of `server.fetch()`. */
export interface FetchOptions {
  /**
   * Renders pages: Start's fetch handler, in an app with a web platform. A request none of the
   * server's routes answers (see `handles()`) goes to it *inside* the server's middleware, so
   * `shield` puts its security headers and CSP nonce on pages too, and the nonce reaches the
   * renderer through the request context.
   */
  pages?: (request: Request) => Response | Promise<Response>
}

/** The server `createServer()` returns: an h3 app with the kitr lifecycle, served by `listen()` or `fetch()`. */
export interface KitrServer {
  /** The kitr app: container, config and providers. */
  app: KitrApp
  /** The underlying h3 app, for registering routes directly. */
  h3: H3
  /** The route table given to `createServer({ routes })`, if any. */
  routes?: ServerRoutes
  /** The server logger: the container's `logger` after boot, or a built-in one. */
  logger: Logger
  /** The resolved server options, defaults filled in. */
  config: Required<
    Pick<
      ServerConfig,
      'port' | 'host' | 'healthPath' | 'bodyLimit' | 'requestIdHeader' | 'shutdownTimeout'
    >
  > &
    ServerConfig
  /** Boot providers. Called by `listen()` and lazily by `fetch()`. */
  boot(): Promise<KitrServer>
  /** Web-standard fetch handler: use inside TanStack Start, Nitro, Cloudflare, Bun, Deno. */
  fetch(request: Request, options?: FetchOptions): Promise<Response>
  /**
   * Whether this server answers the request's path: a route of the table, the health path, or
   * anything under a top-level segment one of its routes lives in (`/api/*` once `/api/health`
   * exists), so Start's entry hands it over and an unknown endpoint gets a JSON 404.
   */
  handles(request: Request | URL | string): boolean
  /** Mount an h3 app or any fetch handler under a base path. */
  mount(
    base: string,
    handler: H3 | { fetch: (req: Request) => Response | Promise<Response> },
  ): KitrServer
  /** Add h3 middleware that runs for every request. */
  use(middleware: Middleware): KitrServer
  /** Start a standalone server (Node, Bun or Deno via srvx) and run providers' `ready()`. */
  listen(
    options?: ListenOptions,
  ): Promise<{ url: string; close: () => Promise<void>; node?: unknown }>
  /** Run providers' `shutdown()`. */
  close(): Promise<void>
}

/**
 * Create a kitr server: an h3 app plus the kitr provider lifecycle, request
 * context, error normalisation and request logging. Nothing here imports React,
 * so a pure backend built on kitr ships none.
 */
export function createServer(options: CreateServerOptions = {}): KitrServer {
  const {
    app: givenApp,
    server: serverConfig,
    logger: givenLogger,
    routes,
    ...appOptions
  } = options
  const app = givenApp ?? createApp({ environment: 'server', ...appOptions })
  if (serverConfig) app.config.set('server', serverConfig)
  const config = {
    port: 3000,
    host: '0.0.0.0',
    healthPath: '/healthz' as string | false,
    bodyLimit: 1024 * 1024,
    requestIdHeader: 'x-request-id',
    shutdownTimeout: 10,
    ...(app.config.has('server') ? app.config.get('server') : {}),
  }
  const logger =
    givenLogger ??
    (app.container.has('logger')
      ? undefined
      : createLogger({ name: 'kitr', level: (process.env.LOG_LEVEL as any) || undefined }))

  const h3 = new H3({
    onError: (error, event) => {
      const response = errorToResponse(error, event, { production: inProduction(app) })
      // A body nobody read is cancelled here with no reason, so the Node adapter does not
      // print the error a second time when it tears the request stream down.
      const body = event.req.body
      if (body && !body.locked) body.cancel().catch(() => {})
      // 5xx are bugs or outages: record them with the request id so logs and the client's
      // error reference line up. 4xx are expected and stay at debug level with the request line.
      if (response.status >= 500) {
        const ctx = event.context.kitr as RequestContext | undefined
        const log = ctx?.logger ?? server.logger
        log?.error(error instanceof Error ? error : new Error(String(error)), {
          method: event.req.method,
          path: event.url.pathname,
          status: response.status,
        })
      }
      return response
    },
  })

  let booted: Promise<KitrServer> | null = null
  const server: KitrServer = {
    app,
    h3,
    logger: logger ?? (null as unknown as Logger),
    config,
    routes,
    boot() {
      booted ??= (async () => {
        await app.boot()
        // The logger provider registers during boot, so it can only be picked up now.
        if (!givenLogger && app.container.has('logger')) server.logger = app.container.use('logger')
        else if (!server.logger) server.logger = createLogger({ name: 'kitr' })
        return server
      })()
      return booted
    },
    async fetch(request, fetchOptions) {
      await server.boot()
      // Serving through fetch() (Start's /api route, Workers) is serving too: providers' `ready`
      // (job workers, schedulers) runs once here as it does on listen(). Tests stay quiet.
      if (app.environment !== 'test') await app.ready()
      // Pages are everything the table does not claim; a claimed path that matches no route
      // keeps the server's JSON 404.
      if (fetchOptions?.pages && !server.handles(request))
        return h3.request(request, undefined, { kitrPages: fetchOptions.pages })
      return h3.fetch(request)
    },
    handles(request) {
      const pathname =
        typeof request === 'string'
          ? new URL(request, 'http://localhost').pathname
          : request instanceof URL
            ? request.pathname
            : new URL(request.url).pathname
      if (config.healthPath && pathname === config.healthPath) return true
      return served().some((match) => match(pathname))
    },
    mount(base, handler) {
      h3.mount(base, handler as any)
      return server
    },
    use(middleware) {
      h3.use(middleware)
      return server
    },
    async listen(listenOptions = {}) {
      await server.boot()
      const { serve } = await import('srvx')
      const plugins: unknown[] = []
      if (config.websocket) {
        const ws = await import('crossws/server/node').catch(() => null)
        if (!ws)
          throw new Error(
            '[@kitr/server] websocket: true needs the `crossws` package. Run `kitr add socket`.',
          )
        plugins.push(ws.plugin({}))
      }
      const port = listenOptions.port ?? config.port
      const hostname = listenOptions.host ?? config.host
      const srv = serve({
        fetch: h3.fetch,
        port,
        hostname,
        plugins: plugins as any,
        silent: true,
      } as any)
      await srv.ready()
      const url = (
        srv.url ?? `http://${hostname === '0.0.0.0' ? 'localhost' : hostname}:${port}`
      ).replace(/\/$/, '')
      server.logger.info(`listening on ${url}`)
      await app.ready()
      // Upgraded (WebSocket) connections never go idle, so a plain close() would wait on them
      // forever and shutdown would only end at the timeout. Track and end them on close.
      const nodeServer = (srv as any).node?.server as
        | (import('node:http').Server & { closeIdleConnections?: () => void })
        | undefined
      const upgraded = new Set<import('node:stream').Duplex>()
      nodeServer?.on('upgrade', (_req, socket) => {
        upgraded.add(socket)
        socket.once('close', () => upgraded.delete(socket))
      })
      let closing: Promise<void> | undefined
      const close = () =>
        (closing ??= (async () => {
          const stopped = srv.close()
          for (const socket of upgraded) socket.destroy()
          nodeServer?.closeIdleConnections?.()
          await stopped
          await server.close()
        })())
      // One SIGINT/SIGTERM handler per process, however many servers it runs.
      const leave = joinShutdown({ close, logger: server.logger, timeout: config.shutdownTimeout })
      const closeAndLeave = async () => {
        leave()
        await close()
      }
      return { url, close: closeAndLeave, node: (srv as any).node?.server }
    },
    async close() {
      await app.shutdown()
    },
  }

  // Request context, id, logging and body limit for every request.
  // Reject a declared oversized body before reading it, and close the connection: the client is
  // still uploading, and a kept-alive socket with an unread body never goes idle (it would hold
  // up graceful shutdown). Chunked bodies are still counted by h3's bodyLimit as they stream.
  const limitFor = (pathname: string) => {
    let best = ''
    for (const prefix of Object.keys(config.bodyLimits ?? {}))
      if (
        prefix.length > best.length &&
        (pathname === prefix || pathname.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`))
      )
        best = prefix
    return best ? config.bodyLimits![best]! : config.bodyLimit
  }
  // Pages are the renderer's (Start has its own limits for server functions and forms).
  const isPage = (event: H3Event) => typeof event.context.kitrPages === 'function'
  h3.use((event, next) => {
    if (isPage(event)) return next()
    const limit = limitFor(event.url.pathname)
    const length = Number(event.req.headers.get('content-length'))
    if (length > limit) {
      return new Response(
        JSON.stringify({
          code: 'PAYLOAD_TOO_LARGE',
          message: `Request body is larger than ${limit} bytes`,
          status: 413,
        }),
        { status: 413, headers: { 'content-type': 'application/json', connection: 'close' } },
      )
    }
    return next()
  })
  h3.use((event, next) =>
    isPage(event) ? next() : bodyLimit(limitFor(event.url.pathname))(event, next),
  )
  h3.use(async (event, next) => {
    const requestId = event.req.headers.get(config.requestIdHeader) ?? crypto.randomUUID()
    const requestLogger = server.logger.child({ requestId })
    const ctx: RequestContext = {
      event,
      app: app.fork(),
      requestId,
      logger: requestLogger,
      startedAt: performance.now(),
      locals: {},
      ip: clientIp(event, config.trustProxy),
      page: isPage(event),
    }
    event.context.kitr = ctx
    event.res.headers.set(config.requestIdHeader, requestId)
    return runWithRequest(ctx, async () => {
      const result = await next()
      requestLogger.debug(`${event.req.method} ${event.url.pathname}`, {
        status: event.res.status ?? 200,
        ip: ctx.ip,
        durationMs: Math.round(performance.now() - ctx.startedAt),
      })
      return result
    })
  })
  if (config.healthPath) h3.get(config.healthPath, () => ({ ok: true }))
  // Paths no route answers: the app's pages when `fetch(request, { pages })` brought a renderer,
  // else the usual 404.
  h3.all('/**', (event) => {
    const pages = event.context.kitrPages
    if (typeof pages !== 'function') throw new HTTPError({ status: 404, statusText: 'Not Found' })
    return pages(event.req)
  })
  // Endpoints and sockets from the route table: each extension mounts its own kind.
  if (routes) routes.compile('h3', server)
  // The paths this server answers, for `handles()`: every entry of an extension with an h3 target,
  // and everything under the first segment of such an entry (`/api/health` claims `/api/*`), so an
  // unknown path next to the endpoints gets this server's JSON 404 rather than the app's HTML one.
  let matchers: Array<(pathname: string) => boolean> | undefined
  const served = () => {
    if (matchers) return matchers
    const paths = (routes?.entries ?? [])
      .filter((entry) =>
        routes!.extensions.some((ext) => ext.kinds.includes(entry.kind) && ext.targets?.h3),
      )
      .map((entry) => entry.path)
    const prefixes = new Set(
      paths
        .map((path) => path.split('/')[1])
        .filter((segment) => segment && !/^[:$*]/.test(segment)),
    )
    matchers = [
      ...paths.map(pathMatcher),
      ...[...prefixes].map(
        (segment) => (pathname: string) =>
          pathname === `/${segment}` || pathname.startsWith(`/${segment}/`),
      ),
    ]
    return matchers
  }

  return server
}

/** `/api/projects/:id` and `/files/*` (or `$id`, `$`) as a test on a request pathname. */
function pathMatcher(path: string): (pathname: string) => boolean {
  const pattern = path
    .split('/')
    .map((segment) =>
      segment === '*' || segment === '**' || segment === '$'
        ? '.*'
        : segment.startsWith(':') || segment.startsWith('$')
          ? '[^/]+'
          : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('/')
  const regex = new RegExp(`^${pattern}/?$`)
  return (pathname) => regex.test(pathname)
}

/**
 * The client's address. With `trustProxy` (true = one proxy, or a count), each trusted proxy
 * appended the address it saw to `X-Forwarded-For`, so the entry that many places from the end is
 * the client as the outermost trusted proxy saw it. Entries before that were sent by the client
 * and are ignored. Without it, the socket's address.
 */
export function clientIp(event: H3Event, trustProxy: boolean | number = false): string | undefined {
  const hops = trustProxy === true ? 1 : typeof trustProxy === 'number' ? trustProxy : 0
  if (hops > 0) {
    const chain = (event.req.headers.get('x-forwarded-for') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (chain.length) return chain[Math.max(0, chain.length - hops)]
  }
  try {
    return getRequestIP(event)
  } catch {
    return undefined
  }
}

declare module 'h3' {
  interface H3EventContext {
    kitr?: RequestContext
    /** The page renderer of `server.fetch(request, { pages })`. */
    kitrPages?: (request: Request) => Response | Promise<Response>
  }
}

/** A server that takes part in the process-wide shutdown. */
interface ShutdownEntry {
  close(): Promise<void>
  logger: Logger
  /** Seconds to wait for everything to drain before exiting with code 1. */
  timeout: number
}

// kitr-allow-module-state: SIGINT/SIGTERM belong to the process, so the servers in it share one handler and one list
const shutdownEntries = new Set<ShutdownEntry>()
// kitr-allow-module-state: the single handler this process installed for SIGINT and SIGTERM, if any
let shutdownHandler: ((signal: NodeJS.Signals) => void) | undefined
const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'] as const

/**
 * Add a server to the set the signal handler drains, installing the handler for the first one.
 * Returns the function that removes it, which also takes the handler off when the last server
 * leaves, so two servers in a process never stack handlers that each call `process.exit`.
 */
function joinShutdown(entry: ShutdownEntry): () => void {
  shutdownEntries.add(entry)
  if (!shutdownHandler) {
    let draining = false
    const handler = (signal: NodeJS.Signals) => {
      if (draining) return
      draining = true
      const entries = [...shutdownEntries]
      for (const e of entries) e.logger.info(`${signal} received, shutting down`)
      const timer = setTimeout(
        () => process.exit(1),
        Math.max(0, ...entries.map((e) => e.timeout)) * 1000,
      )
      Promise.allSettled(entries.map((e) => e.close())).then(() => {
        clearTimeout(timer)
        process.exit(0)
      })
    }
    shutdownHandler = handler
    for (const signal of SHUTDOWN_SIGNALS) process.on(signal, handler)
  }
  return () => {
    shutdownEntries.delete(entry)
    if (shutdownEntries.size === 0 && shutdownHandler) {
      for (const signal of SHUTDOWN_SIGNALS) process.off(signal, shutdownHandler)
      shutdownHandler = undefined
    }
  }
}
