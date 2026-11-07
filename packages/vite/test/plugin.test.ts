import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { kitr, readRc } from '../src'

const dirs: string[] = []
function project(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'kitr-vite-'))
  dirs.push(dir)
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true })
    writeFileSync(join(dir, path), content)
  }
  return dir
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

const rc = `export default defineKitrConfig({
  packages: ['@kitr/query', '@kitr/devtools', '@kitr/http'],
  providers: [
    () => import('@kitr/query/provider'),
    // () => import('@kitr/disabled/provider'),
    () => import('@kitr/devtools/provider'),
  ],
  directories: { config: 'settings' },
})`

async function corePlugin(
  root: string,
  env = { command: 'serve' as const, mode: 'development' },
  options = {},
) {
  const plugins = kitr({ root, react: false, tailwind: false, ...options })
  const core = plugins[0] as Plugin
  const config = await (core.config as any).call({}, { root }, env)
  const load = (id: string) => (core.load as any).call({}, (core.resolveId as any).call({}, id))
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
    const root = project({
      'kitrrc.ts': rc,
      'settings/query.ts': 'export default { staleTime: 1 }',
      'settings/http.ts': 'export default {}',
      'settings/notes.md': '# not config',
      'package.json': JSON.stringify({
        dependencies: { react: '1', 'react-dom': '1', ky: '1', '@tanstack/react-query': '1' },
      }),
    })
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
    expect(config.optimizeDeps.include).toEqual([
      'react',
      'react-dom',
      'react/jsx-runtime',
      '@tanstack/react-query',
      'ky',
    ])
    expect(config.resolve.alias['#config']).toBe(join(root, 'settings'))
    expect(config.define['import.meta.env.KITR_PACKAGES']).toBe(
      JSON.stringify(['@kitr/query', '@kitr/devtools', '@kitr/http']),
    )
  })

  it('aliases #kitr to the generated folder and writes it on buildStart', async () => {
    const root = project({
      'kitrrc.ts': `import { web } from 'kitr/web'\nexport default defineKitrConfig({ packages: [], providers: [], platforms: { site: web({ mode: 'spa' }) } })`,
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

  it('strips the devtools provider from production builds only', async () => {
    const root = project({ 'kitrrc.ts': rc })
    const prod = await corePlugin(root, { command: 'build', mode: 'production' } as any)
    expect(prod.load('virtual:kitr/providers')).not.toContain('devtools')
    const devBuild = await corePlugin(root, { command: 'build', mode: 'development' } as any)
    expect(devBuild.load('virtual:kitr/providers')).toContain('devtools')
    const forcedOff = await corePlugin(root, { command: 'serve', mode: 'development' } as any, {
      devtools: false,
    })
    expect(forcedOff.load('virtual:kitr/providers')).not.toContain('devtools')
  })

  it('applies the desktop shell settings for a Tauri platform', async () => {
    const root = project({
      'kitrrc.ts': `import { desktop } from 'kitr/desktop'
export default defineKitrConfig({
  platforms: { app: desktop({ shell: 'tauri', port: 3200 }) },
  packages: ['@kitr/router'],
  providers: [],
})`,
    })
    const { config } = await corePlugin(root, undefined, { platform: 'app' })
    expect(config.server).toEqual({ port: 3200, strictPort: true })
    expect(config.envPrefix).toContain('TAURI_ENV_*')
    expect(config.build.outDir).toBe('dist/app')
  })

  // Regression: web({ base }) was accepted and documented, but never reached Vite.
  it("passes a web platform's base to Vite, unless vite.config.ts sets one", async () => {
    const root = project({
      'kitrrc.ts': `import { web } from 'kitr/web'
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

// Regression: `robots` in config/seo.ts only fed `robotsTxt()`, and nothing wrote robots.txt.
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
