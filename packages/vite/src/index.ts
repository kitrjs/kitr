import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import type { Plugin, PluginOption } from 'vite'

export interface KitrPluginOptions {
  /** Project root. Default: Vite's root. */
  root?: string
  /** Use TanStack Start (SSR, server functions). Default: true when `@kitr/server` is in kitrrc packages. */
  start?: boolean | Record<string, unknown>
  /** Add @vitejs/plugin-react. Default true when installed. */
  react?: boolean
  /** Add @tailwindcss/vite. Default: when `@kitr/tailwind` is in kitrrc packages and the plugin is installed. */
  tailwind?: boolean
  /** Route files directory. Default `app/routes`. */
  routesDirectory?: string
  generatedRouteTree?: string
  /** Extra options for @tanstack/router-plugin. */
  router?: Record<string, unknown>
  /** Include `@kitr/devtools/provider`. Default: never in production builds, always otherwise. */
  devtools?: boolean
}

/** Config files whose packages import Node built-ins; kept out of client builds. */
const SERVER_ONLY_CONFIG = ['server', 'api', 'db']

interface RcInfo {
  packages: string[]
  providers: string[]
  directories: Record<string, string>
}

/**
 * The kitr() Vite plugin. It reads `kitrrc.ts` at build time and:
 * - wires TanStack Router (or Start), React and Tailwind plugins,
 * - exposes `virtual:kitr/providers` and `virtual:kitr/config` as static imports,
 * - pre-declares `optimizeDeps` for the blessed stack so dev start never rediscovers.
 */
export function kitr(options: KitrPluginOptions = {}): PluginOption[] {
  let root = options.root ?? process.cwd()
  let rc = readRc(root)
  let stripDevtools = false
  const plugins: PluginOption[] = []

  const core: Plugin = {
    name: 'kitr',
    enforce: 'pre',
    async config(config, env) {
      stripDevtools =
        options.devtools === false || (env.command === 'build' && env.mode === 'production')
      root = options.root ?? config.root ?? process.cwd()
      rc = readRc(root)
      const include = blessedDeps(root)
      // Tauri's webview needs a fixed port and sees TAURI_ENV_* at build time.
      const tauri = rc.packages.includes('@kitr/tauri')
        ? {
            clearScreen: false,
            server: { port: 1420, strictPort: true },
            envPrefix: ['VITE_', 'TAURI_ENV_*'],
          }
        : {}
      return {
        ...tauri,
        resolve: {
          alias: {
            '#app': resolve(root, rc.directories.app ?? 'app'),
            '#config': resolve(root, rc.directories.config ?? 'config'),
            '#components': resolve(root, rc.directories.components ?? 'app/components'),
          },
        },
        optimizeDeps: { include },
        define: { 'import.meta.env.KITR_PACKAGES': JSON.stringify(rc.packages) },
      }
    },
    resolveId(id) {
      if (id === 'virtual:kitr/providers' || id === 'virtual:kitr/config') return `\0${id}`
      return null
    },
    load(id, loadOptions) {
      if (id === '\0virtual:kitr/providers') {
        // Production builds never import the devtools provider, so the overlay is not in the bundle.
        const specs = stripDevtools
          ? rc.providers.filter((spec) => !/devtools\/provider$/.test(spec))
          : rc.providers
        const imports = specs
          .map((spec, i) => `import p${i} from ${JSON.stringify(spec)}`)
          .join('\n')
        return `${imports}\nexport const providers = [${specs.map((_, i) => `p${i}`).join(', ')}]\n`
      }
      if (id === '\0virtual:kitr/config') {
        const dir = resolve(root, rc.directories.config ?? 'config')
        // Server-only config (config/server.ts imports Node APIs) never reaches the browser bundle.
        const serverOnly = loadOptions?.ssr ? [] : SERVER_ONLY_CONFIG
        const files = existsSync(dir)
          ? readdirSync(dir).filter(
              (f) => /\.(ts|js|mts|mjs)$/.test(f) && !serverOnly.includes(f.replace(/\.\w+$/, '')),
            )
          : []
        const imports = files
          .map((f, i) => `import c${i} from ${JSON.stringify(join(dir, f))}`)
          .join('\n')
        const entries = files
          .map((f, i) => `${JSON.stringify(basename(f).replace(/\.\w+$/, ''))}: c${i}`)
          .join(', ')
        return `${imports}\nexport const config = { ${entries} }\n`
      }
      return null
    },
    configureServer(server) {
      const rcPath = findRc(root)
      if (rcPath) server.watcher.add(rcPath)
      server.watcher.on('change', (file) => {
        if (file === rcPath) {
          rc = readRc(root)
          const mod = server.moduleGraph.getModuleById('\0virtual:kitr/providers')
          if (mod) server.moduleGraph.invalidateModule(mod)
        }
      })
    },
  }
  plugins.push(core)

  const useStart = options.start ?? rc.packages.includes('@kitr/server')
  const routesDirectory = options.routesDirectory ?? rc.directories.routes ?? 'app/routes'
  const generatedRouteTree =
    options.generatedRouteTree ?? join(rc.directories.app ?? 'app', 'routeTree.gen.ts')
  plugins.push(
    (async () => {
      if (useStart) {
        const { tanstackStart } = await import('@tanstack/react-start/plugin/vite')
        const startOptions = typeof useStart === 'object' ? useStart : {}
        // Start resolves router paths relative to srcDirectory; the router plugin resolves them from the project root.
        const srcDirectory = rc.directories.app ?? 'app'
        const rel = (p: string) =>
          p.startsWith(`${srcDirectory}/`) ? p.slice(srcDirectory.length + 1) : p
        return tanstackStart({
          srcDirectory,
          router: {
            routesDirectory: rel(routesDirectory),
            generatedRouteTree: rel(generatedRouteTree),
            ...options.router,
          },
          ...readPrerender(root, rc.directories.config ?? 'config'),
          // Vite 8's SSR environment has `dispatchFetch`, which Start reads as "someone else serves dev";
          // nobody does, so ask Start to mount its own dev middleware.
          vite: { installDevServerMiddleware: true, ...(startOptions.vite as object | undefined) },
          ...startOptions,
        } as any)
      }
      const { tanstackRouter } = await import('@tanstack/router-plugin/vite')
      return tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
        routesDirectory,
        generatedRouteTree,
        ...options.router,
      } as any)
    })(),
  )
  if (options.react !== false) {
    plugins.push(import('@vitejs/plugin-react').then((m) => m.default()).catch(() => null))
  }
  const useTailwind = options.tailwind ?? rc.packages.includes('@kitr/tailwind')
  if (useTailwind)
    plugins.push(import('@tailwindcss/vite').then((m) => m.default()).catch(() => null))
  return plugins
}

export default kitr

function findRc(root: string): string | undefined {
  for (const name of ['kitrrc.ts', 'kitrrc.mts', 'kitrrc.js', 'kitrrc.mjs']) {
    const p = resolve(root, name)
    if (existsSync(p)) return p
  }
  return undefined
}

/** Static read of kitrrc.ts: `import('...')` specs under `providers:` and the `packages` list. No execution needed. */
export function readRc(root: string): RcInfo {
  const path = findRc(root)
  const info: RcInfo = {
    packages: [],
    providers: [],
    directories: {
      app: 'app',
      routes: 'app/routes',
      config: 'config',
      components: 'app/components',
      stubs: 'stubs',
    },
  }
  if (!path) return info
  const src = readFileSync(path, 'utf8')
  const providersBlock = src.match(/providers\s*:\s*\[([\s\S]*?)\n\s*\]/)?.[1] ?? ''
  info.providers = [...providersBlock.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map(
    (m) => m[1]!,
  )
  const packagesBlock = src.match(/packages\s*:\s*\[([\s\S]*?)\]/)?.[1] ?? ''
  info.packages = [...packagesBlock.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]!)
  const dirs = src.match(/directories\s*:\s*\{([\s\S]*?)\}/)?.[1] ?? ''
  for (const m of dirs.matchAll(/(\w+)\s*:\s*['"]([^'"]+)['"]/g)) info.directories[m[1]!] = m[2]!
  return info
}

const blessed = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  '@tanstack/react-router',
  '@tanstack/react-query',
  '@tanstack/react-table',
  'react-hook-form',
  '@hookform/resolvers/standard-schema',
  'zustand',
  'ky',
  'sonner',
  'clsx',
  'tailwind-merge',
  'class-variance-authority',
  'partysocket/ws',
  'socket.io-client',
]

function blessedDeps(root: string): string[] {
  try {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    return blessed.filter(
      (d) =>
        d
          .split('/')
          .slice(0, d.startsWith('@') ? 2 : 1)
          .join('/') in deps,
    )
  } catch {
    return []
  }
}

/**
 * Static read of `config/ssr.ts`: `prerender: ['/a']` or `{ routes: [...], crawlLinks }` becomes
 * Start's `pages` + `prerender`, and `site.url` turns on the sitemap. No execution needed.
 */
export function readPrerender(
  root: string,
  configDir: string,
): {
  pages?: Array<{ path: string }>
  prerender?: Record<string, unknown>
  sitemap?: Record<string, unknown>
} {
  const path = resolve(root, configDir, 'ssr.ts')
  if (!existsSync(path)) return {}
  const src = readFileSync(path, 'utf8')
  const block = src.match(/prerender\s*:\s*(\{[\s\S]*?\}|\[[\s\S]*?\])/)?.[1]
  if (!block) return {}
  const list = block.startsWith('[')
    ? block
    : (block.match(/routes\s*:\s*(\[[\s\S]*?\])/)?.[1] ?? '[]')
  const routes = [...list.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]!)
  if (!routes.length) return {}
  const crawlLinks = /crawlLinks\s*:\s*true/.test(block)
  const host = src.match(/site\s*:\s*\{[\s\S]*?url\s*:\s*['"]([^'"]+)['"]/)?.[1]
  return {
    pages: routes.map((p) => ({ path: p })),
    prerender: { enabled: true, crawlLinks, autoSubfolderIndex: true },
    ...(host ? { sitemap: { enabled: true, host } } : {}),
  }
}
