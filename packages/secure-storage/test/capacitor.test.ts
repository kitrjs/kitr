import { createApp } from '@kitr/core'
import { createPlatform } from '@kitr/platform'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSecureStorage, selectDriver } from '../src'
import { createCapacitorDriver } from '../src/drivers/capacitor'

const vault = vi.hoisted(() => ({
  setSynchronize: vi.fn(),
  setDefaultKeychainAccess: vi.fn(),
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  keys: vi.fn(),
}))

vi.mock('@aparajita/capacitor-secure-storage', () => ({
  SecureStorage: vault,
  KeychainAccess: { whenUnlockedThisDeviceOnly: 1 },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('capacitor secure storage driver', () => {
  it('is a secure, Keychain-backed driver', () => {
    const driver = createCapacitorDriver()
    expect(driver.name).toBe('capacitor-keychain')
    expect(driver.secure).toBe(true)
  })

  it('stores, reads, removes and lists strings in the vault', async () => {
    const driver = createCapacitorDriver()
    await driver.set('session', 'tok')
    expect(vault.setItem).toHaveBeenCalledWith('session', 'tok')
    vault.getItem.mockResolvedValue('tok')
    expect(await driver.get('session')).toBe('tok')
    vault.getItem.mockResolvedValue(null)
    expect(await driver.get('missing')).toBeNull()
    await driver.remove('session')
    expect(vault.removeItem).toHaveBeenCalledWith('session')
    vault.keys.mockResolvedValue(['a', 'b'])
    expect(await driver.keys?.()).toEqual(['a', 'b'])
  })

  it('configures the vault once: no iCloud sync, this device only', async () => {
    const driver = createCapacitorDriver()
    await driver.set('a', '1')
    await driver.set('b', '2')
    await driver.get('a')
    expect(vault.setSynchronize).toHaveBeenCalledTimes(1)
    expect(vault.setSynchronize).toHaveBeenCalledWith(false)
    expect(vault.setDefaultKeychainAccess).toHaveBeenCalledTimes(1)
    expect(vault.setDefaultKeychainAccess).toHaveBeenCalledWith(1)
  })

  it('tries configuring again after a failure', async () => {
    vault.setSynchronize.mockRejectedValueOnce(new Error('bridge not ready'))
    const driver = createCapacitorDriver()
    await expect(driver.get('a')).rejects.toThrow('bridge not ready')
    vault.getItem.mockResolvedValue('v')
    expect(await driver.get('a')).toBe('v')
  })
})

describe('driver selection', () => {
  it('selectDriver picks the Keychain driver for the capacitor runtime', () => {
    expect(selectDriver('capacitor').name).toBe('capacitor-keychain')
  })

  it('serves the secure-storage service in a Capacitor shell', async () => {
    const app = createApp({ environment: 'test' })
    app.drivers.register('platform', {
      type: 'mobile',
      native: true,
      runtime: 'capacitor',
      os: () => 'ios',
    })
    app.container.singleton('platform', () => createPlatform(app))
    const storage = createSecureStorage({}, app)
    expect(storage.secure).toBe(true)
    await storage.set('token', 'abc')
    expect(vault.setItem).toHaveBeenCalled()
  })
})
