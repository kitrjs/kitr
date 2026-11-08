import { describe, expect, it, vi } from 'vitest'
import { capacitorFileStore, createCapacitorDriver } from '../src/drivers/capacitor'

// None of the plugins is installed: importing each fails the way a missing module does.
vi.mock('@capacitor/filesystem', () => {
  throw new Error('Cannot find module')
})
vi.mock('@capacitor/share', () => {
  throw new Error('Cannot find module')
})
vi.mock('@capawesome/capacitor-file-picker', () => {
  throw new Error('Cannot find module')
})

const unavailable = (pkg: string) =>
  expect.objectContaining({
    code: 'E_DRIVER_UNAVAILABLE',
    message: expect.stringContaining(`install ${pkg}`),
    data: { runtime: 'capacitor', package: '@kitr/files' },
  })

describe('capacitor files without their plugins', () => {
  it('rejects each call with E_DRIVER_UNAVAILABLE naming the plugin to install', async () => {
    const driver = createCapacitorDriver()
    await expect(driver.open({})).rejects.toEqual(unavailable('@capawesome/capacitor-file-picker'))
    await expect(driver.save('x', { name: 'x.txt' })).rejects.toEqual(
      unavailable('@capacitor/filesystem'),
    )
    await expect(driver.reveal?.('file:///x')).rejects.toEqual(unavailable('@capacitor/share'))
    await expect(capacitorFileStore().readText('x')).rejects.toEqual(
      unavailable('@capacitor/filesystem'),
    )
  })
})
