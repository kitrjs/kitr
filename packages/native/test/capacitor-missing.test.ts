import { describe, expect, it, vi } from 'vitest'
import { createCapacitorDriver } from '../src/drivers/capacitor'

// None of the plugins is installed: importing each fails the way a missing module does.
vi.mock('@capacitor/clipboard', () => {
  throw new Error('Cannot find module')
})
vi.mock('@capacitor/share', () => {
  throw new Error('Cannot find module')
})
vi.mock('@capacitor/haptics', () => {
  throw new Error('Cannot find module')
})
vi.mock('@capacitor/geolocation', () => {
  throw new Error('Cannot find module')
})

const unavailable = (pkg: string) =>
  expect.objectContaining({
    code: 'E_DRIVER_UNAVAILABLE',
    message: expect.stringContaining(`install ${pkg}`),
    data: { runtime: 'capacitor', package: '@kitr/native' },
  })

describe('capacitor driver without its plugins', () => {
  it('builds, then rejects each call with E_DRIVER_UNAVAILABLE naming the plugin to install', async () => {
    const driver = createCapacitorDriver()
    await expect(driver.clipboard?.readText()).rejects.toEqual(unavailable('@capacitor/clipboard'))
    await expect(driver.share?.share({ text: 'x' })).rejects.toEqual(
      unavailable('@capacitor/share'),
    )
    await expect(driver.haptics?.impact('light')).rejects.toEqual(unavailable('@capacitor/haptics'))
    await expect(driver.geolocation?.current()).rejects.toEqual(
      unavailable('@capacitor/geolocation'),
    )
  })
})
