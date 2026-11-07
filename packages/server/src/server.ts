import { type CreateAppOptions, createApp, type KitrApp } from '@kitr/core'
import { createLogger, type Logger } from '@kitr/logger'
import { bodyLimit, getRequestIP, H3, type H3Event, type Middleware } from 'h3'
import type { ServerConfig } from './config'
import { type RequestContext, runWithRequest } from './context'
import { errorToResponse } from './errors'

export interface CreateServerOptions extends CreateAppOptions {
  /** Reuse an existing app (e.g. shared with an SSR entry). */
  app?: KitrApp
  server?: ServerConfig
  logger?: Logger
}

export interface ListenOptions {
  port?: number
  host?: string
}

export interface KitrServer {
  app: KitrApp
  h3: H3
  logger: Logger
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
      : createLogger({ name: 'kitr', level: process.env.LOG_LEVEL as any }))

  const h3 = new H3({
    onError: (error, event) => errorToResponse(error, event),
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
        if (!server.logger)
          server.logger = app.container.has('logger')
            ? app.container.use('logger')
            : createLogger({ name: 'kitr' })
        return server
      })()
      return booted
    },
    async fetch(request) {
      await server.boot()
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
      const close = async () => {
        await srv.close()
        await server.close()
      }
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
