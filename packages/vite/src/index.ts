import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { PackageDefinition, PackageViteNeeds } from '@kitr/core/package'
import { pickPackageDefinition, resolvePackageName, shortPackageName } from '@kitr/core/package'
import type { Plugin, PluginOption } from 'vite'

/** Options for `kitr()` in `vite.config.ts`. All optional: the rest comes from `kitrrc.ts`. */
export interface KitrPluginOptions {
  /** Project root. Default: Vite's root. */
  root?: string
  /** Use TanStack Start (SSR, prerender, server functions). Default: when an installed package asks for it (`router` does). */
  start?: boolean | Record<string, unknown>
  /**
   * Leave out the Vite plugin a package declares, by its short name: `{ tailwind: false }` skips
   * `@kitr/tailwind/vite`, `{ react: false }` skips `@vitejs/plugin-react`. Default: every declared plugin.
   */
  plugins?: Record<string, boolean>
  /** Route files directory. Default `app/routes`. */
  routesDirectory?: string
  generatedRouteTree?: string
  /** Extra options for @tanstack/router-plugin. */
  router?: Record<string, unknown>
  /**
   * Include `@kitr/devtools/provider`. Default: always in development; in production builds only
   * when `config/devtools.ts` sets `enabled`.
   */
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

/**
 * What the installed packages ask of the build, read from their setup modules (`<package>/kitr`,
 * the module `kitr add` ran). The plugin knows no package by name: a package that needs a Vite
 * plugin, pre-bundled deps, a server-only config file or TanStack Start says so there.
 */
interface PackageNeeds {
  /** Full package name, as listed in kitrrc.ts. */
  package: string
  /** Short name: `config/<name>.ts`, the `plugins` option key. */
  name: string
  needs: PackageViteNeeds
}

const needsCache = new Map<string, Promise<PackageNeeds | undefined>>() // kitr-allow-module-state: cache of package metadata read from disk, keyed by project root and package; the Vite process serves one project

async function loadPackageNeeds(root: string, pkg: string): Promise<PackageNeeds | undefined> {
  const key = `${root}\0${pkg}`
  let pending = needsCache.get(key)
  if (!pending) {
    pending = (async () => {
      const require = createRequire(resolve(root, 'package.json'))
      let file: string
      try {
        file = require.resolve(`${pkg}/kitr`)
      } catch {
        // Not installed here, or a package without a setup module: nothing to ask of the build.
        return undefined
      }
      const mod = (await import(pathToFileURL(file).href)) as unknown
      const definition: PackageDefinition | undefined =
        pickPackageDefinition(mod) ?? pickPackageDefinition((mod as { default?: unknown }).default)
      if (!definition) return undefined
      return { package: pkg, name: definition.name, needs: definition.vite ?? {} }
    })()
    needsCache.set(key, pending)
  }
  return pending
}

async function loadNeeds(root: string, packages: string[]): Promise<PackageNeeds[]> {
  const all = await Promise.all(packages.map((pkg) => loadPackageNeeds(root, pkg)))
  return all.filter((n): n is PackageNeeds => !!n)
}

/**
 * Static read of `config/<name>.ts`: does it set `enabled` to anything but `false`? A literal
 * `true` turns the package on; an expression (`process.env.DEBUG === '1'`) is decided at runtime,
 * so the code has to ship for it. Absent or `false`: no.
 */
export function configEnables(configDir: string, name: string): boolean {
  const file = ['ts', 'mts', 'js', 'mjs']
    .map((ext) => join(configDir, `${name}.${ext}`))
    .find(existsSync)
  if (!file) return false
  const value = stripComments(readFileSync(file, 'utf8')).match(/\benabled\s*:\s*([^,}\n]+)/)?.[1]
  return value !== undefined && value.trim() !== 'false'
}

/** Does a provider spec (`@kitr/devtools/provider`) belong to this package? */
function providerOf(spec: string, pkg: string): boolean {
  return spec === pkg || spec.startsWith(`${pkg}/`)
}

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
  /** Packages left out of this build (`without` in kitrrc.ts), as full names (`@kitr/analytics`). */
  without: string[]
}

function pickPlatform(rc: RcInfo, wanted: string | undefined): ActivePlatform | undefined {
  const entries = Object.entries(rc.platforms)
  const pick = wanted
    ? entries.find(([n]) => n === wanted)
    : (entries.find(([, p]) => p.factory === 'web') ??
      entries.find(([, p]) => p.factory !== 'server'))
  // No platforms at all: a project that wires Vite itself. A wrong name is an error.
  if (wanted && !pick && entries.length)
    throw new Error(
      `[@kitr/vite] KITR_PLATFORM=${wanted} is not a platform in kitrrc.ts (have: ${entries.map(([n]) => n).join(', ') || 'none'})`,
    )
  if (!pick) return undefined
  const [name, p] = pick
  const options = p.options ?? {}
  const mode: WebMode = p.factory === 'web' ? (options.mode ?? 'spa') : 'spa'
  const without = Array.isArray(options.without)
    ? options.without
        .filter((w: unknown): w is string => typeof w === 'string')
        .map(resolvePackageName)
    : []
  return { name, type: p.factory, mode, options, without }
}

/** `config/<name>.ts` files (no folders, no generated index), by name. */
function configFiles(dir: string): Map<string, string> {
  const out = new Map<string, string>()
  if (!existsSync(dir)) return out
  for (const f of readdirSync(dir).sort()) {
    if (!/\.(ts|js|mts|mjs)$/.test(f) || /^index\.\w+$/.test(f)) continue
    if (!statSync(join(dir, f)).isFile()) continue
    out.set(f.replace(/\.\w+$/, ''), join(dir, f))
  }
  return out
}

/**
 * The config files one build imports, by name: every shared `config/<name>.ts`, replaced by
 * `config/<platform>/<name>.ts` where that exists, minus the names in `dropped` (the packages
 * the platform leaves out, server-only files in a browser bundle).
 */
function platformConfigFiles(
  dir: string,
  platform: { name: string } | undefined,
  dropped: string[] = [],
): Map<string, string> {
  const files = configFiles(dir)
  if (platform)
    for (const [name, file] of configFiles(join(dir, platform.name)))
      if (files.has(name)) files.set(name, file)
  for (const name of dropped) files.delete(name)
  return files
}

/**
 * The kitr() Vite plugin. It reads `kitrrc.ts` and the installed packages' `vite` declarations
 * at build time and:
 * - wires TanStack Start (or the router plugin) and every plugin a package declares (React, Tailwind),
 * - exposes `virtual:kitr/providers` and `virtual:kitr/config` as static imports,
 * - pre-declares `optimizeDeps` from the packages' lists so dev start never rediscovers,
 * - sets the active platform's port, outDir and the `#app`-style aliases.
 */
export function kitr(options: KitrPluginOptions = {}): PluginOption[] {
  let root = options.root ?? defaultRoot()
  let rc = readRc(root)
  let production = false
  const wantedPlatform = options.platform ?? process.env.KITR_PLATFORM
  let platform = pickPlatform(rc, wantedPlatform)
  const plugins: PluginOption[] = []
  let needs = loadNeeds(root, rc.packages)
  /** What the prerender asked for and wrote, once Start is set up with it. */
  let guard: PrerenderGuard | undefined
  /** Config files the installed packages keep out of browser bundles. */
  let serverOnlyConfig: string[] = []
  /** Packages whose provider never ships in a production build. */
  let devOnlyProviders: string[] = []
  let serverOnlyProviders: string[] = []
  let devtoolsShipped = false
  /** Short name (`config/<name>.ts`) of each installed package, by full package name. */
  let configNames = new Map<string, string>()
  const configNamesOf = (p: ActivePlatform | undefined) =>
    (p?.without ?? []).map((pkg) => configNames.get(pkg) ?? shortPackageName(pkg))

  const core: Plugin = {
    name: 'kitr',
    enforce: 'pre',
    async config(config, env) {
      production = env.command === 'build' && env.mode === 'production'
      const nextRoot = options.root ?? config.root ?? process.cwd()
      if (nextRoot !== root) {
        root = nextRoot
        rc = readRc(root)
        needs = loadNeeds(root, rc.packages)
      }
      platform = pickPlatform(rc, wantedPlatform)
      const declared = await needs
      serverOnlyConfig = declared.filter((n) => n.needs.serverOnlyConfig).map((n) => n.name)
      configNames = new Map(declared.map((n) => [n.package, n.name]))
      const configDir = resolve(root, rc.directories.config ?? 'config')
      devOnlyProviders = declared
        .filter((n) => n.needs.provider?.production === false)
        // `enabled: true` (or any expression but `false`) in its config ships it after all.
        .filter((n) => !(options.devtools ?? configEnables(configDir, n.name)))
        .map((n) => n.package)
      serverOnlyProviders = declared
        .filter((n) => n.needs.provider?.client === false)
        .map((n) => n.package)
      // Packages guard their devtools panels with `__KITR_DEVTOOLS__`, so a production build without
      // the overlay ships no panel chunks at all.
      devtoolsShipped =
        !production ||
        (rc.packages.includes('@kitr/devtools') && !devOnlyProviders.includes('@kitr/devtools'))
      const include = installedDeps(
        root,
        declared.flatMap((n) => n.needs.optimizeDeps ?? []),
      )
      const port = platform?.options.port
      // Tauri's webview sees TAURI_ENV_* at build time; every native shell wants a fixed port.
      const shell =
        platform?.type === 'desktop' || platform?.type === 'tauri'
          ? {
              clearScreen: false,
              ...(platform.type === 'tauri' ? { envPrefix: ['VITE_', 'TAURI_ENV_*'] } : {}),
            }
          : {}
      return {
        ...shell,
        ...(typeof port === 'number'
          ? { server: { port, strictPort: true }, preview: { port } }
          : {}),
        ...(platform ? { build: { outDir: `dist/${platform.name}` } } : {}),
        // web({ base: '/admin/' }): asset URLs must carry it, unless vite.config.ts set its own.
        ...(config.base === undefined &&
        typeof platform?.options.base === 'string' &&
        platform.options.base !== '/'
          ? { base: platform.options.base.replace(/\/?$/, '/') }
          : {}),
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
          __KITR_DEVTOOLS__: JSON.stringify(devtoolsShipped),
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
        const dropped = (spec: string) => devOnlyProviders.some((pkg) => providerOf(spec, pkg))
        const left = (spec: string) => !!platform?.without.some((pkg) => providerOf(spec, pkg))
        // Server-only providers (mail, jobs, cache...) return at once in a browser; the browser
        // bundle leaves them out so their dependencies never reach it. The SSR build keeps them.
        const serverOnly = (spec: string) =>
          !loadOptions?.ssr && serverOnlyProviders.some((pkg) => providerOf(spec, pkg))
        const specs = (
          options.devtools === false || production
            ? rc.providers.filter((spec) => !dropped(spec))
            : rc.providers
        )
          .filter((spec) => !left(spec))
          .filter((spec) => !serverOnly(spec))
        const imports = specs
          .map((spec, i) => `import p${i} from ${JSON.stringify(spec)}`)
          .join('\n')
        return `${imports}\nexport const providers = [${specs.map((_, i) => `p${i}`).join(', ')}]\n`
      }
      if (id === '\0virtual:kitr/config') {
        const dir = resolve(root, rc.directories.config ?? 'config')
        // Server-only config (config/server.ts imports Node APIs) never reaches the browser bundle.
        const serverOnly = loadOptions?.ssr ? [] : serverOnlyConfig
        // `config/<platform>/<name>.ts` replaces the shared file; `without` drops the package's file.
        const files = [
          ...platformConfigFiles(dir, platform, [...serverOnly, ...configNamesOf(platform)]),
        ]
        const imports = files
          .map(([, file], i) => `import c${i} from ${JSON.stringify(file)}`)
          .join('\n')
        const entries = files.map(([name], i) => `${JSON.stringify(name)}: c${i}`).join(', ')
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
      const invalidate = (ids: string[]) => {
        for (const id of ids) {
          const mod = server.moduleGraph.getModuleById(id)
          if (mod) server.moduleGraph.invalidateModule(mod)
        }
      }
      const configDir = () => resolve(root, rc.directories.config ?? 'config')
      // A file added to or removed from config/ or config/<platform>/ changes which files ship.
      const platformDir = () => (platform ? join(configDir(), platform.name) : undefined)
      server.watcher.add(configDir())
      if (platformDir()) server.watcher.add(platformDir()!)
      const onConfigFile = (file: string) => {
        const parent = dirname(file)
        if (parent === configDir() || parent === platformDir())
          invalidate(['\0virtual:kitr/config'])
      }
      server.watcher.on('add', onConfigFile)
      server.watcher.on('unlink', onConfigFile)
      server.watcher.on('change', (file) => {
        if (file === rcPath) {
          rc = readRc(root)
          platform = pickPlatform(rc, wantedPlatform)
          invalidate(['\0virtual:kitr/providers', '\0virtual:kitr/config'])
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
            server.config.logger.error(`[@kitr/vite] ${(error as Error).message}`)
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
  // prerenders every page, `spa` (and desktop/mobile shells) ship one prerendered shell. The
  // router package asks for it; `start: false` keeps the plain router plugin.
  plugins.push(
    needs.then(async (declared) => {
      const wantsStart = declared.some((n) => n.needs.start)
      const useStart = options.start ?? wantsStart
      // Pages defined in the route table (`defineRoutes([router], ...)`) leave no app/routes
      // folder. TanStack's generator still has to crawl one, so it gets a stub root under .kitr.
      const fileRoutes = options.routesDirectory ?? rc.directories.routes ?? 'app/routes'
      // A root file route marks a file-routes project; an empty or missing directory does not.
      const codeRoutes =
        !options.routesDirectory && !existsSync(resolve(root, fileRoutes, '__root.tsx'))
      const routesDirectory = codeRoutes ? routeShim(root) : fileRoutes
      const generatedRouteTree =
        options.generatedRouteTree ??
        (codeRoutes
          ? '.kitr/routeTree.gen.ts'
          : join(rc.directories.app ?? 'app', 'routeTree.gen.ts'))
      if (useStart) {
        const { tanstackStart } = await import('@tanstack/react-start/plugin/vite')
        const startOptions = typeof useStart === 'object' ? useStart : {}
        // Start resolves router paths relative to srcDirectory; the router plugin resolves them from the project root.
        const srcDirectory = rc.directories.app ?? 'app'
        const rel = (p: string) =>
          p.startsWith(`${srcDirectory}/`)
            ? p.slice(srcDirectory.length + 1)
            : `${'../'.repeat(srcDirectory.split('/').filter(Boolean).length)}${p}`
        const { failOnError, ...seo } = readPrerender(root, rc.directories.config ?? 'config')
        const mode = platform?.mode ?? 'ssr'
        const pages =
          mode === 'static'
            ? [{ path: '/' }, ...(seo.pages ?? []).filter((p) => p.path !== '/')]
            : (seo.pages ?? [])
        // Failures are ours to report (see prerenderGuard), so Start is told to carry on.
        guard =
          mode === 'spa' || (mode !== 'static' && !seo.prerender)
            ? undefined
            : prerenderGuard({ routes: pages.map((p) => p.path), failOnError })
        const hooks = guard
          ? { filter: guard.filter, onSuccess: guard.onSuccess, failOnError: false }
          : {}
        const modeOptions =
          mode === 'spa'
            ? { spa: { enabled: true, prerender: { outputPath: '/index.html' } } }
            : mode === 'static'
              ? {
                  pages,
                  prerender: {
                    enabled: true,
                    crawlLinks: true,
                    autoSubfolderIndex: true,
                    ...seo.prerender,
                    ...hooks,
                  },
                  ...(seo.sitemap ? { sitemap: seo.sitemap } : {}),
                }
              : seo.prerender
                ? { ...seo, prerender: { ...seo.prerender, ...hooks } }
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
      // No routes without the router package; a plain Vite app brings its own plugins.
      if (!wantsStart && !options.router) return null
      const { tanstackRouter } = await import('@tanstack/router-plugin/vite')
      return tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
        routesDirectory,
        generatedRouteTree,
        ...options.router,
      } as any)
    }),
  )
  // The plugins the installed packages declare (`@vitejs/plugin-react` by react, `@kitr/tailwind/vite`
  // by tailwind), resolved from the project so each comes from the copy the project installed.
  plugins.push(
    needs.then(async (declared) => {
      const require = createRequire(resolve(root, 'package.json'))
      const out: PluginOption[] = []
      for (const { name, needs: n } of declared) {
        if (!n.plugin || options.plugins?.[name] === false) continue
        try {
          const mod = (await import(pathToFileURL(require.resolve(n.plugin)).href)) as {
            default?: (...args: unknown[]) => PluginOption
          }
          if (typeof mod.default === 'function') out.push(mod.default())
        } catch (error) {
          console.warn(
            `[@kitr/vite] ${name}: its Vite plugin ${n.plugin} could not load (${(error as Error).message})`,
          )
        }
      }
      return out
    }),
  )
  // After Start's prerender (its `buildApp` hook is also `post`, and comes first in this list):
  // report the pages that failed, and give a static site its 404.html.
  plugins.push({
    name: 'kitr:prerender',
    apply: 'build',
    enforce: 'post',
    buildApp: {
      order: 'post',
      async handler(builder) {
        const env = (name: string) => builder.environments[name]?.config
        const client = env('client')
        const server = env('ssr')
        const notFoundPage = platform?.mode === 'static'
        if (!client || !server || (!guard && !notFoundPage)) return
        await finishPrerender({
          guard,
          clientDir: resolve(client.root, client.build.outDir),
          serverEntry: resolve(server.root, server.build.outDir, 'server.js'),
          notFoundPage,
          logger: builder.config.logger,
        })
      },
    },
  })
  // robots.txt from `robots` in config/seo.ts, for web builds that ship no public/robots.txt.
  plugins.push({
    name: 'kitr:robots',
    apply: 'build',
    async generateBundle() {
      const env = (
        this as { environment?: { name: string; config?: { publicDir?: string | false } } }
      ).environment
      if (env && env.name !== 'client') return
      if (platform && platform.type !== 'web') return
      const publicDir = env?.config?.publicDir ?? resolve(root, 'public')
      if (publicDir && existsSync(resolve(publicDir, 'robots.txt'))) return
      const text = await robotsFor(root, rc.directories.config ?? 'config').catch((error) => {
        this.warn(`config/seo.ts: robots.txt not written (${(error as Error).message})`)
        return null
      })
      if (text) this.emitFile({ type: 'asset', fileName: 'robots.txt', source: text })
    },
  })

  if (platform?.type === 'web' && platform.options.pwa) {
    const active = platform
    plugins.push(
      (async () => {
        // The web platform's installable build lives next to the platform, not in this plugin.
        const require = createRequire(resolve(root, 'package.json'))
        const mod = (await import(pathToFileURL(require.resolve('@kitr/web/vite')).href)) as {
          kitrPwa: (options: unknown, appName: string) => PluginOption
        }
        return mod.kitrPwa(active.options, appName(root))
      })().catch((error) => {
        console.warn(
          `[@kitr/vite] ${active.name}: pwa is on but vite-plugin-pwa could not load (${(error as Error).message})`,
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
      const parts = name.trim().split(/\bas\b/)
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

/** The declared pre-bundle list, narrowed to what package.json installs, so dev never asks for a missing dep. */
function installedDeps(root: string, wanted: string[]): string[] {
  try {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    return [...new Set(wanted)].filter(
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
 * The robots.txt for a project: `robotsTxt()` from @kitr/seo over `config/seo.ts`, or null when
 * there is no config/seo.ts or it sets `robots: false`.
 */
export async function robotsFor(root: string, configDir = 'config'): Promise<string | null> {
  const path = resolve(root, configDir, 'seo.ts')
  if (!existsSync(path)) return null
  const { createJiti } = await import('jiti')
  const jiti = createJiti(resolve(root, 'package.json'))
  const config = await jiti.import<Record<string, unknown>>(path, { default: true })
  const seo = await jiti
    .import<{ robotsTxt: (c: unknown) => string | null }>('@kitr/seo')
    .catch(() => jiti.import<{ robotsTxt: (c: unknown) => string | null }>('@kitr/seo'))
  return seo.robotsTxt(config ?? {})
}

/**
 * Start's crawler treats `/docs/a#install` and `/docs/a` as two pages: it renders the same file
 * once per anchor and lists every anchor in the sitemap. This keeps one page per path: a hash is
 * dropped, and a path already taken is skipped and left out of the sitemap.
 */
export function crawlFilter(): (page: {
  path: string
  sitemap?: { exclude?: boolean }
}) => boolean {
  const taken = new Set<string>()
  return (page) => {
    const path = page.path.split('#')[0] || '/'
    page.path = path
    if (taken.has(path)) {
      page.sitemap = { ...page.sitemap, exclude: true }
      return false
    }
    taken.add(path)
    return true
  }
}

/**
 * Static read of `config/seo.ts`: `prerender: ['/a']` or `{ routes: [...], crawlLinks }` becomes
 * Start's `pages` + `prerender`, and `site.url` turns on the sitemap. `failOnError: true` comes
 * back beside them, for `prerenderGuard`. No execution needed.
 */
export function readPrerender(
  root: string,
  configDir: string,
): {
  pages?: Array<{ path: string }>
  prerender?: Record<string, unknown>
  sitemap?: Record<string, unknown>
  failOnError?: boolean
} {
  const path = [resolve(root, configDir, 'seo.ts'), resolve(root, configDir, 'ssr.ts')].find(
    existsSync,
  )
  if (!path) return {}
  const src = readFileSync(path, 'utf8')
  const host = src.match(/site\s*:\s*\{[\s\S]*?url\s*:\s*['"]([^'"]+)['"]/)?.[1]
  const sitemap = host ? { sitemap: { enabled: true, host } } : {}
  const block = src.match(/prerender\s*:\s*(\{[\s\S]*?\}|\[[\s\S]*?\])/)?.[1]
  if (!block) return sitemap
  const strict = /failOnError\s*:\s*true/.test(block) ? { failOnError: true } : {}
  const list = block.startsWith('[')
    ? block
    : (block.match(/routes\s*:\s*(\[[\s\S]*?\])/)?.[1] ?? '[]')
  const routes = [...list.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]!)
  if (!routes.length) return { ...sitemap, ...strict }
  const crawlLinks = /crawlLinks\s*:\s*true/.test(block)
  return {
    pages: routes.map((p) => ({ path: p })),
    prerender: { enabled: true, crawlLinks, autoSubfolderIndex: true },
    ...sitemap,
    ...strict,
  }
}

/** A page the prerender asked for and did not write. */
export interface PrerenderFailure {
  /** The page's path, without its `#hash`. */
  path: string
  /** The first page whose HTML linked to it; missing for a page only the config lists. */
  from?: string
  /** Listed in `config/seo.ts` `prerender.routes` (or `/` on a static site), not crawled. */
  listed: boolean
}

/** The `filter` and `onSuccess` hooks `prerenderGuard()` hands Start, and what they saw. */
export interface PrerenderGuard {
  /** Start's `prerender.filter`: drops anchors and repeats, and notes every page it lets through. */
  filter(page: { path: string; sitemap?: { exclude?: boolean } }): boolean
  /** Start's `prerender.onSuccess`: notes the page as written and which pages it links to. */
  onSuccess(result: { page: { path: string; sitemap?: { exclude?: boolean } }; html: string }): void
  /** Pages that passed the filter and were never written. */
  failures(): PrerenderFailure[]
  /** Fail the build for crawled pages too (`prerender.failOnError` in `config/seo.ts`). */
  failOnError: boolean
}

/** Drop trailing slashes. A loop, since `/\\/+$/` backtracks quadratically on long runs of `/`. */
function stripTrailingSlashes(s: string): string {
  let end = s.length
  while (end > 0 && s.charCodeAt(end - 1) === 47) end--
  return s.slice(0, end)
}

const trimSlash = (path: string) => (path.length > 1 ? stripTrailingSlashes(path) : path)

const robotsNoindex =
  /<meta\b(?=[^>]*\bname=["']robots["'])(?=[^>]*\bcontent=["'][^"']*\bnoindex\b)[^>]*>/i

/**
 * Whether a prerendered page belongs in the sitemap: an HTML page (a path with no extension, or
 * `.html`) whose head does not carry `<meta name="robots" content="noindex">`. A `/docs/x.md`
 * "view as markdown" file, `llms.txt` or a JSON feed is written like any other page but is not a
 * page to list.
 */
export function indexable(path: string, html: string): boolean {
  const last = path.split('/').pop() ?? ''
  if (/\.[a-z0-9]+$/i.test(last) && !/\.html?$/i.test(last)) return false
  return !robotsNoindex.test(html)
}

/**
 * Start's prerender throws on the first page that does not answer 200, and the build dies with a
 * dump of the `Response`. Start runs with `failOnError: false` instead, and this keeps the record:
 * `filter` (crawlFilter, plus a note of every page asked for) holds each page out of the sitemap,
 * `onSuccess` puts it back when `indexable` (an HTML page without `noindex`) and notes which page
 * links where, and `failures()` is the difference, for `finishPrerender` to print and fail on.
 */
export function prerenderGuard(options: {
  routes: string[]
  failOnError?: boolean
}): PrerenderGuard {
  const dedupe = crawlFilter()
  const listed = new Set(options.routes.map(trimSlash))
  const asked = new Map<string, { exclude?: boolean } | undefined>()
  const written = new Set<string>()
  const linkedFrom = new Map<string, string>()
  return {
    failOnError: options.failOnError ?? false,
    filter(page) {
      if (!dedupe(page)) return false
      asked.set(page.path, page.sitemap)
      page.sitemap = { ...page.sitemap, exclude: true }
      return true
    },
    onSuccess({ page, html }) {
      written.add(page.path)
      if (asked.has(page.path) && indexable(page.path, html)) {
        const sitemap = asked.get(page.path)
        if (sitemap) page.sitemap = sitemap
        else delete page.sitemap
      }
      // The links Start's crawler follows: root-relative hrefs on <a>.
      for (const [tag] of html.matchAll(/<a\s[^<>]*>/g)) {
        const href = /\shref=["'](\/[^"']*)["']/.exec(tag)?.[1]
        if (href === undefined) continue
        const path = href.split('#')[0] || '/'
        if (!linkedFrom.has(path)) linkedFrom.set(path, page.path)
      }
    },
    failures() {
      return [...asked.keys()]
        .filter((path) => !written.has(path))
        .map((path) => {
          const from = linkedFrom.get(path)
          return { path, ...(from ? { from } : {}), listed: listed.has(trimSlash(path)) }
        })
    },
  }
}

/**
 * After Start's prerender: print one line per page that failed (`[prerender] 404 at /x, linked
 * from /y`), with the status asked again of the built server, and fail the build when a listed
 * route failed or `failOnError` is on. A static site also gets `404.html`: the root's
 * `notFoundComponent`, rendered for a path no route matches, which Cloudflare Pages, Netlify and
 * GitHub Pages serve for unknown paths. It is written here because Start's prerender refuses a
 * page that answers 404, and so it is never crawled or listed in the sitemap.
 */
export async function finishPrerender(options: {
  guard?: PrerenderGuard
  clientDir: string
  serverEntry: string
  /** Also write `404.html` (a `static` site). */
  notFoundPage?: boolean
  logger: { warn(msg: string): void; error(msg: string): void }
}): Promise<void> {
  const failures = options.guard?.failures() ?? []
  let handler: ((request: Request) => Response | Promise<Response>) | undefined
  if ((failures.length || options.notFoundPage) && existsSync(options.serverEntry)) {
    const mod = (await import(pathToFileURL(options.serverEntry).href)) as Record<string, any>
    const server = mod.default?.fetch ? mod.default : mod
    if (typeof server.fetch === 'function') handler = (request) => server.fetch(request)
  }
  const render = async (path: string) => {
    try {
      return await handler?.(new Request(new URL(path, 'http://localhost')))
    } catch {
      return undefined
    }
  }
  if (options.notFoundPage) {
    const res = await render('/404')
    if (res?.headers.get('content-type')?.includes('html'))
      writeFileSync(resolve(options.clientDir, '404.html'), await res.text())
    else options.logger.warn('[prerender] 404.html not written: the server rendered no page')
  }
  const fatal: string[] = []
  for (const failure of failures) {
    const status = (await render(failure.path))?.status
    const at = `${status && status !== 200 ? status : 'failed'} at ${failure.path}`
    const line = `[prerender] ${at}${failure.from ? `, linked from ${failure.from}` : ''}`
    if (failure.listed || options.guard?.failOnError) {
      options.logger.error(line)
      fatal.push(failure.path)
    } else options.logger.warn(line)
  }
  if (!fatal.length) return
  const error = new Error(
    `prerender failed for ${fatal.join(', ')}: ${
      options.guard?.failOnError
        ? '`prerender.failOnError` is on in config/seo.ts.'
        : 'routes listed in config/seo.ts must render; crawled links only warn.'
    }`,
  )
  // The lines above say where; a stack into the plugin says nothing more.
  error.stack = `${error.name}: ${error.message}`
  throw error
}

/**
 * `.kitr/routes/__root.tsx`: the one file route a code-defined table needs, so TanStack's route
 * generator (which Start always runs) has a tree to crawl. The router itself builds the real
 * tree from `app/routes.ts`; nothing imports this stub. Returns the directory, project-relative.
 */
function routeShim(root: string): string {
  const dir = '.kitr/routes'
  const file = resolve(root, dir, '__root.tsx')
  if (!existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(
      file,
      "// Generated by @kitr/vite: TanStack's route generator needs a root file route to crawl. The\n// real tree comes from app/routes.ts. Do not edit; safe to delete.\nimport { createRootRoute } from '@tanstack/react-router'\n\nexport const Route = createRootRoute()\n",
    )
  }
  return dir
}
