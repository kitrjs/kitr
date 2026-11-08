import { registerShellModules } from '@kitr/platform'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { selectDriver } from '../src'
import { createTauriDriver } from '../src/drivers/tauri'

function fakePlugins(theme: 'light' | 'dark' | null = 'dark') {
  let notify: ((e: { payload: 'light' | 'dark' }) => void) | undefined
  const unlisten = vi.fn()
  const clipboard = { readText: vi.fn(async () => 'copied'), writeText: vi.fn(async () => {}) }
  const opener = { openUrl: vi.fn(async () => {}) }
  const os = { platform: vi.fn(() => 'linux') }
  const app = { getVersion: vi.fn(async () => '1.2.3') }
  const windowApi = {
    getCurrentWindow: () => ({
      theme: async () => theme,
      onThemeChanged: async (h: typeof notify) => {
        notify = h
        return unlisten
      },
    }),
  }
  registerShellModules({
    '@tauri-apps/plugin-clipboard-manager': async () => clipboard,
    '@tauri-apps/plugin-opener': async () => opener,
    '@tauri-apps/plugin-os': async () => os,
    '@tauri-apps/api/app': async () => app,
    '@tauri-apps/api/window': async () => windowApi,
  })
  return {
    clipboard,
    opener,
    os,
    app,
    unlisten,
    registered: () => !!notify,
    theme: (p: 'light' | 'dark') => notify?.({ payload: p }),
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('tauri native driver', () => {
  it('is returned by selectDriver("tauri") with the clipboard only', () => {
    const driver = selectDriver('tauri')
    expect(driver.name).toBe('tauri')
    expect(driver.clipboard).not.toBeNull()
    for (const key of ['share', 'haptics', 'geolocation', 'camera', 'biometrics'] as const)
      expect(driver[key], key).toBeNull()
  })

  it('reads and writes the clipboard through the plugin', async () => {
    const { clipboard } = fakePlugins()
    const driver = createTauriDriver()
    expect(await driver.clipboard!.readText()).toBe('copied')
    await driver.clipboard!.writeText('hello')
    expect(clipboard.writeText).toHaveBeenCalledWith('hello')
  })

  it('reports the platform, the app version and the theme', async () => {
    fakePlugins('dark')
    const { system } = createTauriDriver()
    expect(await system.platform()).toBe('linux')
    expect(await system.appVersion()).toBe('1.2.3')
    expect(await system.isDark()).toBe(true)
    fakePlugins('light')
    expect(await system.isDark()).toBe(false)
    fakePlugins(null)
    expect(await system.isDark()).toBe(false)
  })

  it('follows the system theme and unsubscribes', async () => {
    const plugins = fakePlugins()
    const seen: boolean[] = []
    const off = createTauriDriver().system.onTheme((dark) => seen.push(dark))
    await vi.waitFor(() => expect(plugins.registered()).toBe(true))
    plugins.theme('light')
    plugins.theme('dark')
    off()
    expect(seen).toEqual([false, true])
    expect(plugins.unlisten).toHaveBeenCalled()
  })

  it('unlistens at once when the theme listener left before the window API loaded', async () => {
    const plugins = fakePlugins()
    createTauriDriver().system.onTheme(() => {})()
    await vi.waitFor(() => expect(plugins.unlisten).toHaveBeenCalled())
  })

  it('stays quiet when the window API cannot load for theme changes', async () => {
    fakePlugins()
    registerShellModules({
      '@tauri-apps/api/window': async () => {
        throw new Error('missing')
      },
    })
    const off = createTauriDriver().system.onTheme(() => {})
    await new Promise((r) => setTimeout(r, 0))
    expect(() => off()).not.toThrow()
  })

  it('opens http, https, mailto and tel links with the opener plugin and refuses the rest', async () => {
    const { opener } = fakePlugins()
    const { system } = createTauriDriver()
    await system.openExternal('https://acme.com/docs')
    await system.openExternal('mailto:ada@acme.com')
    expect(opener.openUrl).toHaveBeenCalledTimes(2)
    await expect(system.openExternal('file:///etc/passwd')).rejects.toThrow(/not allowed/)
    await expect(system.openExternal('not a url')).rejects.toThrow()
    expect(opener.openUrl).toHaveBeenCalledTimes(2)
  })

  it('answers online from the browser', async () => {
    const { system } = createTauriDriver()
    vi.stubGlobal('navigator', { onLine: false })
    expect(await system.isOnline()).toBe(false)
    vi.stubGlobal('navigator', { onLine: true })
    expect(await system.isOnline()).toBe(true)
    vi.stubGlobal('navigator', undefined)
    expect(await system.isOnline()).toBe(true)
  })

  it.each([
    [
      '@tauri-apps/plugin-clipboard-manager',
      (d: ReturnType<typeof createTauriDriver>) => d.clipboard!.readText(),
    ],
    ['@tauri-apps/plugin-os', (d: ReturnType<typeof createTauriDriver>) => d.system.platform()],
    [
      '@tauri-apps/plugin-opener',
      (d: ReturnType<typeof createTauriDriver>) => d.system.openExternal('https://a.co'),
    ],
    ['@tauri-apps/api/app', (d: ReturnType<typeof createTauriDriver>) => d.system.appVersion()],
  ])('rejects with E_DRIVER_UNAVAILABLE naming %s when it is missing', async (missing, call) => {
    fakePlugins()
    registerShellModules({
      [missing]: async () => {
        throw new Error('Cannot find module')
      },
    })
    const error = await call(createTauriDriver()).catch((e: unknown) => e as Error)
    expect(error).toMatchObject({ code: 'E_DRIVER_UNAVAILABLE' })
    expect((error as Error).message).toContain(missing)
    expect((error as Error).message).toContain('@kitr/native')
  })
})
