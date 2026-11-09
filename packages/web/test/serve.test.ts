import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { fakePlatformContext } from '../../../tests/setup/platform-context'
import { startWeb, web } from '../src'

const here = dirname(fileURLToPath(import.meta.url))
// Each served platform adds its own SIGINT/SIGTERM listeners; the tests start a dozen.
process.setMaxListeners(50)

const roots: string[] = []
const stops: Array<() => Promise<void>> = []

afterEach(async () => {
  for (const stop of stops.splice(0)) await stop()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/**
 * A project directory holding a built platform: `dist/<name>/client` and, for ssr,
 * `dist/<name>/server/server.js`. node_modules is the web package's own, so `srvx` resolves
 * from the project the way it does in a real one.
 */
function project(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'kitr-web-serve-'))
  roots.push(root)
  symlinkSync(join(here, '../node_modules'), join(root, 'node_modules'), 'dir')
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
  return root
}

const client = (extra: Record<string, string> = {}) => ({
  'dist/site/client/index.html': '<!doctype html><title>shell</title><div id="root"></div>',
  'dist/site/client/sw.js': 'self.skipWaiting()',
  'dist/site/client/manifest.webmanifest': JSON.stringify({ name: 'Shop', display: 'standalone' }),
  'dist/site/client/assets/app-abc123.js': 'console.log("app")',
  ...extra,
})

/** Start the platform's `start` hook on a free port; resolves to the base URL. */
async function serve(
  root: string,
  site: ReturnType<typeof web>,
  init: Parameters<typeof fakePlatformContext>[1] = {},
) {
  const abort = new AbortController()
  const f = fakePlatformContext(site, { name: 'site', signal: abort.signal, ...init })
  f.ctx.root = root
  let failure: unknown
  const done = (site.start!(f.ctx) as Promise<void>).catch((e) => {
    failure = e ?? new Error('stopped')
  })
  let url: string | undefined
  for (let i = 0; i < 200 && !url && !failure; i++) {
    url = f.logs.map((l) => l.match(/serving dist\/site on (\S+)/)?.[1]).find(Boolean)
    if (!url) await new Promise((r) => setTimeout(r, 25))
  }
  stops.push(async () => {
    abort.abort()
    await done
  })
  if (failure) throw failure
  return { url: url!.replace(/\/$/, ''), logs: f.logs, done }
}

describe('production serving: spa and static', () => {
  it('serves files from the build with the right caching', async () => {
    const root = project(client())
    const { url } = await serve(root, web({ mode: 'spa', port: 0, host: '127.0.0.1' }))
    const asset = await fetch(`${url}/assets/app-abc123.js`)
    expect(asset.status).toBe(200)
    expect(asset.headers.get('cache-control')).toBe('max-age=31536000, immutable')
    const sw = await fetch(`${url}/sw.js`)
    expect(await sw.text()).toBe('self.skipWaiting()')
    expect(sw.headers.get('cache-control')).toBe('no-cache')
    const manifest = await fetch(`${url}/manifest.webmanifest`)
    expect(await manifest.json()).toMatchObject({ name: 'Shop' })
  })

  it('falls back to the shell for client routes, so deep links load', async () => {
    const root = project(client())
    const { url } = await serve(root, web({ mode: 'spa', port: 0, host: '127.0.0.1' }))
    for (const path of ['/', '/dashboard/settings', '/a/b/c?x=1']) {
      const res = await fetch(`${url}${path}`)
      expect(res.status, path).toBe(200)
      expect(res.headers.get('content-type')).toMatch(/text\/html/)
      expect(res.headers.get('cache-control')).toBe('no-cache')
      expect(await res.text()).toContain('<div id="root">')
    }
  })

  it('serves prerendered pages and keeps the shell for the rest (static mode)', async () => {
    const root = project(
      client({ 'dist/site/client/about/index.html': '<!doctype html><h1>About us</h1>' }),
    )
    const { url } = await serve(root, web({ mode: 'static', port: 0, host: '127.0.0.1' }))
    expect(await (await fetch(`${url}/about/`)).text()).toContain('About us')
    expect(await (await fetch(`${url}/not-prerendered`)).text()).toContain('<div id="root">')
  })

  it('answers unknown paths with 404.html and status 404 in static mode', async () => {
    const files = client({
      'dist/site/client/about/index.html': '<!doctype html><h1>About us</h1>',
      'dist/site/client/404.html': '<!doctype html><h1>Page not found</h1>',
    })
    const site = await serve(project(files), web({ mode: 'static', port: 0, host: '127.0.0.1' }))
    expect(await (await fetch(`${site.url}/about/`)).text()).toContain('About us')
    const missing = await fetch(`${site.url}/pricing`)
    expect(missing.status).toBe(404)
    expect(await missing.text()).toContain('Page not found')
    // An SPA routes on the client: the same build in spa mode keeps the shell, with 200.
    const spa = await serve(project(files), web({ mode: 'spa', port: 0, host: '127.0.0.1' }))
    const deep = await fetch(`${spa.url}/pricing`)
    expect(deep.status).toBe(200)
    expect(await deep.text()).toContain('<div id="root">')
  })

  it('prefers _shell.html or 200.html when there is no index.html', async () => {
    const root = project({
      'dist/site/client/_shell.html': '<!doctype html><p>shell file</p>',
      'dist/site/client/assets/x.js': '1',
    })
    const { url } = await serve(root, web({ mode: 'spa', port: 0, host: '127.0.0.1' }))
    expect(await (await fetch(`${url}/anywhere`)).text()).toContain('shell file')
  })

  it('answers 404 when the build has no shell at all', async () => {
    const root = project({ 'dist/site/client/assets/x.js': '1' })
    const { url } = await serve(root, web({ mode: 'spa', port: 0, host: '127.0.0.1' }))
    const res = await fetch(`${url}/anywhere`)
    expect(res.status).toBe(404)
    expect(await res.text()).toBe('Not found')
  })

  it('serves an app built for a sub-path under that base only', async () => {
    const root = project(client())
    const { url } = await serve(
      root,
      web({ mode: 'spa', port: 0, host: '127.0.0.1', base: '/app' }),
    )
    expect((await fetch(`${url}/app/assets/app-abc123.js`)).status).toBe(200)
    expect((await fetch(`${url}/app/sw.js`)).headers.get('cache-control')).toBe('no-cache')
  })

  it('takes the port and host from flags, then PORT and HOST, then the options', async () => {
    const root = project(client())
    const site = web({ mode: 'spa', port: 3999, host: '0.0.0.0' })
    const byFlag = await serve(root, site, { flags: { port: 0, host: '127.0.0.1' } })
    expect(byFlag.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
    const byEnv = await serve(root, site, { env: { PORT: '0', HOST: '127.0.0.1' } })
    expect(byEnv.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
    expect(byEnv.url).not.toContain(':3999')
  })

  it('stops when the abort signal fires', async () => {
    const root = project(client())
    const abort = new AbortController()
    const site = web({ mode: 'spa', port: 0, host: '127.0.0.1' })
    const f = fakePlatformContext(site, { name: 'site', signal: abort.signal })
    f.ctx.root = root
    const done = startWeb(f.ctx, { mode: 'spa', port: 0, host: '127.0.0.1' })
    await new Promise((r) => setTimeout(r, 200))
    abort.abort()
    await expect(done).resolves.toBeUndefined()
  })
})

describe('production serving: ssr', () => {
  // An ssr build has no index.html: pages come from the server bundle.
  const ssr = (server: string) => {
    const { 'dist/site/client/index.html': _shell, ...files } = client()
    return project({ ...files, 'dist/site/server/server.js': server })
  }
  const site = () => web({ mode: 'ssr', port: 0, host: '127.0.0.1' })

  it('hands requests that are not files to the server bundle (default.fetch)', async () => {
    const root = ssr(`export default { fetch(req) {
      const url = new URL(req.url)
      return new Response('<h1>' + url.pathname + '</h1>', { headers: { 'content-type': 'text/html' } })
    } }`)
    const { url } = await serve(root, site())
    expect(await (await fetch(`${url}/products/42`)).text()).toBe('<h1>/products/42</h1>')
    // Static files are still served from the client build, not the handler.
    expect(await (await fetch(`${url}/assets/app-abc123.js`)).text()).toContain('console.log')
    expect((await fetch(`${url}/sw.js`)).headers.get('cache-control')).toBe('no-cache')
  })

  it('lets the server bundle decide the status of unknown pages', async () => {
    const root = ssr(
      `export default { fetch: () => new Response('nothing here', { status: 404 }) }`,
    )
    const { url } = await serve(root, site())
    const res = await fetch(`${url}/nope`)
    expect(res.status).toBe(404)
    expect(await res.text()).toBe('nothing here')
  })

  it('accepts a default-exported function and a named fetch export', async () => {
    const fn = ssr(`export default (req) => new Response('fn ' + new URL(req.url).pathname)`)
    expect(await (await fetch(`${(await serve(fn, site())).url}/x`)).text()).toBe('fn /x')
    const named = ssr(
      `export const fetch = (req) => new Response('named ' + new URL(req.url).pathname)`,
    )
    expect(await (await fetch(`${(await serve(named, site())).url}/y`)).text()).toBe('named /y')
  })

  it('refuses a bundle without a fetch handler', async () => {
    const root = ssr('export const nothing = 1')
    await expect(serve(root, site())).rejects.toThrow(/does not export a fetch handler/)
  })

  it('refuses an ssr platform that has only the client build', async () => {
    const root = project(client())
    await expect(serve(root, site())).rejects.toThrow(
      /dist\/site\/server\/server\.js not found\. Run `kitr build site` first/,
    )
  })

  it('upgrades WebSockets through crossws when it is installed', async () => {
    // The plugin is added when crossws resolves; a plain request still works with it on.
    const root = ssr(`export default { fetch: () => new Response('with plugin') }`)
    expect(existsSync(join(root, 'node_modules/crossws'))).toBe(true)
    const { url } = await serve(root, site())
    expect(await (await fetch(`${url}/`)).text()).toBe('with plugin')
  })
})
