import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { defineCommand } from 'citty'
import { createContext } from '../context'

/**
 * Serve a built TanStack Start app (`vite build` → dist/server/server.js) with srvx.
 * The bundle exports a fetch handler; this adds the listener, PORT/HOST, and WebSocket
 * upgrades when @kitr/socket is installed. Pure backend apps run `server.ts` directly instead.
 */
export const serve = defineCommand({
  meta: {
    name: 'serve',
    description: 'Serve the production build of a TanStack Start app (dist/server/server.js).',
  },
  args: {
    port: { type: 'string', description: 'Port (default: $PORT or 3000)' },
    host: { type: 'string', description: 'Host (default: $HOST or 0.0.0.0)' },
    entry: { type: 'string', description: 'Server bundle', default: 'dist/server/server.js' },
  },
  async run({ args }) {
    const ctx = createContext()
    const entry = ctx.path(args.entry)
    if (!existsSync(entry))
      throw new Error(`${args.entry} not found. Run \`${ctx.pm} build\` first.`)
    const require = createRequire(ctx.path('package.json'))
    const mod = (await import(pathToFileURL(entry).href)) as Record<string, any>
    const handler =
      mod.default?.fetch ??
      (typeof mod.default === 'function' ? mod.default : undefined) ??
      mod.fetch
    if (typeof handler !== 'function')
      throw new Error(`${args.entry} does not export a fetch handler`)
    const { serve: srvxServe } = (await import(
      pathToFileURL(require.resolve('srvx')).href
    )) as typeof import('srvx')
    const plugins: unknown[] = []
    try {
      const ws = (await import(pathToFileURL(require.resolve('crossws/server/node')).href)) as {
        plugin: (options: Record<string, unknown>) => unknown
      }
      plugins.push(ws.plugin({}))
    } catch {}
    // Start's bundle only answers routes; the client assets next to it (dist/client) are static files.
    const middleware: unknown[] = []
    const clientDir = resolve(entry, '..', '..', 'client')
    if (existsSync(clientDir)) {
      const { staticMiddleware } = (await import(
        pathToFileURL(require.resolve('srvx/static')).href
      )) as typeof import('srvx/static')
      middleware.push(staticMiddleware({ dir: clientDir, maxAge: 60 * 60 * 24 * 365 }))
    }
    const port = Number(args.port ?? process.env.PORT ?? 3000)
    const hostname = args.host ?? process.env.HOST ?? '0.0.0.0'
    const server = srvxServe({
      fetch: (request: Request) => handler(request),
      port,
      hostname,
      plugins: plugins as any,
      middleware: middleware as any,
    })
    await server.ready()
    ctx.log.success(`serving ${args.entry} on ${server.url}`)
    const stop = async () => {
      await server.close()
      process.exit(0)
    }
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
  },
})
