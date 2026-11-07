import { type CreateAppOptions, createApp, type KitrApp } from '@kitr/core'
import { createLogger, type Logger } from '@kitr/logger'
import { bodyLimit, getRequestIP, H3, type H3Event, type Middleware } from 'h3'
import type { ServerConfig } from './config'
import { type RequestContext, runWithRequest } from './context'
import { errorToResponse } from './errors'

/** Options for `createServer()`: the app options (providers, config, mode) plus server overrides. */
export interface CreateServerOptions extends CreateAppOptions {
  /** Reuse an existing app (e.g. shared with an SSR entry). */
  app?: KitrApp
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

/** The server `createServer()` returns: an h3 app with the kitr lifecycle, served by `listen()` or `fetch()`. */
export interface KitrServer {
  /** The kitr app: container, config and providers. */
  app: KitrApp
  /** The underlying h3 app, for registering routes directly. */
  h3: H3
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
  fetch(request: Request): Promise<Response>
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
  const { app: givenApp, server: serverConfig, logger: givenLogger, ...appOptions } = options
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
      const response = errorToResponse(error, event)
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
    async fetch(request) {
      await server.boot()
      // Serving through fetch() (Start's /api route, Workers) is serving too: providers' `ready`
      // (job workers, schedulers) runs once here as it does on listen(). Tests stay quiet.
      if (app.environment !== 'test') await app.ready()
      return h3.fetch(request)
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
            '[kitr/server] websocket: true needs the `crossws` package. Run `kitr add socket`.',
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
      for (const signal of ['SIGINT', 'SIGTERM'] as const) {
        process.once(signal, () => {
          server.logger.info(`${signal} received, shutting down`)
          const timer = setTimeout(() => process.exit(1), config.shutdownTimeout * 1000)
          close().then(() => {
            clearTimeout(timer)
            process.exit(0)
          })
        })
      }
      return { url, close, node: (srv as any).node?.server }
    },
    async close() {
      await app.shutdown()
    },
  }

  // Request context, id, logging and body limit for every request.
  // Reject a declared oversized body before reading it, and close the connection: the client is
  // still uploading, and a kept-alive socket with an unread body never goes idle (it would hold
  // up graceful shutdown). Chunked bodies are still counted by h3's bodyLimit as they stream.
  h3.use((event, next) => {
    const length = Number(event.req.headers.get('content-length'))
    if (length > config.bodyLimit) {
      return new Response(
        JSON.stringify({
          code: 'PAYLOAD_TOO_LARGE',
          message: `Request body is larger than ${config.bodyLimit} bytes`,
          status: 413,
        }),
        { status: 413, headers: { 'content-type': 'application/json', connection: 'close' } },
      )
    }
    return next()
  })
  h3.use(bodyLimit(config.bodyLimit))
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
    }
    event.context.kitr = ctx
    event.res.headers.set(config.requestIdHeader, requestId)
    return runWithRequest(ctx, async () => {
      const result = await next()
      requestLogger.debug(`${event.req.method} ${event.url.pathname}`, {
        status: event.res.status ?? 200,
        ip: safeIp(event),
        durationMs: Math.round(performance.now() - ctx.startedAt),
      })
      return result
    })
  })
  if (config.healthPath) h3.get(config.healthPath, () => ({ ok: true }))

  return server
}

function safeIp(event: H3Event): string | undefined {
  try {
    return getRequestIP(event)
  } catch {
    return undefined
  }
}

declare module 'h3' {
  interface H3EventContext {
    kitr?: RequestContext
  }
}
