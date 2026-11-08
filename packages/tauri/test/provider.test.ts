import { createApp } from '@kitr/core'
import { createPlatform } from '@kitr/platform'
import { afterEach, describe, expect, it, vi } from 'vitest'

const getVersion = vi.fn(async () => '1.4.0')
const openUrl = vi.fn(async (_url: string) => {})
const exit = vi.fn(async (_code: number) => {})
const data = new Map<string, unknown>()
const saved = vi.fn()

vi.mock('@tauri-apps/api/app', () => ({ getVersion }))
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl }))
vi.mock('@tauri-apps/plugin-process', () => ({ exit }))
vi.mock('@tauri-apps/plugin-store', () => ({
  LazyStore: class {
    constructor(public file: string) {}
    async entries() {
      return [...data.entries()]
    }
    async set(key: string, value: unknown) {
      data.set(key, value)
    }
    async delete(key: string) {
      data.delete(key)
    }
    async save() {
      saved(this.file)
    }
  },
}))

const {
  default: tauriProvider,
  tauriProvider: named,
  tauriStoreDriver,
} = await import('../src/provider')

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  data.clear()
})

async function boot() {
  const app = createApp({ environment: 'test' })
  await tauriProvider.register?.(app)
  return app
}

describe('tauri provider', () => {
  it('is the default and the named export', () => {
    expect(named).toBe(tauriProvider)
    expect(tauriProvider.name).toBe('tauri')
  })

  it('does nothing in a plain browser', async () => {
    expect((await boot()).drivers.capabilities()).toEqual([])
  })

  it('registers the platform and storage drivers inside a Tauri webview', async () => {
    ;(globalThis as Record<string, unknown>).window = { __TAURI_INTERNALS__: {} }
    const app = await boot()
    expect(app.drivers.capabilities().sort()).toEqual(['platform', 'storage'])
    expect(app.drivers.describe('platform')?.platform).toBe('tauri')
    const platform = createPlatform(app)
    expect(platform).toMatchObject({ type: 'desktop', native: true, runtime: 'tauri' })
    expect(platform.standalone).toBe(true)
  })

  it('every loader is a literal import that either resolves or rejects, never throws synchronously', async () => {
    const { tauriPluginLoaders } = await import('../src/provider')
    for (const load of Object.values(tauriPluginLoaders)) {
      const result = await Promise.allSettled([Promise.resolve().then(load)])
      expect(result).toHaveLength(1)
    }
  })

  it('registers loaders for every plugin the device drivers load, inside a Tauri webview only', async () => {
    const { tauriPluginLoaders } = await import('../src/provider')
    const { loadShellModule } = await import('@kitr/platform')
    expect(Object.keys(tauriPluginLoaders).sort()).toEqual([
      '@tauri-apps/api/app',
      '@tauri-apps/api/core',
      '@tauri-apps/api/path',
      '@tauri-apps/api/window',
      '@tauri-apps/plugin-clipboard-manager',
      '@tauri-apps/plugin-dialog',
      '@tauri-apps/plugin-fs',
      '@tauri-apps/plugin-notification',
      '@tauri-apps/plugin-opener',
      '@tauri-apps/plugin-os',
      '@tauri-apps/plugin-process',
      '@tauri-apps/plugin-stronghold',
      '@tauri-apps/plugin-updater',
    ])
    ;(globalThis as Record<string, unknown>).window = { __TAURI_INTERNALS__: {} }
    await boot()
    // The mocked app module resolves through the registered loader.
    expect(
      (await loadShellModule<{ getVersion(): Promise<string> }>('@tauri-apps/api/app')).getVersion,
    ).toBe(getVersion)
  })

  it('reads the version, opens links and quits through the Tauri plugins', async () => {
    ;(globalThis as Record<string, unknown>).window = { __TAURI_INTERNALS__: {} }
    const platform = createPlatform(await boot())
    expect(await platform.appVersion()).toBe('1.4.0')
    await platform.openExternal('https://acme.com')
    await platform.exit()
    expect(openUrl).toHaveBeenCalledWith('https://acme.com')
    expect(exit).toHaveBeenCalledWith(0)
  })

  it('falls back to the browser when a plugin call fails', async () => {
    const open = vi.fn()
    const close = vi.fn()
    ;(globalThis as Record<string, unknown>).window = { __TAURI_INTERNALS__: {}, open, close }
    openUrl.mockRejectedValueOnce(new Error('plugin missing'))
    exit.mockRejectedValueOnce(new Error('plugin missing'))
    const platform = createPlatform(await boot())
    await platform.openExternal('https://acme.com')
    await platform.exit()
    expect(open).toHaveBeenCalledWith('https://acme.com', '_blank', 'noopener')
    expect(close).toHaveBeenCalled()
  })
})

describe('tauriStoreDriver', () => {
  it('hydrates string entries from the store plugin and saves each change', async () => {
    data.set('theme', 'dark')
    data.set('count', 3)
    const driver = tauriStoreDriver()
    await driver.hydrate?.()
    expect(driver.keys()).toEqual(['theme'])
    driver.set('lang', 'de')
    driver.remove('theme')
    await vi.waitFor(() => expect(saved).toHaveBeenCalledTimes(2))
    expect(data.get('lang')).toBe('de')
    expect(data.has('theme')).toBe(false)
    expect(saved).toHaveBeenCalledWith('kitr.json')
  })

  it('uses the file it is given', async () => {
    const driver = tauriStoreDriver('notes.json')
    driver.set('a', '1')
    await vi.waitFor(() => expect(saved).toHaveBeenCalledWith('notes.json'))
  })
})
