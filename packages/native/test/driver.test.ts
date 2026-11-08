import { createApp } from '@kitr/core'
import { createPlatform, type Runtime } from '@kitr/platform'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createMemoryNativeDrivers,
  createNative,
  type NativeCapability,
  selectDriver,
  webBiometrics,
  webCamera,
  webClipboard,
  webGeolocation,
  webHaptics,
  webShare,
} from '../src'
import { selectDriver as selectFromModule } from '../src/driver'
import { createElectronDriver } from '../src/drivers/electron'
import { createTauriDriver } from '../src/drivers/tauri'

const native = ['electron', 'tauri'] as const
const capabilities: NativeCapability[] = [
  'clipboard',
  'share',
  'haptics',
  'geolocation',
  'camera',
  'biometrics',
]

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

describe('native selectDriver', () => {
  it('is exported from the package and from ./driver', () => {
    expect(selectFromModule).toBe(selectDriver)
  })

  it('answers the browser drivers for the web runtime, null where an API is missing', () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', {
      clipboard: { readText: async () => '', writeText: async () => {} },
      share: async () => {},
      vibrate: () => true,
      geolocation: {},
    })
    vi.stubGlobal('document', {})
    const driver = selectDriver('web')
    expect(driver.name).toBe('web')
    expect(driver.clipboard).not.toBeNull()
    expect(driver.share).not.toBeNull()
    expect(driver.haptics).not.toBeNull()
    expect(driver.geolocation).not.toBeNull()
    expect(driver.camera).not.toBeNull()
    expect(driver.biometrics).toBeNull()
  })

  it('answers no drivers on the server', () => {
    const driver = selectDriver('web')
    for (const key of capabilities) expect(driver[key as keyof typeof driver], key).toBeNull()
  })

  it.each(native)('throws E_DRIVER_UNAVAILABLE naming %s and the package', (runtime) => {
    expect(() => selectDriver(runtime)).toThrow(
      expect.objectContaining({
        code: 'E_DRIVER_UNAVAILABLE',
        data: { runtime, package: '@kitr/native' },
      }),
    )
  })

  it.each(native)('uses the web drivers in the %s WebView only with fallbackToWeb', (runtime) => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('document', {})
    expect(selectDriver(runtime, { fallbackToWeb: true }).name).toBe('web')
  })

  it('has a placeholder module per shell, each throwing', () => {
    for (const make of [createElectronDriver, createTauriDriver])
      expect(() => make()).toThrow(expect.objectContaining({ code: 'E_DRIVER_UNAVAILABLE' }))
  })

  it('exposes every web driver factory', () => {
    for (const make of [
      webClipboard,
      webShare,
      webHaptics,
      webGeolocation,
      webCamera,
      webBiometrics,
    ])
      expect(make()).toBeNull()
  })
})

describe('native service per runtime', () => {
  it('works in a plain browser and on the server', () => {
    expect(() => createNative({}, appIn('web'))).not.toThrow()
    expect(() => createNative()).not.toThrow()
    expect(createNative({}, appIn('web')).supported().clipboard).toBe(false)
  })

  it.each(native)(
    'throws in the %s shell instead of running web code in the WebView',
    (runtime) => {
      expect(() => createNative({}, appIn(runtime))).toThrow(
        expect.objectContaining({ code: 'E_DRIVER_UNAVAILABLE' }),
      )
    },
  )

  it.each(native)('runs the web drivers in the %s shell with fallbackToWeb: true', (runtime) => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', {
      clipboard: { readText: async () => '', writeText: async () => {} },
    })
    const service = createNative({ fallbackToWeb: true }, appIn(runtime))
    expect(service.clipboard.name).toBe('web')
    expect(service.clipboard.supported).toBe(true)
  })

  it.each(native)(
    'does not ask the runtime when every capability has a driver, in %s',
    (runtime) => {
      const drivers = createMemoryNativeDrivers()
      const service = createNative(
        {
          drivers: {
            clipboard: drivers.clipboard,
            share: drivers.share,
            haptics: drivers.haptics,
            geolocation: drivers.geolocation,
            camera: drivers.camera,
            biometrics: drivers.biometrics,
          },
        },
        appIn(runtime),
      )
      expect(Object.values(service.supported()).every(Boolean)).toBe(true)
    },
  )

  it.each(native)('prefers drivers a platform registered over the placeholder in %s', (runtime) => {
    const app = appIn(runtime)
    const drivers = createMemoryNativeDrivers()
    for (const key of capabilities)
      app.drivers.register(key, drivers[key as 'clipboard'] as never, { platform: runtime })
    const service = createNative({}, app)
    expect(service.clipboard.name).toBe(runtime)
    expect(service.supported().biometrics).toBe(true)
  })
})
