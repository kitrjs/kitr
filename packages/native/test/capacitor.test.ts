import { createApp } from '@kitr/core'
import { createPlatform } from '@kitr/platform'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createNative, selectDriver } from '../src'
import {
  capacitorClipboard,
  capacitorGeolocation,
  capacitorHaptics,
  capacitorShare,
  createCapacitorDriver,
} from '../src/drivers/capacitor'

const plugins = vi.hoisted(() => ({
  clipboard: { read: vi.fn(), write: vi.fn() },
  share: { share: vi.fn() },
  haptics: {
    impact: vi.fn(),
    notification: vi.fn(),
    selectionStart: vi.fn(),
    selectionChanged: vi.fn(),
    selectionEnd: vi.fn(),
  },
  geolocation: {
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  },
}))

vi.mock('@capacitor/clipboard', () => ({ Clipboard: plugins.clipboard }))
vi.mock('@capacitor/share', () => ({ Share: plugins.share }))
vi.mock('@capacitor/haptics', () => ({
  Haptics: plugins.haptics,
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
  NotificationType: { Success: 'SUCCESS', Warning: 'WARNING', Error: 'ERROR' },
}))
vi.mock('@capacitor/geolocation', () => ({ Geolocation: plugins.geolocation }))

const fix = {
  timestamp: 1700,
  coords: { latitude: 52.5, longitude: 13.4, accuracy: 8, altitude: 34, heading: 90, speed: 1.5 },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('capacitor clipboard', () => {
  it('reads and writes through the plugin', async () => {
    plugins.clipboard.read.mockResolvedValue({ type: 'text/plain', value: 'copied' })
    const clipboard = capacitorClipboard()
    expect(await clipboard.readText()).toBe('copied')
    await clipboard.writeText('hello')
    expect(plugins.clipboard.write).toHaveBeenCalledWith({ string: 'hello' })
  })

  it('reads an empty clipboard as an empty string', async () => {
    plugins.clipboard.read.mockResolvedValue({ type: 'text/plain' })
    expect(await capacitorClipboard().readText()).toBe('')
  })
})

describe('capacitor share', () => {
  it('shares title, text and url and resolves true', async () => {
    plugins.share.share.mockResolvedValue({})
    const share = capacitorShare()
    expect(await share.share({ title: 'T', text: 'body', url: 'https://kitr.dev' })).toBe(true)
    expect(plugins.share.share).toHaveBeenCalledWith({
      title: 'T',
      text: 'body',
      url: 'https://kitr.dev',
    })
  })

  it('resolves false when the sheet is dismissed and rethrows other failures', async () => {
    const share = capacitorShare()
    plugins.share.share.mockRejectedValueOnce(new Error('Share canceled'))
    expect(await share.share({ text: 'x' })).toBe(false)
    plugins.share.share.mockRejectedValueOnce(new Error('boom'))
    await expect(share.share({ text: 'x' })).rejects.toThrow('boom')
    plugins.share.share.mockRejectedValueOnce('not an error')
    await expect(share.share({ text: 'x' })).rejects.toBe('not an error')
  })

  it('cannot share File objects across the bridge', () => {
    const share = capacitorShare()
    expect(share.canShare({ text: 'x' })).toBe(true)
    expect(share.canShare({ files: [new File(['a'], 'a.txt')] })).toBe(false)
    expect(share.canShare({ files: [] })).toBe(true)
  })
})

describe('capacitor haptics', () => {
  it.each([
    ['light', 'LIGHT'],
    ['medium', 'MEDIUM'],
    ['heavy', 'HEAVY'],
  ] as const)('plays the %s impact', async (kind, style) => {
    await capacitorHaptics().impact(kind)
    expect(plugins.haptics.impact).toHaveBeenCalledWith({ style })
  })

  it.each([
    ['success', 'SUCCESS'],
    ['warning', 'WARNING'],
    ['error', 'ERROR'],
  ] as const)('plays the %s notification', async (kind, type) => {
    await capacitorHaptics().impact(kind)
    expect(plugins.haptics.notification).toHaveBeenCalledWith({ type })
  })

  it('plays a selection tick as start, change, end', async () => {
    await capacitorHaptics().impact('selection')
    expect(plugins.haptics.selectionStart).toHaveBeenCalledTimes(1)
    expect(plugins.haptics.selectionChanged).toHaveBeenCalledTimes(1)
    expect(plugins.haptics.selectionEnd).toHaveBeenCalledTimes(1)
  })
})

describe('capacitor geolocation', () => {
  it('reads the position without asking when permission is already granted', async () => {
    plugins.geolocation.checkPermissions.mockResolvedValue({ location: 'granted' })
    plugins.geolocation.getCurrentPosition.mockResolvedValue(fix)
    const position = await capacitorGeolocation().current({ highAccuracy: true, timeout: 5000 })
    expect(position).toEqual({
      latitude: 52.5,
      longitude: 13.4,
      accuracy: 8,
      altitude: 34,
      heading: 90,
      speed: 1.5,
      timestamp: 1700,
    })
    expect(plugins.geolocation.requestPermissions).not.toHaveBeenCalled()
    expect(plugins.geolocation.getCurrentPosition).toHaveBeenCalledWith({
      enableHighAccuracy: true,
      timeout: 5000,
    })
  })

  it('asks for permission first and reports unknown fields as null', async () => {
    plugins.geolocation.checkPermissions.mockResolvedValue({ location: 'prompt' })
    plugins.geolocation.requestPermissions.mockResolvedValue({ location: 'granted' })
    plugins.geolocation.getCurrentPosition.mockResolvedValue({
      timestamp: 1,
      coords: { latitude: 1, longitude: 2, accuracy: 3 },
    })
    const position = await capacitorGeolocation().current()
    expect(plugins.geolocation.requestPermissions).toHaveBeenCalledWith({
      permissions: ['location'],
    })
    expect(position).toMatchObject({ altitude: null, heading: null, speed: null })
  })

  it('rejects when the permission is refused', async () => {
    plugins.geolocation.checkPermissions.mockResolvedValue({ location: 'prompt' })
    plugins.geolocation.requestPermissions.mockResolvedValue({ location: 'denied' })
    await expect(capacitorGeolocation().current()).rejects.toThrow('permission was denied')
  })

  it('watches, maps each fix, ignores empty ones and stops with clearWatch', async () => {
    plugins.geolocation.checkPermissions.mockResolvedValue({ location: 'granted' })
    let push: (p: unknown) => void = () => {}
    plugins.geolocation.watchPosition.mockImplementation(async (_o, cb) => {
      push = cb
      return 'watch-1'
    })
    const seen: number[] = []
    const stop = capacitorGeolocation().watch((p) => seen.push(p.latitude), { highAccuracy: true })
    await vi.waitFor(() => expect(plugins.geolocation.watchPosition).toHaveBeenCalled())
    expect(plugins.geolocation.watchPosition.mock.calls[0]?.[0]).toEqual({
      enableHighAccuracy: true,
    })
    push(fix)
    push(null)
    expect(seen).toEqual([52.5])
    await Promise.resolve()
    stop()
    await vi.waitFor(() =>
      expect(plugins.geolocation.clearWatch).toHaveBeenCalledWith({ id: 'watch-1' }),
    )
    stop()
    expect(plugins.geolocation.clearWatch).toHaveBeenCalledTimes(1)
  })

  it('clears a watch that was stopped before the plugin answered', async () => {
    plugins.geolocation.checkPermissions.mockResolvedValue({ location: 'granted' })
    plugins.geolocation.watchPosition.mockResolvedValue('late')
    capacitorGeolocation().watch(() => {})()
    await vi.waitFor(() =>
      expect(plugins.geolocation.clearWatch).toHaveBeenCalledWith({ id: 'late' }),
    )
  })

  it('swallows a refused permission while watching', async () => {
    plugins.geolocation.checkPermissions.mockResolvedValue({ location: 'denied' })
    plugins.geolocation.requestPermissions.mockResolvedValue({ location: 'denied' })
    const stop = capacitorGeolocation().watch(() => {})
    await Promise.resolve()
    expect(() => stop()).not.toThrow()
    expect(plugins.geolocation.watchPosition).not.toHaveBeenCalled()
  })
})

describe('capacitor driver selection', () => {
  it('is what selectDriver picks for the capacitor runtime', () => {
    const driver = selectDriver('capacitor')
    expect(driver.name).toBe('capacitor')
    expect(driver.clipboard).not.toBeNull()
    expect(driver.share).not.toBeNull()
    expect(driver.haptics).not.toBeNull()
    expect(driver.geolocation).not.toBeNull()
    expect(driver.camera).toBeNull()
    expect(driver.biometrics).toBeNull()
    expect(createCapacitorDriver().name).toBe('capacitor')
  })

  it('serves the native service in a Capacitor shell, with camera and biometrics unsupported', async () => {
    const app = createApp({ environment: 'test' })
    app.drivers.register('platform', {
      type: 'mobile',
      native: true,
      runtime: 'capacitor',
      os: () => 'ios',
    })
    app.container.singleton('platform', () => createPlatform(app))
    const native = createNative({}, app)
    expect(native.supported()).toEqual({
      clipboard: true,
      share: true,
      haptics: true,
      geolocation: true,
      camera: false,
      biometrics: false,
    })
    expect(native.clipboard.name).toBe('capacitor')
    plugins.clipboard.write.mockResolvedValue(undefined)
    await native.clipboard.writeText('via service')
    expect(plugins.clipboard.write).toHaveBeenCalledWith({ string: 'via service' })
  })
})
