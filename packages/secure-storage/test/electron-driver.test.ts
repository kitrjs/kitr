import { createApp } from '@kitr/core'
import { createPlatform } from '@kitr/platform'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSecureStorage, selectDriver } from '../src'
import { createElectronDriver } from '../src/drivers/electron'

/** A preload bridge whose main process keeps what `kitr:secure:*` stores in a Map. */
function fakeBridge() {
  const vault = new Map<string, string>()
  const invoke = vi.fn(async (channel: string, ...args: unknown[]) => {
    const [key, value] = args as [string, string]
    if (channel === 'kitr:secure:get') return vault.get(key) ?? null
    if (channel === 'kitr:secure:set') return void vault.set(key, value)
    if (channel === 'kitr:secure:remove') return void vault.delete(key)
    if (channel === 'kitr:secure:keys') return [...vault.keys()]
    throw new Error(`unexpected channel ${channel}`)
  })
  ;(globalThis as Record<string, unknown>).kitrIpc = { invoke, on: () => () => {}, send: () => {} }
  return { invoke, vault }
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).kitrIpc
})

describe('electron secure-storage driver', () => {
  it('stores, reads, lists and removes through the kitr:secure channels', async () => {
    const { invoke } = fakeBridge()
    const driver = createElectronDriver()
    expect(driver.name).toBe('electron-safe-storage')
    expect(driver.secure).toBe(true)
    expect(await driver.get('token')).toBeNull()
    await driver.set('token', 'abc')
    expect(await driver.get('token')).toBe('abc')
    expect(await driver.keys?.()).toEqual(['token'])
    await driver.remove('token')
    expect(await driver.get('token')).toBeNull()
    expect(await driver.keys?.()).toEqual([])
    expect(invoke).toHaveBeenCalledWith('kitr:secure:set', 'token', 'abc')
    expect(invoke).toHaveBeenCalledWith('kitr:secure:remove', 'token')
  })

  it('lets a main-process refusal (no OS vault) reject set()', async () => {
    const { invoke } = fakeBridge()
    invoke.mockRejectedValueOnce(new Error('the operating system has no secret vault'))
    await expect(createElectronDriver().set('k', 'v')).rejects.toThrow(/no secret vault/)
  })

  it('answers [] when main returns no key list', async () => {
    const { invoke } = fakeBridge()
    invoke.mockResolvedValueOnce(undefined)
    expect(await createElectronDriver().keys?.()).toEqual([])
  })

  it('throws E_DRIVER_UNAVAILABLE without the preload bridge', () => {
    expect(() => createElectronDriver()).toThrow(
      expect.objectContaining({ code: 'E_DRIVER_UNAVAILABLE' }),
    )
    expect(() => createElectronDriver()).toThrow(/exposeIpc/)
  })

  it('is what selectDriver("electron") returns', async () => {
    fakeBridge()
    const driver = selectDriver('electron')
    expect(driver.name).toBe('electron-safe-storage')
    await driver.set('a', 'b')
    expect(await driver.get('a')).toBe('b')
  })

  it('backs the service in an Electron app with secure: true under requireSecure', async () => {
    fakeBridge()
    const app = createApp({ environment: 'test' })
    app.drivers.register('platform', {
      type: 'desktop',
      native: true,
      runtime: 'electron',
      os: () => 'linux',
    })
    app.container.singleton('platform', () => createPlatform(app))
    const storage = createSecureStorage({ requireSecure: true }, app)
    expect(storage.secure).toBe(true)
    await storage.set('session', 'xyz')
    expect(await storage.get('session')).toBe('xyz')
    expect(await storage.keys()).toEqual(['session'])
  })
})
