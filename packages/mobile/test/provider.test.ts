import { createApp, type DevtoolsHub } from '@kitr/core'
import { createPlatform } from '@kitr/platform'
import { afterEach, describe, expect, it, vi } from 'vitest'

const listeners = new Map<string, (data: unknown) => void>()
const removed: string[] = []
const App = {
  getInfo: vi.fn(async () => ({ version: '5.0.1' })),
  exitApp: vi.fn(async () => {}),
  addListener: vi.fn(async (event: string, listener: (data: unknown) => void) => {
    listeners.set(event, listener)
    return { remove: async () => void removed.push(event) }
  }),
}
const prefs = new Map<string, string>()
const Preferences = {
  keys: vi.fn(async () => ({ keys: [...prefs.keys()] })),
  get: vi.fn(async ({ key }: { key: string }) => ({ value: prefs.get(key) ?? null })),
  set: vi.fn(async ({ key, value }: { key: string; value: string }) => void prefs.set(key, value)),
  remove: vi.fn(async ({ key }: { key: string }) => void prefs.delete(key)),
}

vi.mock('@capacitor/app', () => ({ App }))
vi.mock('@capacitor/preferences', () => ({ Preferences }))

const {
  default: mobileProvider,
  mobileProvider: named,
  preferencesDriver,
} = await import('../src/provider')

const fakeCapacitor = (platform: string) => {
  ;(globalThis as Record<string, unknown>).Capacitor = {
    getPlatform: () => platform,
    isNativePlatform: () => platform !== 'web',
    isPluginAvailable: () => true,
  }
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).Capacitor
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  listeners.clear()
  removed.length = 0
  prefs.clear()
})

async function boot() {
  const app = createApp({ environment: 'test' })
  const logs: string[] = []
  app.container.singleton(
    'devtools',
    () => ({ log: (_c: string, m: string) => logs.push(m) }) as unknown as DevtoolsHub,
  )
  await mobileProvider.register?.(app)
  await mobileProvider.boot?.(app)
  return { app, logs }
}

describe('mobile provider', () => {
  it('is the default and the named export', () => {
    expect(named).toBe(mobileProvider)
    expect(mobileProvider.name).toBe('mobile')
  })

  it('does nothing in a plain browser', async () => {
    const { app, logs } = await boot()
    expect(app.drivers.capabilities()).toEqual([])
    expect(logs).toEqual([])
  })

  it('registers the platform and storage drivers inside the Capacitor shell', async () => {
    fakeCapacitor('ios')
    const { app, logs } = await boot()
    expect(app.drivers.capabilities().sort()).toEqual(['platform', 'storage'])
    expect(app.drivers.describe('storage')?.platform).toBe('mobile')
    expect(logs[0]).toContain('capacitor shell (ios)')
    const platform = createPlatform(app)
    expect(platform).toMatchObject({
      type: 'mobile',
      native: true,
      runtime: 'capacitor',
      os: 'ios',
    })
    expect(platform.is('ios')).toBe(true)
    expect(platform.standalone).toBe(true)
  })

  it('reads the version, exits and opens links through Capacitor', async () => {
    fakeCapacitor('android')
    const open = vi.fn()
    vi.stubGlobal('window', { open })
    const platform = createPlatform((await boot()).app)
    expect(await platform.appVersion()).toBe('5.0.1')
    await platform.exit()
    await platform.openExternal('https://acme.com')
    expect(App.exitApp).toHaveBeenCalled()
    expect(open).toHaveBeenCalledWith('https://acme.com', '_system')
  })

  it('maps the App plugin events to app state, back button and deep links', async () => {
    fakeCapacitor('android')
    const platform = createPlatform((await boot()).app)
    const state: boolean[] = []
    const back: Array<{ canGoBack: boolean }> = []
    const links: string[] = []
    const stops = [
      platform.onAppState((active) => state.push(active)),
      platform.onBackButton((info) => back.push(info)),
      platform.onDeepLink((url) => links.push(url)),
    ]
    await vi.waitFor(() => expect(listeners.size).toBe(3))
    listeners.get('appStateChange')?.({ isActive: false })
    listeners.get('backButton')?.({ canGoBack: true })
    listeners.get('appUrlOpen')?.({ url: 'acme://orders/1042' })
    expect(state).toEqual([false])
    expect(back).toEqual([{ canGoBack: true }])
    expect(links).toEqual(['acme://orders/1042'])
    for (const stop of stops) stop()
    await vi.waitFor(() =>
      expect(removed.sort()).toEqual(['appStateChange', 'appUrlOpen', 'backButton']),
    )
  })

  it('removes a listener that was cancelled before the plugin answered', async () => {
    fakeCapacitor('ios')
    const platform = createPlatform((await boot()).app)
    platform.onBackButton(() => {})()
    await vi.waitFor(() => expect(removed).toEqual(['backButton']))
  })
})

describe('preferencesDriver', () => {
  it('hydrates from Preferences and writes through in the background', async () => {
    prefs.set('theme', 'dark')
    const driver = preferencesDriver()
    await driver.hydrate?.()
    expect(driver.get('theme')).toBe('dark')
    driver.set('lang', 'de')
    driver.remove('theme')
    await vi.waitFor(() => expect(Preferences.remove).toHaveBeenCalledWith({ key: 'theme' }))
    expect(prefs.get('lang')).toBe('de')
    expect(prefs.has('theme')).toBe(false)
  })
})
