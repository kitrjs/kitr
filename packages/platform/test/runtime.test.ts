import { createApp, KitrError } from '@kitr/core'
import { describe, expect, it } from 'vitest'
import {
  createPlatform,
  DRIVER_UNAVAILABLE,
  detectRuntime,
  driverUnavailable,
  isDriverUnavailable,
  type PlatformDriver,
  type Runtime,
  runtimeOf,
  runtimes,
  selectRuntimeDriver,
} from '../src'
import { platformProvider } from '../src/provider'

describe('detectRuntime', () => {
  it('is web for a plain browser, an empty scope and the server', () => {
    expect(detectRuntime({})).toBe('web')
    expect(detectRuntime({ navigator: { userAgent: 'Mozilla/5.0 Chrome/120' } })).toBe('web')
    expect(detectRuntime({ Capacitor: { isNativePlatform: () => false } })).toBe('web')
  })

  it('detects Tauri by window.__TAURI_INTERNALS__', () => {
    expect(detectRuntime({ window: { __TAURI_INTERNALS__: {} } })).toBe('tauri')
    expect(detectRuntime({ __TAURI_INTERNALS__: {} })).toBe('tauri')
  })

  it('detects Capacitor by Capacitor.isNativePlatform()', () => {
    expect(detectRuntime({ Capacitor: { isNativePlatform: () => true } })).toBe('capacitor')
    expect(detectRuntime({ window: { Capacitor: { isNativePlatform: () => true } } })).toBe(
      'capacitor',
    )
  })

  it('detects Electron by the preload bridge, process.versions.electron or the user agent', () => {
    expect(detectRuntime({ kitrIpc: {} })).toBe('electron')
    expect(detectRuntime({ process: { versions: { electron: '45.0.0' } } })).toBe('electron')
    expect(detectRuntime({ navigator: { userAgent: 'Mozilla/5.0 Electron/45.0.0' } })).toBe(
      'electron',
    )
    expect(
      detectRuntime({ window: { navigator: { userAgent: 'Mozilla/5.0 Electron/45.0.0' } } }),
    ).toBe('electron')
  })

  it('prefers the more specific shell when signals overlap', () => {
    expect(
      detectRuntime({
        __TAURI_INTERNALS__: {},
        navigator: { userAgent: 'Electron/1' },
        Capacitor: { isNativePlatform: () => true },
      }),
    ).toBe('tauri')
    expect(detectRuntime({ Capacitor: { isNativePlatform: () => true }, kitrIpc: {} })).toBe(
      'capacitor',
    )
  })

  it('reads globalThis by default, which is web under Node', () => {
    expect(detectRuntime()).toBe('web')
  })
})

describe('Platform.runtime and runtimeOf', () => {
  const driver = (overrides: Partial<PlatformDriver> = {}): PlatformDriver => ({
    type: 'web',
    native: false,
    os: () => 'macos',
    ...overrides,
  })

  it('is web for the default driver and for any non-native driver', () => {
    const app = createApp({ environment: 'test' })
    expect(createPlatform(app).runtime).toBe('web')
    expect(createPlatform(app, driver()).runtime).toBe('web')
  })

  it('takes the runtime a driver declares', () => {
    const app = createApp({ environment: 'test' })
    for (const runtime of ['electron', 'tauri', 'capacitor'] as const)
      expect(createPlatform(app, driver({ native: true, runtime })).runtime).toBe(runtime)
  })

  it('detects it for a native driver that does not say', () => {
    const app = createApp({ environment: 'test' })
    expect(createPlatform(app, driver({ native: true })).runtime).toBe('web')
  })

  it('runtimeOf reads the platform service, and detects without one', async () => {
    const detected = createApp({ environment: 'test' })
    expect(runtimeOf(detected)).toBe('web')
    expect(runtimeOf()).toBe('web')

    const app = createApp({ environment: 'test', providers: [platformProvider] })
    app.drivers.register('platform', driver({ native: true, runtime: 'tauri', type: 'desktop' }))
    await app.boot()
    expect(runtimeOf(app)).toBe('tauri')
    expect(app.container.use('platform').runtime).toBe('tauri')
  })

  it('lists every runtime once', () => {
    expect([...runtimes].sort()).toEqual(['capacitor', 'electron', 'tauri', 'web'])
  })
})

describe('driverUnavailable', () => {
  it('names the runtime and the package, with a stable code', () => {
    const error = driverUnavailable('capacitor', 'notifications')
    expect(error).toBeInstanceOf(KitrError)
    expect(error.code).toBe('E_DRIVER_UNAVAILABLE')
    expect(error.code).toBe(DRIVER_UNAVAILABLE)
    expect(error.status).toBe(501)
    expect(error.message).toContain('@kitr/notifications')
    expect(error.message).toContain('capacitor')
    expect(error.message).toContain('fallbackToWeb')
    expect(error.data).toEqual({ runtime: 'capacitor', package: '@kitr/notifications' })
    expect(driverUnavailable('tauri', 'files', 'no dialog plugin').message).toContain(
      'no dialog plugin',
    )
  })

  it('isDriverUnavailable matches only that error', () => {
    expect(isDriverUnavailable(driverUnavailable('electron', 'files'))).toBe(true)
    expect(isDriverUnavailable(new KitrError('NOT_FOUND'))).toBe(false)
    expect(isDriverUnavailable(new Error(DRIVER_UNAVAILABLE))).toBe(false)
    expect(isDriverUnavailable(undefined)).toBe(false)
  })
})

describe('selectRuntimeDriver', () => {
  const table = (unavailable: Runtime[] = []) => ({
    web: () => 'web',
    electron: () => {
      if (unavailable.includes('electron')) throw driverUnavailable('electron', 'files')
      return 'electron'
    },
    tauri: () => {
      if (unavailable.includes('tauri')) throw new Error('boom')
      return 'tauri'
    },
    capacitor: () => 'capacitor',
  })

  it('calls the factory of the runtime', () => {
    for (const runtime of runtimes) expect(selectRuntimeDriver(runtime, table())).toBe(runtime)
  })

  it('throws E_DRIVER_UNAVAILABLE instead of using the web driver', () => {
    expect(() => selectRuntimeDriver('electron', table(['electron']))).toThrow(
      expect.objectContaining({ code: 'E_DRIVER_UNAVAILABLE' }),
    )
  })

  it('falls back to web only when asked', () => {
    expect(selectRuntimeDriver('electron', table(['electron']), { fallbackToWeb: true })).toBe(
      'web',
    )
    expect(() =>
      selectRuntimeDriver('electron', table(['electron']), { fallbackToWeb: false }),
    ).toThrow(/@kitr\/files has no electron driver/)
  })

  it('never hides another error behind the fallback', () => {
    expect(() => selectRuntimeDriver('tauri', table(['tauri']), { fallbackToWeb: true })).toThrow(
      'boom',
    )
  })
})
