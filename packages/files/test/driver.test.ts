import { createApp } from '@kitr/core'
import { createPlatform, type Runtime } from '@kitr/platform'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFiles, createMemoryFilesDriver, selectDriver } from '../src'
import { selectDriver as selectFromModule } from '../src/driver'
import { createElectronDriver } from '../src/drivers/electron'
import { createTauriDriver } from '../src/drivers/tauri'
import { createWebFilesDriver } from '../src/drivers/web'

const native = ['electron', 'tauri'] as const

/** An app whose `platform` service reports `runtime`, as the desktop, tauri and mobile providers make it. */
function appIn(runtime: Runtime) {
  const app = createApp({ environment: 'test' })
  if (runtime !== 'web') {
    app.drivers.register('platform', {
      type: runtime === 'capacitor' ? 'mobile' : 'desktop',
      native: true,
      runtime,
      os: () => 'linux',
    })
    app.container.singleton('platform', () => createPlatform(app))
  }
  return app
}

afterEach(() => vi.unstubAllGlobals())

describe('files selectDriver', () => {
  it('is exported from the package and from ./driver', () => {
    expect(selectFromModule).toBe(selectDriver)
  })

  it('picks the web driver for the web runtime', () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', {})
    expect(selectDriver('web').name).toBe('web')
  })

  it('picks the server stand-in for the web runtime without a window', () => {
    expect(selectDriver('web').name).toBe('memory')
  })

  it.each(native)('throws E_DRIVER_UNAVAILABLE naming %s and the package', (runtime) => {
    const error = (() => {
      try {
        selectDriver(runtime)
      } catch (e) {
        return e
      }
    })() as { code: string; message: string; data: unknown }
    expect(error.code).toBe('E_DRIVER_UNAVAILABLE')
    expect(error.message).toContain('@kitr/files')
    expect(error.message).toContain(runtime)
    expect(error.data).toEqual({ runtime, package: '@kitr/files' })
  })

  it.each(native)('uses the web driver in the %s WebView only with fallbackToWeb', (runtime) => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', {})
    expect(selectDriver(runtime, { fallbackToWeb: true }).name).toBe('web')
  })

  it('has a placeholder module per shell, each throwing', () => {
    for (const make of [createElectronDriver, createTauriDriver])
      expect(() => make()).toThrow(expect.objectContaining({ code: 'E_DRIVER_UNAVAILABLE' }))
  })

  it('exposes the web driver module', () => {
    expect(createWebFilesDriver).toBeTypeOf('function')
  })
})

describe('files service per runtime', () => {
  it('works in a plain browser and on the server', () => {
    expect(() => createFiles({}, appIn('web'))).not.toThrow()
    expect(() => createFiles()).not.toThrow()
  })

  it.each(native)(
    'throws in the %s shell instead of running web code in the WebView',
    (runtime) => {
      expect(() => createFiles({}, appIn(runtime))).toThrow(
        expect.objectContaining({ code: 'E_DRIVER_UNAVAILABLE' }),
      )
    },
  )

  it.each(native)('runs the web driver in the %s shell with fallbackToWeb: true', (runtime) => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', {})
    expect(() => createFiles({ fallbackToWeb: true }, appIn(runtime))).not.toThrow()
  })

  it.each(native)(
    'prefers a driver the platform registered over the placeholder in %s',
    (runtime) => {
      const app = appIn(runtime)
      app.drivers.register('files', createMemoryFilesDriver(), { platform: runtime })
      expect(() => createFiles({}, app)).not.toThrow()
    },
  )

  it.each(native)('prefers a configured driver in %s', (runtime) => {
    const driver = createMemoryFilesDriver()
    expect(createFiles({ driver }, appIn(runtime)).driver).toBe(driver)
  })
})
