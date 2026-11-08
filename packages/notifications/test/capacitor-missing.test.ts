import { describe, expect, it, vi } from 'vitest'
import { capacitorPush, createCapacitorDriver } from '../src/drivers/capacitor'

// Neither plugin is installed: importing each fails the way a missing module does.
vi.mock('@capacitor/local-notifications', () => {
  throw new Error('Cannot find module')
})
vi.mock('@capacitor/push-notifications', () => {
  throw new Error('Cannot find module')
})

const unavailable = (pkg: string) =>
  expect.objectContaining({
    code: 'E_DRIVER_UNAVAILABLE',
    message: expect.stringContaining(`install ${pkg}`),
    data: { runtime: 'capacitor', package: '@kitr/notifications' },
  })

describe('capacitor notifications without their plugins', () => {
  it('rejects each call with E_DRIVER_UNAVAILABLE naming the plugin to install', async () => {
    const driver = createCapacitorDriver()
    await expect(driver.permission()).rejects.toEqual(unavailable('@capacitor/local-notifications'))
    await expect(driver.show({ id: 'a', title: 'T' })).rejects.toEqual(
      unavailable('@capacitor/local-notifications'),
    )
    await expect(capacitorPush().register()).rejects.toEqual(
      unavailable('@capacitor/push-notifications'),
    )
  })

  it('onTap never throws: the listeners just never attach', () => {
    const off = createCapacitorDriver().onTap(() => {})
    expect(() => off()).not.toThrow()
  })
})
