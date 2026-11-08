import { inflateSync } from 'node:zlib'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { aborted, fakePlatformContext } from '../../../tests/setup/platform-context'
import { CSP, ensureIcons, placeholderPng, tauri } from '../src'

const icons = Object.fromEntries(
  ['32x32.png', '128x128.png', '128x128@2x.png', 'icon.icns', 'icon.ico'].map((icon) => [
    `platforms/app/src-tauri/icons/${icon}`,
    'x',
  ]),
)

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('tauri()', () => {
  it('installs every plugin the provider imports', () => {
    const names = tauri().dependencies!.map((d) => d.name)
    for (const dep of ['@tauri-apps/plugin-opener', '@tauri-apps/plugin-process'])
      expect(names).toContain(dep)
  })

  it('scaffolds a content security policy and registers the process plugin', () => {
    const app = tauri()
    const f = fakePlatformContext(app, { files: { 'package.json': '{"name":"notes"}' } })
    app.scaffold!(f.ctx)
    const conf = JSON.parse(f.files.get('platforms/app/src-tauri/tauri.conf.json')!)
    expect(conf.app.security.csp).toBe(CSP)
    expect(CSP).toContain("default-src 'self'")
    expect(f.files.get('platforms/app/src-tauri/Cargo.toml')).toContain('tauri-plugin-process')
    const lib = f.files.get('platforms/app/src-tauri/src/lib.rs')!
    expect(lib).toContain('tauri_plugin_process::init()')
    expect(lib).toContain('KITR_DEVTOOLS')
    const caps = JSON.parse(f.files.get('platforms/app/src-tauri/capabilities/default.json')!)
    expect(caps.permissions).toContain('process:default')
  })

  // `--port` and KITR_<NAME>_PORT move Vite, so the window must load that port, not the scaffold-time devUrl.
  it('dev points the window at the port it started Vite on, and passes devtools', async () => {
    const app = tauri({ devtools: false })
    const f = fakePlatformContext(app, { files: icons, flags: { port: 3333 }, signal: aborted() })
    await app.dev!(f.ctx)
    const [vite, shell] = f.calls
    expect(vite!.args).toEqual(['dev', '--port', '3333', '--strictPort'])
    expect(shell!.command).toBe('tauri')
    const config = shell!.args[shell!.args.indexOf('--config') + 1]!
    expect(JSON.parse(config)).toEqual({ build: { devUrl: 'http://localhost:3333' } })
    expect(shell!.env).toMatchObject({ KITR_DEVTOOLS: '0' })
  })

  // Every Rust build needs the icons tauri.conf.json lists.
  it('generates icons from app-icon.png when tauri.conf.json lists missing ones', async () => {
    const app = tauri()
    const f = fakePlatformContext(app, { files: { 'platforms/app/app-icon.png': 'png' } })
    await ensureIcons(f.ctx)
    expect(f.calls.map((c) => [c.command, ...c.args])).toEqual([['tauri', 'icon', 'app-icon.png']])
    const done = fakePlatformContext(app, { files: icons })
    await ensureIcons(done.ctx)
    expect(done.calls).toEqual([])
  })

  it('makes a valid RGBA placeholder png', async () => {
    const png = await placeholderPng(64)
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG')
    expect(png.readUInt32BE(16)).toBe(64)
    expect(png.readUInt32BE(20)).toBe(64)
    const idat = png.indexOf('IDAT')
    const raw = inflateSync(png.subarray(idat + 4, idat + 4 + png.readUInt32BE(idat - 4)))
    expect(raw.length).toBe((64 * 4 + 1) * 64)
    // Corners are transparent, the middle is opaque.
    expect(raw[1 + 3]).toBe(0)
    expect(raw[32 * (64 * 4 + 1) + 1 + 32 * 4 + 3]).toBe(255)
  })

  it('doctor reports a missing Rust toolchain', async () => {
    vi.stubEnv('PATH', '/nonexistent')
    const app = tauri()
    const f = fakePlatformContext(app, { files: { 'package.json': '{}' } })
    const messages = ((await app.doctor!(f.ctx)) ?? []).map((x) => x.message)
    expect(messages).toContain('app: @tauri-apps/plugin-process is not installed')
    expect(messages.some((m) => /Rust toolchain \(cargo\)/.test(m))).toBe(true)
  })
})
