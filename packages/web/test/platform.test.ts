import { describe, expect, it } from 'vitest'
import { fakePlatformContext } from '../../../tests/setup/platform-context'
import { pwaManifest, startWeb, staticFiles, web } from '../src'

const pkg = (deps: Record<string, string> = {}, dev: Record<string, string> = {}) =>
  JSON.stringify({ name: 'shop', dependencies: deps, devDependencies: dev })

describe('web()', () => {
  it('fills defaults and keeps what kitrrc.ts sets', () => {
    expect(web().options).toEqual({
      mode: 'spa',
      port: 3000,
      host: undefined,
      pwa: false,
      base: '/',
      open: false,
    })
    expect(web({ mode: 'ssr', port: 4000 }).options).toMatchObject({ mode: 'ssr', port: 4000 })
    expect(web({ mode: 'ssr' }).input).toEqual({ mode: 'ssr' })
  })

  it('rejects an unknown mode or an impossible port', () => {
    expect(() => web({ mode: 'edge' as any })).toThrow(/mode must be one of static, spa, ssr/)
    expect(() => web({ port: 70000 })).toThrow(/port must be a number between 0 and 65535/)
    expect(() => web({ port: '80' as any })).toThrow(/port/)
  })

  it('with() replaces options and validates again', () => {
    const site = web({ mode: 'ssr' })
    expect(site.with({ port: 5000 }).options).toMatchObject({ mode: 'ssr', port: 5000 })
    expect(site.options.port).toBe(3000)
    expect(() => site.with({ mode: 'nope' as any })).toThrow()
  })

  it('asks for srvx only with ssr and vite-plugin-pwa only with pwa', () => {
    const names = (i: ReturnType<typeof web>) => i.dependencies!.map((d) => d.name)
    expect(names(web())).not.toContain('srvx')
    expect(names(web())).not.toContain('vite-plugin-pwa')
    expect(names(web({ mode: 'ssr' }))).toContain('srvx')
    expect(names(web({ pwa: true }))).toContain('vite-plugin-pwa')
    expect(web().definition.requires).toEqual(['router'])
    expect(web().definition.provider).toBe('@kitr/web/provider')
  })

  it('dev runs Vite on the configured port, and flags win', async () => {
    const site = web({ port: 3000, open: true })
    const a = fakePlatformContext(site)
    await site.dev!(a.ctx)
    expect(a.calls).toEqual([
      {
        kind: 'exec',
        command: 'vite',
        args: ['dev', '--port', '3000', '--strictPort', '--open'],
        cwd: undefined,
        env: undefined,
      },
    ])
    const b = fakePlatformContext(site, { flags: { port: 4100, host: '0.0.0.0' } })
    await site.dev!(b.ctx)
    expect(b.calls[0]!.args).toEqual([
      'dev',
      '--port',
      '4100',
      '--strictPort',
      '--host',
      '0.0.0.0',
      '--open',
    ])
  })

  it('build runs vite build', async () => {
    const f = fakePlatformContext(web())
    await web().build!(f.ctx)
    expect(f.calls.map((c) => [c.command, ...c.args])).toEqual([['vite', 'build']])
  })

  it('start refuses to serve a platform that was never built', async () => {
    const f = fakePlatformContext(web(), { name: 'site' })
    f.ctx.root = '/definitely/not/a/project'
    await expect(startWeb(f.ctx, { mode: 'spa', port: 0, host: '127.0.0.1' })).rejects.toThrow(
      /dist\/site\/client not found\. Run `kitr build site` first/,
    )
  })

  it('scaffold writes the icons note only for installable apps', () => {
    const plain = fakePlatformContext(web())
    web().scaffold!(plain.ctx)
    expect([...plain.files.keys()]).toEqual([])
    const pwa = web({ pwa: true })
    const f = fakePlatformContext(pwa)
    pwa.scaffold!(f.ctx)
    expect(f.files.get('public/icons/README.md')).toMatch(/icon-192\.png/)
  })

  it('doctor names each missing piece with the command that fixes it', () => {
    const site = web({ pwa: true })
    const empty = fakePlatformContext(site, { name: 'site', files: { 'package.json': pkg() } })
    const findings = site.doctor!(empty.ctx) as any[]
    expect(findings.map((f) => f.message)).toEqual([
      'site: vite is not installed',
      'site: @tanstack/react-start is not installed',
      'site: pwa is on but vite-plugin-pwa is not installed',
      'site: app/routes.ts is missing (no pages to render)',
    ])
    expect(findings[0].fix).toBe('pnpm add -D vite')

    const ok = fakePlatformContext(site, {
      files: {
        'package.json': pkg(
          { '@tanstack/react-start': '1' },
          { vite: '8', 'vite-plugin-pwa': '1' },
        ),
        'app/routes/__root.tsx': '',
      },
    })
    expect(site.doctor!(ok.ctx)).toEqual([])
  })

  it('doctor copes with a missing or broken package.json', () => {
    const f = fakePlatformContext(web(), { files: { 'package.json': '{ not json' } })
    expect((web().doctor!(f.ctx) as any[]).length).toBeGreaterThan(0)
  })

  it('tells agents how the chosen mode renders', () => {
    expect(web({ mode: 'ssr' }).agents).toMatch(/render on the server/)
    expect(web({ mode: 'static' }).agents).toMatch(/prerendered at build time/)
    expect(web({ mode: 'spa' }).agents).toMatch(/render on the client/)
    expect(web({ pwa: true }).agents).toMatch(/PwaUpdate/)
  })
})

describe('pwaManifest', () => {
  it('defaults to the app name and the standard icons', () => {
    const m = pwaManifest(web({ pwa: true }).options, 'Shop')
    expect(m).toMatchObject({
      name: 'Shop',
      short_name: 'Shop',
      display: 'standalone',
      start_url: '/',
    })
    expect(m.icons.map((i) => i.sizes)).toEqual(['192x192', '512x512'])
  })

  it('uses what the pwa options set', () => {
    const m = pwaManifest(
      web({
        pwa: { name: 'Shop Pro', shortName: 'Shop', themeColor: '#000', display: 'fullscreen' },
      }).options,
      'ignored',
    )
    expect(m).toMatchObject({
      name: 'Shop Pro',
      short_name: 'Shop',
      theme_color: '#000',
      display: 'fullscreen',
    })
  })
})

describe('staticFiles', () => {
  // Regression: every file was served with a one-year max-age, index.html and sw.js included,
  // so a deploy never reached returning users.
  const setup = async (base?: string) => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const dir = mkdtempSync(join(tmpdir(), 'kitr-web-static-'))
    mkdirSync(join(dir, 'assets'))
    writeFileSync(join(dir, 'index.html'), '<!doctype html>')
    writeFileSync(join(dir, 'sw.js'), 'self')
    writeFileSync(join(dir, 'assets', 'app-abc123.js'), 'x')
    const { staticMiddleware } = await import('srvx/static')
    const handler = staticFiles(staticMiddleware as never, dir, base)
    const next = () => new Response('fallback', { status: 404 })
    return (path: string) => handler(new Request(`http://x${path}`), next)
  }

  it('caches hashed assets for a year and revalidates everything else', async () => {
    const get = await setup()
    const asset = await get('/assets/app-abc123.js')
    expect(asset.status).toBe(200)
    expect(asset.headers.get('cache-control')).toBe('max-age=31536000, immutable')
    for (const path of ['/index.html', '/sw.js'])
      expect((await get(path)).headers.get('cache-control'), path).toBe('no-cache')
    expect((await get('/missing')).status).toBe(404)
  })

  it('serves under the platform base', async () => {
    const get = await setup('/admin')
    expect((await get('/admin/assets/app-abc123.js')).status).toBe(200)
    expect((await get('/admin/sw.js')).headers.get('cache-control')).toBe('no-cache')
    expect((await get('/assets/app-abc123.js')).status).toBe(404)
  })
})
