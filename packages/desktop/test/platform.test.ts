import { describe, expect, it } from 'vitest'
import { aborted, fakePlatformContext } from '../../../tests/setup/platform-context'
import { desktop } from '../src'

describe('desktop()', () => {
  it('defaults to tauri and validates the shell', () => {
    expect(desktop().options).toMatchObject({ shell: 'tauri', port: 3200, devtools: true })
    expect(() => desktop({ shell: 'qt' as any })).toThrow(/shell must be tauri or electron, got qt/)
  })

  it('installs the packages of the chosen shell only', () => {
    const names = (shell: 'tauri' | 'electron') =>
      desktop({ shell }).dependencies!.map((d) => d.name)
    expect(names('tauri')).toEqual([
      '@tauri-apps/api',
      '@tauri-apps/plugin-store',
      '@tauri-apps/cli',
    ])
    expect(names('electron')).toEqual(['electron', 'electron-vite', 'electron-builder'])
  })

  describe('tauri', () => {
    it('scaffolds src-tauri with the app name, version and dev URL', () => {
      const app = desktop({ title: 'Field Notes', width: 1000, height: 700 })
      const f = fakePlatformContext(app, {
        files: { 'package.json': JSON.stringify({ name: 'notes', version: '1.2.3' }) },
      })
      app.scaffold!(f.ctx)
      const conf = JSON.parse(f.files.get('platforms/app/src-tauri/tauri.conf.json')!)
      expect(conf.productName).toBe('Field Notes')
      expect(conf.version).toBe('1.2.3')
      expect(JSON.stringify(conf)).toContain('localhost:3200')
      for (const file of ['Cargo.toml', 'build.rs', 'src/main.rs', 'src/lib.rs', '.gitignore'])
        expect(f.files.has(`platforms/app/src-tauri/${file}`), file).toBe(true)
      expect(f.files.get('platforms/app/src-tauri/src/main.rs')).toContain('field_notes_lib::run()')
    })

    it('builds the client, then installers; --debug passes through', async () => {
      const app = desktop()
      const f = fakePlatformContext(app, { flags: { debug: true } })
      await app.build!(f.ctx)
      expect(f.calls.map((c) => [c.command, ...c.args])).toEqual([
        ['vite', 'build'],
        ['tauri', 'build', '--debug'],
      ])
      expect(f.calls[1]!.cwd).toBe('/project/platforms/app')
    })

    it('dev runs Vite and the Tauri window against it', async () => {
      const app = desktop()
      const f = fakePlatformContext(app, { flags: { port: 3333 }, signal: aborted() })
      await app.dev!(f.ctx)
      expect(f.calls.map((c) => [c.command, ...c.args])).toEqual([
        ['vite', 'dev', '--port', '3333', '--strictPort'],
        ['tauri', 'dev', '--no-watch'],
      ])
      expect(f.calls[1]!.env).toEqual({ KITR_DEV_URL: 'http://localhost:3333' })
    })

    it('start explains where the binary is rather than spawning anything', async () => {
      const app = desktop()
      const f = fakePlatformContext(app)
      await app.start!(f.ctx)
      expect(f.calls).toEqual([])
      expect(f.logs.join('\n')).toMatch(/src-tauri\/target\/release/)
    })
  })

  describe('electron', () => {
    const files = { 'package.json': JSON.stringify({ name: 'notes', version: '0.1.0' }) }

    it('scaffolds main, preload and IPC, and points package.json main at the build', () => {
      const app = desktop({ shell: 'electron' })
      const f = fakePlatformContext(app, { files })
      app.scaffold!(f.ctx)
      for (const file of ['ipc.ts', 'main.ts', 'preload.ts', 'electron.vite.config.ts'])
        expect(f.files.has(`platforms/app/${file}`), file).toBe(true)
      expect(JSON.parse(f.files.get('package.json')!).main).toBe('dist/app/electron/main/index.js')
      // Security defaults stay on in the generated main process.
      const main = f.files.get('platforms/app/main.ts')!
      expect(main).not.toMatch(/nodeIntegration:\s*true/)
      expect(main).not.toMatch(/contextIsolation:\s*false/)
    })

    it('builds the client, main and preload, then packages unless --no-pack', async () => {
      const app = desktop({ shell: 'electron' })
      const f = fakePlatformContext(app, { flags: { dir: true } })
      await app.build!(f.ctx)
      expect(f.calls.map((c) => [c.command, ...c.args])).toEqual([
        ['vite', 'build'],
        ['electron-vite', 'build', '-c', '/project/platforms/app/electron.vite.config.ts'],
        ['electron-builder', '--config', '/project/platforms/app/electron-builder.yml', '--dir'],
      ])
      const noPack = fakePlatformContext(app, { flags: { pack: false } })
      await app.build!(noPack.ctx)
      expect(noPack.calls.map((c) => c.command)).toEqual(['vite', 'electron-vite'])
    })

    it('doctor warns when package.json main does not point at the built main process', () => {
      const app = desktop({ shell: 'electron' })
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
  })

  it('doctor for tauri reports missing packages and src-tauri', () => {
    const app = desktop()
    const f = fakePlatformContext(app, { files: { 'package.json': '{}' } })
    expect((app.doctor!(f.ctx) as any[]).map((x) => x.message)).toEqual([
      'app: @tauri-apps/api is not installed',
      'app: @tauri-apps/cli is not installed',
      'app: @tauri-apps/plugin-store is not installed',
      'app: platforms/app/src-tauri is missing',
    ])
  })
})
