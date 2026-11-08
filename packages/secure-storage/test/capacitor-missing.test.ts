import { describe, expect, it, vi } from 'vitest'
import { createCapacitorDriver } from '../src/drivers/capacitor'

// The plugin is not installed: importing it fails the way a missing module does.
vi.mock('@aparajita/capacitor-secure-storage', () => {
  throw new Error('Cannot find module')
})

const unavailable = expect.objectContaining({
  code: 'E_DRIVER_UNAVAILABLE',
  message: expect.stringContaining('install @aparajita/capacitor-secure-storage'),
  data: { runtime: 'capacitor', package: '@kitr/secure-storage' },
})

describe('capacitor secure storage without its plugin', () => {
  it('rejects every call instead of writing secrets to WebView storage', async () => {
    const driver = createCapacitorDriver()
    await expect(driver.get('a')).rejects.toEqual(unavailable)
    await expect(driver.set('a', 'b')).rejects.toEqual(unavailable)
    await expect(driver.remove('a')).rejects.toEqual(unavailable)
    await expect(driver.keys?.()).rejects.toEqual(unavailable)
  })
})
