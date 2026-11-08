import { createApp, type DevtoolsHub } from '@kitr/core'
import { createPlatform } from '@kitr/platform'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IPC_BRIDGE_KEY } from '../src/client'
import desktopProvider, { electronStorageDriver, desktopProvider as named } from '../src/provider'

function fakeBridge(handlers: Record<string, (...args: unknown[]) => unknown> = {}) {
  const invoke = vi.fn(async (channel: string, ...args: unknown[]) => handlers[channel]?.(...args))
  ;(globalThis as Record<string, unknown>)[IPC_BRIDGE_KEY] = {
    invoke,
    on: () => () => {},
    send: () => {},
  }
  return invoke
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>)[IPC_BRIDGE_KEY]
  vi.unstubAllGlobals()
})

async function boot() {
  const app = createApp({ environment: 'test' })
  const logs: string[] = []
  app.container.singleton(
    'devtools',
    () => ({ log: (_c: string, m: string) => logs.push(m) }) as unknown as DevtoolsHub,
  )
  await desktopProvider.register?.(app)
  await desktopProvider.boot?.(app)
  return { app, logs }
}

describe('desktop provider', () => {
  it('is the default and the named export', () => {
    expect(named).toBe(desktopProvider)
    expect(desktopProvider.name).toBe('desktop')
  })

  it('does nothing in a plain browser', async () => {
    const { app, logs } = await boot()
    expect(app.drivers.capabilities()).toEqual([])
    expect(logs).toEqual([])
  })

  it('registers the platform and storage drivers inside Electron', async () => {
    fakeBridge()
    const { app, logs } = await boot()
    expect(app.drivers.capabilities().sort()).toEqual(['platform', 'storage'])
    expect(app.drivers.describe('platform')?.platform).toBe('desktop')
    expect(app.drivers.describe('storage')?.platform).toBe('desktop')
    expect(logs[0]).toContain('electron shell')
    const platform = createPlatform(app)
    expect(platform).toMatchObject({ type: 'desktop', native: true, runtime: 'electron' })
    expect(platform.standalone).toBe(true)
  })

  it('detects Electron from the user agent as well', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Electron/45.0.0',
    })
    const { app } = await boot()
    expect(app.drivers.has('platform')).toBe(true)
    expect(createPlatform(app).os).toBe('macos')
  })

  it('answers the app version, opens links and quits over the kitr IPC channels', async () => {
    const invoke = fakeBridge({ 'kitr:app:version': () => '3.2.1' })
    const { app } = await boot()
    const platform = createPlatform(app)
    expect(await platform.appVersion()).toBe('3.2.1')
    await platform.openExternal('https://acme.com/docs')
    await platform.exit()
    expect(invoke.mock.calls).toEqual([
      ['kitr:app:version'],
      ['kitr:shell:open', 'https://acme.com/docs'],
      ['kitr:app:quit'],
    ])
  })

  it('follows the page visibility for app state', async () => {
    fakeBridge()
    const listeners = new Map<string, () => void>()
    const doc = {
      visibilityState: 'visible',
      addEventListener: (e: string, l: () => void) => void listeners.set(e, l),
      removeEventListener: (e: string) => void listeners.delete(e),
    }
    vi.stubGlobal('document', doc)
    const { app } = await boot()
    const seen: boolean[] = []
    const stop = createPlatform(app).onAppState((active) => seen.push(active))
    doc.visibilityState = 'hidden'
    listeners.get('visibilitychange')?.()
    stop()
    expect(seen).toEqual([false])
  })

  it('rejects, naming the shell, when the preload bridge is missing but the user agent says Electron', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Electron/45.0.0' })
    const { app } = await boot()
    await expect(createPlatform(app).appVersion()).rejects.toThrow(/\[kitr\/desktop\]/)
  })
})

describe('electronStorageDriver', () => {
  it('hydrates from main and writes through the kitr:storage channels', async () => {
    const invoke = fakeBridge({ 'kitr:storage:load': () => ({ theme: 'dark' }) })
    const driver = electronStorageDriver()
    await driver.hydrate?.()
    expect(driver.get('theme')).toBe('dark')
    driver.set('lang', 'de')
    driver.remove('theme')
    await Promise.resolve()
    expect(driver.keys()).toEqual(['lang'])
    expect(invoke).toHaveBeenCalledWith('kitr:storage:set', 'lang', 'de')
    expect(invoke).toHaveBeenCalledWith('kitr:storage:remove', 'theme')
  })

  it('starts empty and quiet without a bridge', async () => {
    const driver = electronStorageDriver()
    await driver.hydrate?.()
    expect(driver.keys()).toEqual([])
    driver.set('a', '1')
    driver.remove('a')
  })
})
