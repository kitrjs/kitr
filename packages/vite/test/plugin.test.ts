import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import {
  crawlFilter,
  finishPrerender,
  kitr,
  type PrerenderGuard,
  prerenderGuard,
  readPrerender,
  readRc,
} from '../src'

const packagesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const dirs: string[] = []
/** A project on disk: its files, and the workspace packages linked into node_modules so their setup modules load. */
function project(files: Record<string, string>, link: string[] = []) {
  const dir = mkdtempSync(join(tmpdir(), 'kitr-vite-'))
  dirs.push(dir)
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true })
    writeFileSync(join(dir, path), content)
  }
  for (const name of link) {
    mkdirSync(join(dir, 'node_modules/@kitr'), { recursive: true })
    symlinkSync(join(packagesDir, name), join(dir, 'node_modules/@kitr', name), 'dir')
  }
  return dir
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

const rc = `export default defineKitrConfig({
  packages: ['@kitr/react', '@kitr/query', '@kitr/devtools', '@kitr/http', '@kitr/server'],
  providers: [
    () => import('@kitr/query/provider'),
    // () => import('@kitr/disabled/provider'),
    () => import('@kitr/devtools/provider'),
  ],
  directories: { config: 'settings' },
})`
const linked = ['react', 'query', 'devtools', 'http', 'server']

async function corePlugin(
  root: string,
  env = { command: 'serve' as const, mode: 'development' },
  options = {},
) {
  const plugins = kitr({ root, ...options })
  const core = plugins[0] as Plugin
  const config = await (core.config as any).call({}, { root }, env)
  const load = (id: string, ssr = false) =>
    (core.load as any).call({}, (core.resolveId as any).call({}, id), { ssr })
  return { core, config, load, plugins }
}

describe('readRc', () => {
  it('ignores commented-out providers', () => {
    const root = project({ 'kitrrc.ts': rc })
    expect(readRc(root).providers).toEqual(['@kitr/query/provider', '@kitr/devtools/provider'])
    expect(readRc(root).directories.config).toBe('settings')
  })
})

describe('kitr() plugin', () => {
  it('generates static imports for providers and config files', async () => {
    const root = project(
      {
        'kitrrc.ts': rc,
        'settings/query.ts': 'export default { staleTime: 1 }',
        'settings/http.ts': 'export default {}',
        'settings/notes.md': '# not config',
        'package.json': JSON.stringify({
          dependencies: { react: '1', 'react-dom': '1', ky: '1', '@tanstack/react-query': '1' },
        }),
      },
      linked,
    )
    const { load, config } = await corePlugin(root)
    const providers = load('virtual:kitr/providers')
    expect(providers).toContain(`import p0 from "@kitr/query/provider"`)
    expect(providers).toContain(`import p1 from "@kitr/devtools/provider"`)
    expect(providers).not.toContain('disabled')
    expect(providers).toContain('export const providers = [p0, p1]')
    const cfg = load('virtual:kitr/config')
    expect(cfg).toContain('"query": c')
    expect(cfg).toContain('"http": c')
    expect(cfg).not.toContain('notes')
    // The pre-bundle list comes from the packages' declarations, narrowed to what is installed.
    expect(config.optimizeDeps.include).toEqual([
      'react',
      'react-dom',
      'react/jsx-runtime',
      '@tanstack/react-query',
      'ky',
    ])
    expect(config.resolve.alias['#config']).toBe(join(root, 'settings'))
    expect(config.define['import.meta.env.KITR_PACKAGES']).toBe(
      JSON.stringify([
        '@kitr/react',
        '@kitr/query',
        '@kitr/devtools',
        '@kitr/http',
        '@kitr/server',
      ]),
    )
  })

  it('keeps a package-declared server-only config out of browser bundles', async () => {
    const root = project(
      {
        'kitrrc.ts': rc,
        'settings/server.ts': 'export default {}',
        'settings/query.ts': 'export default {}',
      },
      linked,
    )
    const { load } = await corePlugin(root)
    expect(load('virtual:kitr/config')).not.toContain('"server"')
    expect(load('virtual:kitr/config')).toContain('"query"')
    expect(load('virtual:kitr/config', true)).toContain('"server"')
  })

  it('aliases #kitr to the generated folder and writes it on buildStart', async () => {
    const root = project({
      'kitrrc.ts': `import { web } from '@kitr/web'\nexport default defineKitrConfig({ packages: [], providers: [], platforms: { site: web({ mode: 'spa' }) } })`,
      'package.json': JSON.stringify({ name: 'app' }),
    })
    const { core, config } = await corePlugin(root)
    expect(config.resolve.alias['#kitr']).toBe(join(root, '.kitr'))
    await (core.buildStart as any).call({
      error: (e: Error) => {
        throw e
      },
    })
    expect(readFileSync(join(root, '.kitr/platforms.d.ts'), 'utf8')).toContain(
      "site: { type: 'web'; options: { mode: 'spa' } }",
    )
    const off = await corePlugin(project({ 'package.json': '{}' }), undefined, { types: false })
    await (off.core.buildStart as any).call({})
  })

  it('strips the providers packages mark development-only from production builds only', async () => {
    const root = project({ 'kitrrc.ts': rc }, linked)
    const prod = await corePlugin(root, { command: 'build', mode: 'production' } as any)
    expect(prod.load('virtual:kitr/providers')).not.toContain('devtools')
    expect(prod.load('virtual:kitr/providers')).toContain('query/provider')
    const devBuild = await corePlugin(root, { command: 'build', mode: 'development' } as any)
    expect(devBuild.load('virtual:kitr/providers')).toContain('devtools')
    const forcedOff = await corePlugin(root, { command: 'serve', mode: 'development' } as any, {
      devtools: false,
    })
    expect(forcedOff.load('virtual:kitr/providers')).not.toContain('devtools')
  })

  it('keeps a development-only provider in production when its config enables it', async () => {
    const prodBuild = { command: 'build', mode: 'production' } as any
    const config = (body: string) =>
      project({ 'kitrrc.ts': rc, 'settings/devtools.ts': body }, linked)
    const on = await corePlugin(config('export default defineConfig({ enabled: true })'), prodBuild)
    expect(on.load('virtual:kitr/providers')).toContain('devtools/provider')
    const decidedAtRuntime = await corePlugin(
      config(`export default defineConfig({ enabled: import.meta.env.VITE_DEBUG === '1' })`),
      prodBuild,
    )
    expect(decidedAtRuntime.load('virtual:kitr/providers')).toContain('devtools/provider')
    const off = await corePlugin(
      config('export default defineConfig({\n  // enabled: true,\n  enabled: false })'),
      prodBuild,
    )
    expect(off.load('virtual:kitr/providers')).not.toContain('devtools')
    const forced = await corePlugin(config('export default {}'), prodBuild, { devtools: true })
    expect(forced.load('virtual:kitr/providers')).toContain('devtools/provider')
  })

  it('loads the plugins packages declare and lets `plugins` leave one out', async () => {
    const root = project(
      {
        'kitrrc.ts': `export default defineKitrConfig({ packages: ['@kitr/react'], providers: [] })`,
        'package.json': '{}',
        // A stand-in for @vitejs/plugin-react, resolved from the project like the real one.
        'node_modules/@vitejs/plugin-react/package.json': JSON.stringify({
          name: '@vitejs/plugin-react',
          type: 'module',
          exports: './index.js',
        }),
        'node_modules/@vitejs/plugin-react/index.js':
          "export default () => ({ name: 'fake-react' })",
      },
      ['react'],
    )
    const declared = await (kitr({ root })[2] as Promise<Plugin[]>)
    expect(declared.map((p) => p.name)).toEqual(['fake-react'])
    const skipped = await (kitr({ root, plugins: { react: false } })[2] as Promise<Plugin[]>)
    expect(skipped).toEqual([])
  })

  it('turns TanStack Start on when a package asks for it, and off with start: false', async () => {
    const root = project(
      {
        'kitrrc.ts': `export default defineKitrConfig({ packages: ['@kitr/router'], providers: [] })`,
        'package.json': '{}',
      },
      ['router'],
    )
    const start = await (kitr({ root })[1] as Promise<Plugin | Plugin[]>)
    const names = [start]
      .flat(3)
      .filter(Boolean)
      .map((p) => (p as Plugin).name)
    expect(names.some((n) => /start/i.test(n))).toBe(true)
    // tanstackRouter() returns one plugin or a list; either way it is the router plugin, not Start.
    const plain = await (kitr({ root, start: false })[1] as Promise<Plugin | Plugin[]>)
    const plainNames = [plain]
      .flat(3)
      .filter(Boolean)
      .map((p) => (p as Plugin).name)
    expect(plainNames.length).toBeGreaterThan(0)
    expect(plainNames.some((n) => /router/i.test(n))).toBe(true)
    expect(plainNames.some((n) => /start/i.test(n))).toBe(false)
    // No router package, no route plugin: a plain Vite project brings its own.
    const none = await (kitr({ root: project({ 'package.json': '{}' }) })[1] as Promise<unknown>)
    expect(none).toBeNull()
  })

  it('applies the desktop shell settings for a Tauri platform', async () => {
    const root = project({
      'kitrrc.ts': `import { tauri } from '@kitr/tauri'
export default defineKitrConfig({
  platforms: { app: tauri({ port: 3200 }) },
  packages: ['@kitr/router'],
  providers: [],
})`,
    })
    const { config } = await corePlugin(root, undefined, { platform: 'app' })
    expect(config.server).toEqual({ port: 3200, strictPort: true })
    expect(config.envPrefix).toContain('TAURI_ENV_*')
    expect(config.build.outDir).toBe('dist/app')
  })

  it("passes a web platform's base to Vite, unless vite.config.ts sets one", async () => {
    const root = project({
      'kitrrc.ts': `import { web } from '@kitr/web'
export default defineKitrConfig({
  platforms: { admin: web({ base: '/admin' }), site: web() },
  packages: ['@kitr/router'],
  providers: [],
})`,
    })
    expect((await corePlugin(root, undefined, { platform: 'admin' })).config.base).toBe('/admin/')
    expect((await corePlugin(root, undefined, { platform: 'site' })).config.base).toBeUndefined()
    const plugins = kitr({ root, react: false, tailwind: false, platform: 'admin' })
    const own = await ((plugins[0] as Plugin).config as any).call(
      {},
      { root, base: '/x/' },
      { command: 'serve', mode: 'development' },
    )
    expect(own.base).toBeUndefined()
  })

  it('gives each platform its own config files and leaves out its `without` packages', async () => {
    const root = project({
      'kitrrc.ts': `import { web } from '@kitr/web'
export default defineKitrConfig({
  packages: ['@kitr/theme', '@kitr/analytics'],
  providers: [() => import('@kitr/theme/provider'), () => import('@kitr/analytics/provider')],
  platforms: {
    site: web(),
    admin: web({ mode: 'spa', without: ['analytics'] }),
  },
})`,
      'config/theme.ts': 'export default { default: "light" }',
      'config/analytics.ts': 'export default {}',
      'config/index.ts': 'export const config = {}',
      'config/admin/theme.ts': 'export default { default: "dark" }',
      'config/admin/extra.ts': 'export default {}',
      'config/notes/theme.ts': 'export default {}',
    })
    const admin = await corePlugin(root, undefined, { platform: 'admin' })
    expect(admin.load('virtual:kitr/providers')).toBe(
      'import p0 from "@kitr/theme/provider"\nexport const providers = [p0]\n',
    )
    expect(admin.load('virtual:kitr/config')).toBe(
      `import c0 from ${JSON.stringify(join(root, 'config/admin/theme.ts'))}\nexport const config = { "theme": c0 }\n`,
    )
    const site = await corePlugin(root, undefined, { platform: 'site' })
    expect(site.load('virtual:kitr/providers')).toBe(
      'import p0 from "@kitr/theme/provider"\nimport p1 from "@kitr/analytics/provider"\nexport const providers = [p0, p1]\n',
    )
    expect(site.load('virtual:kitr/config')).toBe(
      `import c0 from ${JSON.stringify(join(root, 'config/analytics.ts'))}\nimport c1 from ${JSON.stringify(join(root, 'config/theme.ts'))}\nexport const config = { "analytics": c0, "theme": c1 }\n`,
    )
    // KITR_PLATFORM picks the build when the plugin is not told.
    const before = process.env.KITR_PLATFORM
    process.env.KITR_PLATFORM = 'admin'
    try {
      const fromEnv = await corePlugin(root)
      expect(fromEnv.load('virtual:kitr/config')).toContain('config/admin/theme.ts')
      expect(fromEnv.load('virtual:kitr/providers')).not.toContain('analytics')
    } finally {
      if (before === undefined) delete process.env.KITR_PLATFORM
      else process.env.KITR_PLATFORM = before
    }
  })

  it('works without kitrrc.ts, config dir or package.json', async () => {
    const { load, config } = await corePlugin(project({}))
    expect(load('virtual:kitr/providers')).toContain('export const providers = []')
    expect(load('virtual:kitr/config')).toContain('export const config = {  }')
    expect(config.optimizeDeps.include).toEqual([])
  })

  it('ignores other module ids', async () => {
    const { core } = await corePlugin(project({}))
    expect((core.resolveId as any)('react')).toBeNull()
    expect((core.load as any)('react')).toBeNull()
  })
})

describe('robots.txt', () => {
  it('renders config/seo.ts with robotsTxt(), sitemap included', async () => {
    const { robotsFor } = await import('../src')
    const text = await robotsFor(join(__dirname, '../../../examples/site'))
    expect(text).toContain('User-agent: *')
    expect(text).toContain('Sitemap: https://example.com/sitemap.xml')
  })

  it('is null without config/seo.ts', async () => {
    const { robotsFor } = await import('../src')
    expect(await robotsFor(join(__dirname, '../../../examples/backend'))).toBeNull()
  })

  it('the build emits it for the client environment of a web platform only', async () => {
    const { kitr } = await import('../src')
    const root = join(__dirname, '../../../examples/site')
    const plugins = (await Promise.all(kitr({ root, start: false }) as any[])).filter(Boolean)
    const core = plugins.find((p: any) => p.name === 'kitr')
    await core.config({ root }, { command: 'build', mode: 'production' })
    const robots = plugins.find((p: any) => p.name === 'kitr:robots')
    const emitted: any[] = []
    const ctx = (name: string) => ({
      environment: { name, config: { publicDir: join(root, 'no-public') } },
      emitFile: (f: any) => emitted.push(f),
      warn: () => {},
    })
    await robots.generateBundle.call(ctx('ssr'))
    expect(emitted).toEqual([])
    await robots.generateBundle.call(ctx('client'))
    expect(emitted).toHaveLength(1)
    expect(emitted[0]).toMatchObject({ type: 'asset', fileName: 'robots.txt' })
  })
})

describe('crawlFilter', () => {
  it('renders one page per path and keeps anchors out of the sitemap', () => {
    const filter = crawlFilter()
    const pages = [
      { path: '/docs/a#install' },
      { path: '/docs/a' },
      { path: '/docs/a#usage' },
      { path: '/docs/b' },
      { path: '/packages?category=ui' },
    ] as Array<{ path: string; sitemap?: { exclude?: boolean } }>
    expect(pages.map(filter)).toEqual([true, false, false, true, true])
    expect(pages.filter((p) => !p.sitemap?.exclude).map((p) => p.path)).toEqual([
      '/docs/a',
      '/docs/b',
      '/packages?category=ui',
    ])
  })
})

describe('prerender failures', () => {
  /** Start's side of the crawl: filter, render, then onSuccess for each page that answered 200. */
  function crawl(guard: PrerenderGuard, pages: Record<string, string | null>) {
    const asked = Object.keys(pages).map((path) => ({ path }))
    for (const page of asked) {
      if (!guard.filter(page)) continue
      const html = pages[page.path]
      if (typeof html === 'string') guard.onSuccess({ page, html })
    }
    return asked as Array<{ path: string; sitemap?: { exclude?: boolean } }>
  }
  const site = {
    '/': '<a href="/docs/agents">Agents</a>',
    '/docs/agents': '<a href="/llms-full.txt">llms-full.txt</a> <a href="/#top">Top</a>',
    '/llms-full.txt': null,
  }

  it('records what failed and who linked to it, and keeps it out of the sitemap', () => {
    const guard = prerenderGuard({ routes: ['/'] })
    const pages = crawl(guard, site)
    expect(guard.failures()).toEqual([
      { path: '/llms-full.txt', from: '/docs/agents', listed: false },
    ])
    expect(pages.filter((p) => !p.sitemap?.exclude).map((p) => p.path)).toEqual([
      '/',
      '/docs/agents',
    ])
  })

  /** A built server that renders the not-found page for every path but the two that exist. */
  function built() {
    const dir = project({
      'server/server.js': `export default { fetch(request) {
        const path = new URL(request.url).pathname
        const headers = { 'content-type': 'text/html' }
        if (path === '/' || path === '/docs/agents') return new Response('<h1>Acme</h1>', { headers })
        return new Response('<h1>Page not found</h1>', { status: 404, headers })
      } }`,
      'client/index.html': '',
    })
    return { clientDir: join(dir, 'client'), serverEntry: join(dir, 'server/server.js') }
  }
  function logger() {
    const lines: string[] = []
    return {
      lines,
      warn: (m: string) => lines.push(`warn ${m}`),
      error: (m: string) => lines.push(`error ${m}`),
    }
  }

  it('warns in one line for a crawled page and writes 404.html', async () => {
    const guard = prerenderGuard({ routes: ['/'] })
    crawl(guard, site)
    const log = logger()
    const out = built()
    await finishPrerender({ guard, ...out, notFoundPage: true, logger: log })
    expect(log.lines).toEqual(['warn [prerender] 404 at /llms-full.txt, linked from /docs/agents'])
    expect(readFileSync(join(out.clientDir, '404.html'), 'utf8')).toBe('<h1>Page not found</h1>')
  })

  it('fails the build for a listed route, or for any page with failOnError', async () => {
    const listed = prerenderGuard({ routes: ['/', '/pricing'] })
    crawl(listed, { '/': '', '/pricing': null })
    const log = logger()
    await expect(finishPrerender({ guard: listed, ...built(), logger: log })).rejects.toThrow(
      'prerender failed for /pricing',
    )
    expect(log.lines).toEqual(['error [prerender] 404 at /pricing'])

    const strict = prerenderGuard({ routes: ['/'], failOnError: true })
    crawl(strict, site)
    await expect(finishPrerender({ guard: strict, ...built(), logger: logger() })).rejects.toThrow(
      '`prerender.failOnError` is on',
    )
  })

  it('reads failOnError from config/seo.ts', () => {
    const root = project({
      'config/seo.ts': `export default defineConfig({ prerender: { routes: ['/'], failOnError: true } })`,
    })
    expect(readPrerender(root, 'config')).toMatchObject({
      pages: [{ path: '/' }],
      failOnError: true,
    })
  })
})
