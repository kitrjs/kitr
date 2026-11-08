import { describe, expect, it } from 'vitest'
import { aborted, fakePlatformContext } from '../../../tests/setup/platform-context'
import { desktop } from '../src'

describe('desktop()', () => {
  it('defaults the window and port', () => {
    expect(desktop().options).toMatchObject({
      port: 3200,
      width: 1200,
      height: 800,
      devtools: true,
    })
    expect(desktop({ port: 4000 }).options.port).toBe(4000)
  })

  it('installs the Electron toolchain as dev dependencies', () => {
    expect(desktop().dependencies!.map((d) => [d.name, d.dev])).toEqual([
      ['electron', true],
      ['electron-vite', true],
      ['electron-builder', true],
      ['electron-updater', undefined],
    ])
  })

  const files = { 'package.json': JSON.stringify({ name: 'notes', version: '0.1.0' }) }

  it('scaffolds main, preload and IPC, and points package.json main at the build', () => {
    const app = desktop()
    const f = fakePlatformContext(app, { files })
    app.scaffold!(f.ctx)
    for (const file of ['ipc.ts', 'main.ts', 'preload.ts', 'electron.vite.config.ts'])
      expect(f.files.has(`platforms/app/${file}`), file).toBe(true)
    expect(JSON.parse(f.files.get('package.json')!).main).toBe('dist/app/electron/main/index.js')
    // Security defaults stay on in the generated main process.
    const main = f.files.get('platforms/app/main.ts')!
    expect(main).not.toMatch(/nodeIntegration:\s*true/)
    expect(main).not.toMatch(/contextIsolation:\s*false/)
    // The preload limits the renderer to the channels ipc.ts declares.
    expect(f.files.get('platforms/app/preload.ts')).toContain('allow: allowChannels(channels)')
    expect(f.files.get('platforms/app/ipc.ts')).toContain(
      'satisfies Record<keyof Ipc | keyof IpcPush, true>',
    )
  })

  it('builds the client, main and preload, then packages unless --no-pack', async () => {
    const app = desktop()
    const f = fakePlatformContext(app, { flags: { dir: true } })
    await app.build!(f.ctx)
    expect(f.calls.map((c) => [c.command, ...c.args])).toEqual([
      ['vite', 'build'],
      ['electron-vite', 'build', '-c', '/project/platforms/app/electron.vite.config.ts'],
      [
        'electron-builder',
        '--config',
        '/project/platforms/app/electron-builder.yml',
        '--publish',
        'never',
        '--dir',
      ],
    ])
    const noPack = fakePlatformContext(app, { flags: { pack: false } })
    await app.build!(noPack.ctx)
    expect(noPack.calls.map((c) => c.command)).toEqual(['vite', 'electron-vite'])
  })

  it('doctor warns when package.json main does not point at the built main process', () => {
    const app = desktop()
    const f = fakePlatformContext(app, {
      files: {
        'package.json': JSON.stringify({
          main: 'index.js',
          devDependencies: { electron: '1', 'electron-vite': '1', 'electron-builder': '1' },
        }),
        'platforms/app/main.ts': '',
      },
    })
    const findings = app.doctor!(f.ctx) as any[]
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ level: 'warn' })
    expect(findings[0].message).toContain('dist/app/electron/main/index.js')
  })

  it('dev runs Vite and Electron against it', async () => {
    const app = desktop()
    const f = fakePlatformContext(app, { flags: { port: 3333 }, signal: aborted() })
    await app.dev!(f.ctx)
    expect(f.calls.map((c) => c.command)).toEqual(['vite', 'electron-vite'])
    expect(f.calls[1]!.env).toEqual({ ELECTRON_RENDERER_URL: 'http://localhost:3333' })
  })

  it('doctor reports the missing toolchain and main process', () => {
    const app = desktop()
    const f = fakePlatformContext(app, { files: { 'package.json': '{}' } })
    expect((app.doctor!(f.ctx) as any[]).map((x) => x.message)).toEqual([
      'app: electron is not installed',
      'app: electron-vite is not installed',
      'app: electron-builder is not installed',
      'app: platforms/app/main.ts is missing',
      'app: package.json "main" should be dist/app/electron/main/index.js so electron and electron-builder find the built main process',
    ])
  })
})
