import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
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
  /** Which platform from kitrrc.ts this build is for. Default: `KITR_PLATFORM` (set by `kitr dev|build <name>`), else the first web platform. */
  platform?: string
  /**
   * Run `kitr types` when the build starts and again in dev whenever a watched file changes, so
   * `.kitr/` is always current. Needs `@kitr/cli` installed (it is, in every kitr project).
   * Default true.
   */
  types?: boolean
}

interface TypesRunner {
  globs: string[]
  generatorsFor(file: string): string[]
  run(only?: string[]): Promise<unknown>
}

/**
 * The `kitr types` runner from `@kitr/cli`, loaded lazily so the plugin itself stays light and a
 * project without the CLI (a bare Vite setup) still builds; such a project runs `kitr types` itself.
 */
async function loadTypesRunner(root: string): Promise<TypesRunner | undefined> {
  let cli: typeof import('@kitr/cli')
  try {
    cli = await import('@kitr/cli')
  } catch {
    return undefined
  }
  const ctx = cli.createContext({ root })
  const generators = await cli.loadGenerators(ctx)
  const rc = ctx.readRc()
  return {
    globs: cli.watchGlobsOf(generators, rc),
    generatorsFor: (file) => cli.generatorsFor(generators, rc, file).map((g) => g.name),
    run: (only) => cli.runTypes(ctx, { only, quiet: true }, generators),
  }
}

/** Config files whose packages import Node built-ins; kept out of client builds. */
const SERVER_ONLY_CONFIG = ['server', 'api', 'db', 'cache', 'shield', 'jobs', 'mail', 'uploads']

interface RcPlatform {
  factory: string
  source?: string
  options?: Record<string, any>
}

interface RcInfo {
  packages: string[]
  providers: string[]
  directories: Record<string, string>
  platforms: Record<string, RcPlatform>
}

type WebMode = 'static' | 'spa' | 'ssr'

/** The platform this Vite process builds for, and what it means for Start. */
interface ActivePlatform {
  name: string
  type: string
  mode: WebMode
  options: Record<string, any>
}

function pickPlatform(rc: RcInfo, wanted: string | undefined): ActivePlatform | undefined {
  const entries = Object.entries(rc.platforms)
  const pick = wanted
    ? entries.find(([n]) => n === wanted)
    : (entries.find(([, p]) => p.factory === 'web') ??
      entries.find(([, p]) => p.factory !== 'server'))
  // No platforms at all: a project that wires Vite itself (legacy or custom). A wrong name is an error.
  if (wanted && !pick && entries.length)
    throw new Error(
      `[kitr/vite] KITR_PLATFORM=${wanted} is not a platform in kitrrc.ts (have: ${entries.map(([n]) => n).join(', ') || 'none'})`,
    )
  if (!pick) return undefined
  const [name, p] = pick
  const options = p.options ?? {}
  const mode: WebMode = p.factory === 'web' ? (options.mode ?? 'spa') : 'spa'
  return { name, type: p.factory, mode, options }
}

/**
 * The kitr() Vite plugin. It reads `kitrrc.ts` at build time and:
 * - wires TanStack Router (or Start), React and Tailwind plugins,
 * - exposes `virtual:kitr/providers` and `virtual:kitr/config` as static imports,
 * - pre-declares `optimizeDeps` for the blessed stack so dev start never rediscovers.
 */
export function kitr(options: KitrPluginOptions = {}): PluginOption[] {
  let root = options.root ?? defaultRoot()
  let rc = readRc(root)
  let stripDevtools = false
  const wantedPlatform = options.platform ?? process.env.KITR_PLATFORM
  let platform = pickPlatform(rc, wantedPlatform)
  const plugins: PluginOption[] = []

  const core: Plugin = {
    name: 'kitr',
    enforce: 'pre',
    async config(config, env) {
      stripDevtools =
        options.devtools === false || (env.command === 'build' && env.mode === 'production')
      root = options.root ?? config.root ?? process.cwd()
      rc = readRc(root)
      platform = pickPlatform(rc, wantedPlatform)
      const include = blessedDeps(root)
      const port = platform?.options.port
      // Tauri's webview sees TAURI_ENV_* at build time; every native shell wants a fixed port.
      const shell =
        platform?.type === 'desktop'
          ? {
              clearScreen: false,
              ...(platform.options.shell !== 'electron'
                ? { envPrefix: ['VITE_', 'TAURI_ENV_*'] }
                : {}),
            }
          : {}
      return {
        ...shell,
        ...(typeof port === 'number'
          ? { server: { port, strictPort: true }, preview: { port } }
          : {}),
        ...(platform ? { build: { outDir: `dist/${platform.name}` } } : {}),
        resolve: {
          alias: {
            '#app': resolve(root, rc.directories.app ?? 'app'),
            '#config': resolve(root, rc.directories.config ?? 'config'),
            '#components': resolve(root, rc.directories.components ?? 'app/components'),
            '#server': resolve(root, rc.directories.server ?? 'server'),
            '#kitr': resolve(root, '.kitr'),
          },
        },
        optimizeDeps: { include },
        define: {
          'import.meta.env.KITR_PACKAGES': JSON.stringify(rc.packages),
          'import.meta.env.KITR_PLATFORM': JSON.stringify(platform?.name ?? ''),
          'import.meta.env.KITR_PLATFORM_TYPE': JSON.stringify(platform?.type ?? ''),
        },
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
              (f) =>
                /\.(ts|js|mts|mjs)$/.test(f) &&
                !/^index\.\w+$/.test(f) && // the generated index the standalone server imports
                !serverOnly.includes(f.replace(/\.\w+$/, '')),
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
    async buildStart() {
      if (options.types === false) return
      const types = await loadTypesRunner(root)
      if (!types) return
      try {
        await types.run()
      } catch (error) {
        this.error(error as Error)
      }
    },
    async configureServer(server) {
      const rcPath = findRc(root)
      if (rcPath) server.watcher.add(rcPath)
      server.watcher.on('change', (file) => {
        if (file === rcPath) {
          rc = readRc(root)
          const mod = server.moduleGraph.getModuleById('\0virtual:kitr/providers')
          if (mod) server.moduleGraph.invalidateModule(mod)
        }
      })
      if (options.types === false) return
      const types = await loadTypesRunner(root)
      if (!types) return
      // Generators declare the globs they read; a change to a matching file re-runs just those.
      for (const glob of types.globs) server.watcher.add(resolve(root, glob.split('/')[0]!))
      const pending = new Set<string>()
      let timer: ReturnType<typeof setTimeout> | undefined
      const onChange = (file: string) => {
        const rel = file.startsWith(root)
          ? file
              .slice(root.length + 1)
              .split('\\')
              .join('/')
          : file
        const hit = types.generatorsFor(rel)
        if (!hit.length) return
        for (const name of hit) pending.add(name)
        clearTimeout(timer)
        timer = setTimeout(async () => {
          const only = [...pending]
          pending.clear()
          try {
            await types.run(only)
          } catch (error) {
            server.config.logger.error(`[kitr/vite] ${(error as Error).message}`)
          }
        }, 50)
      }
      server.watcher.on('add', onChange)
      server.watcher.on('change', onChange)
      server.watcher.on('unlink', onChange)
    },
  }
  plugins.push(core)

  // Every UI platform renders through TanStack Start: `ssr` streams on the server, `static`
  // prerenders every page, `spa` (and desktop/mobile shells) ship one prerendered shell.
  const useStart =
    options.start ??
    (rc.packages.includes('@kitr/router') || !!platform || rc.packages.includes('@kitr/server'))
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
        const seo = readPrerender(root, rc.directories.config ?? 'config')
        const mode = platform?.mode ?? 'ssr'
        const modeOptions =
          mode === 'spa'
            ? { spa: { enabled: true, prerender: { outputPath: '/index.html' } } }
            : mode === 'static'
              ? {
                  pages: [{ path: '/' }, ...(seo.pages ?? []).filter((p) => p.path !== '/')],
                  prerender: {
                    enabled: true,
                    crawlLinks: true,
                    autoSubfolderIndex: true,
                    ...seo.prerender,
                  },
                  ...(seo.sitemap ? { sitemap: seo.sitemap } : {}),
                }
              : seo
        return tanstackStart({
          srcDirectory,
          router: {
            routesDirectory: rel(routesDirectory),
            generatedRouteTree: rel(generatedRouteTree),
            ...options.router,
          },
          ...modeOptions,
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
  if (platform?.type === 'web' && platform.options.pwa) {
    const active = platform
    plugins.push(
      import('@kitr/web/vite')
        .then((m) => m.kitrPwa(active.options as any, appName(root)))
        .catch((error) => {
          console.warn(
            `[kitr/vite] ${active.name}: pwa is on but vite-plugin-pwa could not load (${(error as Error).message})`,
          )
          return null
        }),
    )
  }
  return plugins
}

function appName(root: string): string {
  try {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
    return String(pkg.name ?? 'app')
      .replace(/^@[^/]+\//, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (c: string) => c.toUpperCase())
  } catch {
    return 'App'
  }
}

export default kitr

/**
 * The project root before Vite tells us: the working directory when it holds a kitrrc, otherwise the
 * directory of the config file that called `kitr()` (a monorepo running `vitest` from its root reaches
 * every project's config with the repo root as cwd).
 */
function defaultRoot(): string {
  const cwd = process.cwd()
  if (findRc(cwd)) return cwd
  const stack = new Error().stack ?? ''
  for (const m of stack.matchAll(/at (?:.+? \()?(file:\/\/\S+?|\/\S+?)(?:\?\S*)?:\d+:\d+\)?$/gm)) {
    const file = m[1]!.startsWith('file://') ? fileURLToPath(m[1]!) : m[1]!
    if (!/vite\.config|vitest\.config|vitest\.workspace/.test(basename(file))) continue
    // Vite bundles the config into <root>/node_modules/.vite-temp/; walk up to the kitrrc.
    let dir = dirname(file)
    while (dir !== dirname(dir)) {
      if (findRc(dir)) return dir
      dir = dirname(dir)
    }
  }
  return cwd
}

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
      server: 'server',
      platforms: 'platforms',
      stubs: 'stubs',
    },
    platforms: {},
  }
  if (!path) return info
  const src = stripComments(readFileSync(path, 'utf8'))
  const providersBlock = arrayBlock(src, 'providers')
  info.providers = [...providersBlock.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map(
    (m) => m[1]!,
  )
  const packagesBlock = arrayBlock(src, 'packages')
  info.packages = [...packagesBlock.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]!)
  const dirs = src.match(/directories\s*:\s*\{([\s\S]*?)\}/)?.[1] ?? ''
  for (const m of dirs.matchAll(/(\w+)\s*:\s*['"]([^'"]+)['"]/g)) info.directories[m[1]!] = m[2]!
  info.platforms = readRcPlatforms(src)
  return info
}

/** Static read of `platforms: { site: web({ mode: 'ssr' }) }`: names, factories and literal options. */
export function readRcPlatforms(src: string): Record<string, RcPlatform> {
  const out: Record<string, RcPlatform> = {}
  const imports = new Map<string, string>()
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g))
    for (const name of m[1]!.split(',')) {
      const parts = name.trim().split(/\s+as\s+/)
      const local = (parts[1] ?? parts[0])!.trim()
      if (local) imports.set(local, m[2]!)
    }
  const start = src.search(/platforms\s*:\s*\{/)
  if (start < 0) return out
  const open = src.indexOf('{', start)
  let depth = 0
  let end = open
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}' && --depth === 0) {
      end = i
      break
    }
  }
  const block = src.slice(open + 1, end)
  const entry = /(\w+)\s*:\s*(\w+)\s*\(/g
  for (let m = entry.exec(block); m; m = entry.exec(block)) {
    const argStart = m.index + m[0].length
    let d = 1
    let i = argStart
    for (; i < block.length && d > 0; i++) {
      if (block[i] === '(') d++
      else if (block[i] === ')') d--
    }
    const arg = block.slice(argStart, i - 1).trim()
    let options: Record<string, unknown> | undefined
    if (arg) {
      try {
        options = new Function(`return (${arg})`)()
      } catch {}
    }
    out[m[1]!] = { factory: m[2]!, source: imports.get(m[2]!), options }
    entry.lastIndex = i
  }
  return out
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

/** Source without comments, so a commented-out provider is not loaded. Strings are kept intact. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\/|(['"`])(?:\\.|(?!\1)[^\\\n])*\1|\/\/[^\n]*/g, (m, quote) =>
    quote ? m : '',
  )
}

/** The text inside `key: [ ... ]`, with nested brackets balanced (one line or many). */
function arrayBlock(src: string, key: string): string {
  const start = new RegExp(`\\b${key}\\s*:\\s*\\[`).exec(src)
  if (!start) return ''
  let depth = 1
  let i = start.index + start[0].length
  const from = i
  for (; i < src.length && depth > 0; i++) {
    if (src[i] === '[') depth++
    else if (src[i] === ']') depth--
  }
  return src.slice(from, i - 1)
}

/**
 * Static read of `config/seo.ts`: `prerender: ['/a']` or `{ routes: [...], crawlLinks }` becomes
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
  const path = [resolve(root, configDir, 'seo.ts'), resolve(root, configDir, 'ssr.ts')].find(
    existsSync,
  )
  if (!path) return {}
  const src = readFileSync(path, 'utf8')
  const host = src.match(/site\s*:\s*\{[\s\S]*?url\s*:\s*['"]([^'"]+)['"]/)?.[1]
  const block = src.match(/prerender\s*:\s*(\{[\s\S]*?\}|\[[\s\S]*?\])/)?.[1]
  if (!block) return host ? { sitemap: { enabled: true, host } } : {}
  const list = block.startsWith('[')
    ? block
    : (block.match(/routes\s*:\s*(\[[\s\S]*?\])/)?.[1] ?? '[]')
  const routes = [...list.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]!)
  if (!routes.length) return host ? { sitemap: { enabled: true, host } } : {}
  const crawlLinks = /crawlLinks\s*:\s*true/.test(block)
  return {
    pages: routes.map((p) => ({ path: p })),
    prerender: { enabled: true, crawlLinks, autoSubfolderIndex: true },
    ...(host ? { sitemap: { enabled: true, host } } : {}),
  }
}
