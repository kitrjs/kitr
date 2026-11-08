import { describe, expect, it, vi } from 'vitest'
import { createCapacitorDriver } from '../src/drivers/capacitor'

// The plugin is not installed: importing it fails the way a missing module does.
vi.mock('@capawesome/capacitor-app-update', () => {
  throw new Error('Cannot find module')
})

const unavailable = expect.objectContaining({
  code: 'E_DRIVER_UNAVAILABLE',
  message: expect.stringContaining('install @capawesome/capacitor-app-update'),
  data: { runtime: 'capacitor', package: '@kitr/updater' },
})

describe('capacitor updater without its plugin', () => {
  it('rejects each call with E_DRIVER_UNAVAILABLE naming the plugin to install', async () => {
    const driver = createCapacitorDriver()
    await expect(driver.check()).rejects.toEqual(unavailable)
    await expect(driver.apply()).rejects.toEqual(unavailable)
    await expect(driver.currentVersion?.()).rejects.toEqual(unavailable)
  })
})
