import { definePlatform, type PlatformContext, type PlatformFinding } from '@kitr/core'

/** How a web platform renders: prerendered HTML (`static`), a client-rendered shell (`spa`) or per-request server rendering (`ssr`). */
export type WebMode = 'static' | 'spa' | 'ssr'

/** The manifest and service worker settings of an installable web platform, passed as `web({ pwa: { ... } })`. */
export interface PwaOptions {
  /** Full app name in the install dialog. Default: the app name from package.json. */
  name?: string
  /** Name under the home-screen icon. Default: `name`, then the app name. */
  shortName?: string
  /** Manifest description. */
  description?: string
  /** Browser UI color. Default `#0f172a`. */
  themeColor?: string
  /** Splash screen background. Default `#ffffff`. */
  backgroundColor?: string
  /** How the installed app opens. Default `standalone`. */
  display?: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser'
  /** Page the installed app opens on. Default `/`. */
  startUrl?: string
  /** Manifest icons. Default `/icons/icon-192.png` and `/icons/icon-512.png` (maskable). */
  icons?: Array<{ src: string; sizes: string; type?: string; purpose?: string }>
  /** `autoUpdate` reloads on a new version; `prompt` lets `useServiceWorker()` show a banner. Default `prompt`. */
  registerType?: 'autoUpdate' | 'prompt'
  /** Enable the service worker in `kitr dev`. Default false. */
  devEnabled?: boolean
  /** Raw vite-plugin-pwa options merged last. */
  plugin?: Record<string, unknown>
}

/** Options of the web platform, as written in `web({ ... })` in kitrrc.ts and edited by `kitr config <name>`. */
export interface WebOptions {
  /**
   * `ssr`: TanStack Start renders on the server (needs a Node-ish host).
   * `static`: every route is prerendered at build time to plain HTML, served from any CDN.
   * `spa`: one shell, client rendering, served from any static host. Default `spa`.
   */
  mode: WebMode
  /** Dev server and production port. Default 3000. */
  port: number
  /** Interface to bind. Default: Vite's (localhost) in dev, `0.0.0.0` for `kitr start`. */
  host?: string
  /** Installable app: manifest and service worker. `true` uses the app name; an object sets the manifest. */
  pwa: boolean | PwaOptions
  /** Public base path, for apps served under a sub-path. Default `/`. */
  base: string
  /** Open the browser on `kitr dev`. Default false. */
  open: boolean
}

const MODES: WebMode[] = ['static', 'spa', 'ssr']

/**
 * The web platform. List it in kitrrc.ts under `platforms`:
 *
 *   platforms: { site: web({ mode: 'ssr', pwa: true, port: 3000 }) }
 *
 * `kitr dev site` starts Vite, `kitr build site` writes `dist/site`, `kitr start site` serves it.
 */
export const web = definePlatform<WebOptions>(
  {
    type: 'web',
    description: 'Browser app: static, SPA or server-rendered, optionally installable.',
    provider: '@kitr/web/provider',
    requires: ['router'],
    describe: {
      mode: {
        description:
          'static (prerendered HTML), spa (client-rendered shell) or ssr (server-rendered)',
        type: 'string',
        values: MODES,
        default: 'spa',
      },
      port: { description: 'Dev and production port', type: 'number', default: 3000 },
      host: {
        description: 'Host to bind (default: localhost in dev, 0.0.0.0 in production)',
        type: 'string',
      },
      pwa: {
        description: 'Installable app with a manifest and service worker',
        type: 'boolean',
        default: false,
      },
      base: { description: 'Public base path', type: 'string', default: '/' },
      open: { description: 'Open the browser on dev', type: 'boolean', default: false },
    },
    options: {
      '~standard': {
        version: 1,
        vendor: 'kitr',
        validate(value) {
          const v = (value ?? {}) as Partial<WebOptions>
          const issues: Array<{ message: string; path: string[] }> = []
          if (v.mode !== undefined && !MODES.includes(v.mode))
            issues.push({ message: `mode must be one of ${MODES.join(', ')}`, path: ['mode'] })
          if (v.port !== undefined && (typeof v.port !== 'number' || v.port < 0 || v.port > 65535))
            issues.push({ message: 'port must be a number between 0 and 65535', path: ['port'] })
          if (issues.length) return { issues }
          return {
            value: {
              mode: v.mode ?? 'spa',
              port: v.port ?? 3000,
              host: v.host,
              pwa: v.pwa ?? false,
              base: v.base ?? '/',
              open: v.open ?? false,
            },
          }
        },
      },
    },
  },
  (options) => ({
    dependencies: [
      { name: 'vite', dev: true },
      { name: '@vitejs/plugin-react', dev: true },
      { name: '@tanstack/react-start' },
      { name: '@tanstack/router-plugin', dev: true },
      ...(options.pwa ? [{ name: 'vite-plugin-pwa', dev: true }] : []),
      ...(options.mode === 'ssr' ? [{ name: 'srvx' }] : []),
    ],
    scaffold(ctx) {
      if (options.pwa)
        ctx.write(
          'public/icons/README.md',
          'Put `icon-192.png` (192x192) and `icon-512.png` (512x512, maskable-safe) here; the PWA manifest points at them.\n',
        )
    },
    async dev(ctx) {
      const args = ['dev', '--port', String(ctx.flags.port ?? options.port), '--strictPort']
      if (options.host || ctx.flags.host)
        args.push('--host', String(ctx.flags.host ?? options.host))
      if (options.open || ctx.flags.open) args.push('--open')
      await ctx.exec('vite', args)
    },
    async build(ctx) {
      await ctx.exec('vite', ['build'])
    },
    async start(ctx) {
      const port = Number(ctx.flags.port ?? ctx.env.PORT ?? options.port)
      const host = String(ctx.flags.host ?? ctx.env.HOST ?? options.host ?? '0.0.0.0')
      await startWeb(ctx, { mode: options.mode, port, host, base: options.base })
    },
    doctor(ctx) {
      const out: PlatformFinding[] = []
      const pkg = readPackage(ctx)
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      if (!('vite' in deps))
        out.push({
          level: 'error',
          message: `${ctx.name}: vite is not installed`,
          fix: `${ctx.pm} add -D vite`,
        })
      if (!('@tanstack/react-start' in deps))
        out.push({
          level: 'error',
          message: `${ctx.name}: @tanstack/react-start is not installed`,
          fix: `${ctx.pm} add @tanstack/react-start`,
        })
      if (options.pwa && !('vite-plugin-pwa' in deps))
        out.push({
          level: 'error',
          message: `${ctx.name}: pwa is on but vite-plugin-pwa is not installed`,
          fix: `${ctx.pm} add -D vite-plugin-pwa`,
        })
      if (!ctx.exists('app/routes.ts') && !ctx.exists('app/routes/__root.tsx'))
        out.push({
          level: 'warn',
          message: `${ctx.name}: app/routes.ts is missing (no pages to render)`,
          fix: 'kitr add router',
        })
      return out
    },
    agents: [
      `- \`kitr dev ${'<name>'}\` runs Vite on the platform's port; \`kitr build\` writes \`dist/<name>\`; \`kitr start\` serves it (${options.mode === 'ssr' ? 'the Start server bundle' : 'static files'}).`,
      options.mode === 'ssr'
        ? '- Routes render on the server by default; `ssrRoute(false)` from @kitr/seo opts a route out.'
        : options.mode === 'static'
          ? '- Every route is prerendered at build time; data must be available at build or fetched on the client.'
          : '- Routes render on the client; loaders run in the browser.',
      ...(options.pwa
        ? [
            '- The service worker is only emitted by `kitr build`; render `<PwaUpdate />` once so updates are offered (`useServiceWorker` from @kitr/web/client).',
          ]
        : []),
    ].join('\n'),
  }),
)

function readPackage(ctx: PlatformContext): Record<string, any> {
  try {
    return JSON.parse(ctx.read('package.json'))
  } catch {
    return {}
  }
}

type StaticHandler = (
  request: Request,
  next: () => Response | Promise<Response>,
) => Response | Promise<Response>

/**
 * Static files for a built web platform, under the platform's `base`. Vite's hashed files in
 * `assets/` never change, so they are cached for a year; everything else (`index.html`, `sw.js`,
 * the manifest, `public/` files) keeps its name across deploys and is revalidated on every load,
 * or users would be stuck on an old release.
 */
export function staticFiles(
  serveStatic: (options: { dir: string; maxAge?: number; immutable?: boolean }) => unknown,
  dir: string,
  base = '/',
): StaticHandler {
  const prefix = base.endsWith('/') ? base : `${base}/`
  const assets = serveStatic({ dir, maxAge: 60 * 60 * 24 * 365, immutable: true }) as StaticHandler
  const files = serveStatic({ dir }) as StaticHandler
  return async (request, next) => {
    const url = new URL(request.url)
    if (prefix !== '/') {
      if (!url.pathname.startsWith(prefix)) return next()
      url.pathname = url.pathname.slice(prefix.length - 1)
      request = new Request(url, request)
    }
    if (url.pathname.startsWith('/assets/')) return assets(request, next)
    let served = true
    const response = await files(request, () => {
      served = false
      return next()
    })
    if (served) response.headers.set('cache-control', 'no-cache')
    return response
  }
}

/** Serve a built web platform: the Start server bundle for `ssr`, static files otherwise. */
export async function startWeb(
  ctx: PlatformContext,
  options: { mode: WebMode; port: number; host: string; base?: string },
) {
  const { createRequire } = await import('node:module')
  const { existsSync } = await import('node:fs')
  const { resolve } = await import('node:path')
  const { pathToFileURL } = await import('node:url')
  const require = createRequire(resolve(ctx.root, 'package.json'))
  const dist = resolve(ctx.root, 'dist', ctx.name)
  const clientDir = resolve(dist, 'client')
  if (!existsSync(clientDir))
    throw new Error(`dist/${ctx.name}/client not found. Run \`kitr build ${ctx.name}\` first.`)
  const { serve } = (await import(
    pathToFileURL(require.resolve('srvx')).href
  )) as typeof import('srvx')
  const { staticMiddleware } = (await import(
    pathToFileURL(require.resolve('srvx/static')).href
  )) as typeof import('srvx/static')
  const middleware: unknown[] = [staticFiles(staticMiddleware, clientDir, options.base)]
  const plugins: unknown[] = []
  let fetch: (request: Request) => Response | Promise<Response>
  if (options.mode === 'ssr') {
    const entry = resolve(dist, 'server', 'server.js')
    if (!existsSync(entry))
      throw new Error(
        `dist/${ctx.name}/server/server.js not found. Run \`kitr build ${ctx.name}\` first.`,
      )
    const mod = (await import(pathToFileURL(entry).href)) as Record<string, any>
    const handler =
      mod.default?.fetch ??
      (typeof mod.default === 'function' ? mod.default : undefined) ??
      mod.fetch
    if (typeof handler !== 'function')
      throw new Error(`dist/${ctx.name}/server/server.js does not export a fetch handler`)
    fetch = (request) => handler(request)
    try {
      const ws = (await import(pathToFileURL(require.resolve('crossws/server/node')).href)) as {
        plugin: (options: Record<string, unknown>) => unknown
      }
      plugins.push(ws.plugin({}))
    } catch {}
  } else {
    // Static and SPA builds: unknown paths fall back to the shell so client routing works.
    const { readFile } = await import('node:fs/promises')
    const shell = ['index.html', '_shell.html', '200.html']
      .map((f) => resolve(clientDir, f))
      .find(existsSync)
    fetch = async () =>
      shell
        ? new Response(await readFile(shell), {
            headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' },
          })
        : new Response('Not found', { status: 404 })
  }
  const server = serve({
    fetch,
    port: options.port,
    hostname: options.host,
    plugins: plugins as any,
    middleware: middleware as any,
  } as any)
  await server.ready()
  ctx.log.success(`${ctx.name}: serving dist/${ctx.name} on ${server.url}`)
  await new Promise<void>((done) => {
    const stop = async () => {
      await server.close()
      done()
    }
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
    ctx.signal?.addEventListener('abort', stop)
  })
}

/** The manifest vite-plugin-pwa gets, from `web({ pwa })` and the app name. */
export function pwaManifest(options: WebOptions, appName: string) {
  const pwa = typeof options.pwa === 'object' ? options.pwa : {}
  return {
    name: pwa.name ?? appName,
    short_name: pwa.shortName ?? pwa.name ?? appName,
    description: pwa.description,
    theme_color: pwa.themeColor ?? '#0f172a',
    background_color: pwa.backgroundColor ?? '#ffffff',
    display: pwa.display ?? 'standalone',
    start_url: pwa.startUrl ?? '/',
    icons: pwa.icons ?? [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }
}
