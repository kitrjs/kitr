import { createApp, type DevtoolsHub } from '@kitr/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPlatform } from '../src'
import {
  createShell,
  createShellDriver,
  createShellProvider,
  type ShellOptions,
  userAgentOs,
  visibilityAppState,
} from '../src/shell'

const base: ShellOptions = {
  name: 'desktop',
  platform: 'desktop',
  type: 'desktop',
  runtime: 'electron',
  detect: () => true,
  os: () => 'macos',
}

async function bootWith(options: ShellOptions) {
  const app = createApp({ environment: 'test' })
  const logs: string[] = []
  app.container.singleton(
    'devtools',
    () => ({ log: (_c: string, m: string) => logs.push(m) }) as unknown as DevtoolsHub,
  )
  const provider = createShellProvider(options)
  await provider.register?.(app)
  await provider.boot?.(app)
  return { app, logs, provider }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createShellProvider', () => {
  it('is named after the shell package', () => {
    expect(createShellProvider(base).name).toBe('desktop')
  })

  it('registers a native platform driver tagged with the runtime inside the shell', async () => {
    const { app } = await bootWith(base)
    const driver = app.drivers.resolve('platform')!
    expect(driver).toMatchObject({ type: 'desktop', native: true, runtime: 'electron' })
    expect(driver.os()).toBe('macos')
    expect(driver.standalone?.()).toBe(true)
    expect(app.drivers.describe('platform')?.platform).toBe('desktop')
    const platform = createPlatform(app)
    expect(platform.runtime).toBe('electron')
    expect(platform.native).toBe(true)
    expect(platform.is('desktop')).toBe(true)
  })

  it('does nothing in a plain browser, so the web build keeps working', async () => {
    const { app, logs } = await bootWith({ ...base, detect: () => false, register: vi.fn() })
    expect(app.drivers.has('platform')).toBe(false)
    expect(logs).toEqual([])
  })

  it('detects the runtime when the shell gives no detect()', async () => {
    const options = { ...base, detect: undefined, runtime: 'capacitor' as const }
    expect((await bootWith(options)).app.drivers.has('platform')).toBe(false)
    vi.stubGlobal('Capacitor', { isNativePlatform: () => true })
    expect((await bootWith(options)).app.drivers.has('platform')).toBe(true)
  })

  it("lets the shell register its other drivers, and merges the shell's own hooks", async () => {
    const register = vi.fn()
    const exit = vi.fn(async () => {})
    const { app } = await bootWith({
      ...base,
      driver: () => ({ exit, appVersion: async () => '2.1.0' }),
      register,
    })
    expect(register).toHaveBeenCalledOnce()
    expect(register.mock.calls[0]![0]).toBe(app)
    const platform = createPlatform(app)
    expect(await platform.appVersion()).toBe('2.1.0')
    await platform.exit()
    expect(exit).toHaveBeenCalled()
  })

  it("lets a shell's hooks replace the shared app-state default", async () => {
    const onAppState = vi.fn(() => () => {})
    const { app } = await bootWith({ ...base, driver: () => ({ onAppState }) })
    createPlatform(app).onAppState(() => {})
    expect(onAppState).toHaveBeenCalled()
  })

  it('logs the runtime and the registered drivers to devtools at boot', async () => {
    const { logs } = await bootWith({
      ...base,
      register: (app) => void app.drivers.register('storage', {} as never),
    })
    expect(logs).toEqual(['electron shell (macos), drivers: platform, storage'])
  })

  it('runs without a devtools hub', async () => {
    const app = createApp({ environment: 'test' })
    const provider = createShellProvider(base)
    await provider.register?.(app)
    await expect(Promise.resolve(provider.boot?.(app))).resolves.toBeUndefined()
  })
})

describe('createShell', () => {
  it('invokes the bridge, and rejects naming the shell when there is none', async () => {
    const invoke = vi.fn(async (channel: string, ...args: unknown[]) => [channel, ...args])
    const withBridge = createShell({ ...base, bridge: () => ({ invoke }) })
    expect(withBridge.bridge()).toBeDefined()
    expect(await withBridge.invoke('kitr:app:version', 1)).toEqual(['kitr:app:version', 1])

    const without = createShell({ ...base, bridge: () => undefined })
    await expect(without.invoke('kitr:app:version')).rejects.toThrow(
      /\[@kitr\/desktop\] the electron bridge is not available/,
    )
    await expect(createShell(base).invoke('x')).rejects.toThrow(/not available/)
    expect(createShell(base).bridge()).toBeUndefined()
  })

  it('answers os() from the shell, else the user agent', () => {
    expect(createShell(base).os()).toBe('macos')
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' })
    expect(createShell({ ...base, os: undefined }).os()).toBe('windows')
    expect(userAgentOs()).toBe('windows')
  })

  it('knows whether it is active', () => {
    expect(createShell(base).active()).toBe(true)
    expect(createShell({ ...base, detect: () => false }).active()).toBe(false)
    expect(createShell({ ...base, detect: undefined }).active()).toBe(false)
  })

  it('shares the runtime on the driver it builds', () => {
    expect(createShellDriver(base).runtime).toBe('electron')
    expect(createShell(base).runtime).toBe('electron')
  })
})

describe('visibilityAppState', () => {
  it('reports foreground and background from document visibility, and unsubscribes', () => {
    const listeners = new Map<string, () => void>()
    const doc = {
      visibilityState: 'visible',
      addEventListener: (event: string, l: () => void) => void listeners.set(event, l),
      removeEventListener: (event: string) => void listeners.delete(event),
    }
    vi.stubGlobal('document', doc)
    const seen: boolean[] = []
    const stop = visibilityAppState((active) => seen.push(active))
    doc.visibilityState = 'hidden'
    listeners.get('visibilitychange')?.()
    doc.visibilityState = 'visible'
    listeners.get('visibilitychange')?.()
    expect(seen).toEqual([false, true])
    stop()
    expect(listeners.size).toBe(0)
  })

  it('is a no-op on the server', () => {
    vi.stubGlobal('document', undefined)
    const stop = visibilityAppState(() => {})
    expect(stop).toBeTypeOf('function')
    stop()
  })

  it('userAgentOs is unknown without a navigator', () => {
    vi.stubGlobal('navigator', undefined)
    expect(userAgentOs()).toBe('unknown')
  })
})
