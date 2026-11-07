import { createApp } from '@kitr/core'
import { describe, expect, it } from 'vitest'
import { createMemoryNativeDrivers, createNative, UnsupportedError } from '../src'
import nativeProvider from '../src/provider'

describe('native', () => {
  it('uses configured drivers and reports support', async () => {
    const drivers = createMemoryNativeDrivers()
    const native = createNative({ drivers })
    await native.clipboard.writeText('hi')
    expect(await native.clipboard.readText()).toBe('hi')
    expect(await native.share.share({ url: 'https://x.y' })).toBe(true)
    expect(drivers.shared).toHaveLength(1)
    await native.haptics.impact('success')
    expect(drivers.haptics_log).toEqual(['success'])
    expect(native.supported()).toEqual({
      clipboard: true,
      share: true,
      haptics: true,
      geolocation: true,
      camera: true,
      biometrics: true,
    })
  })

  it('exposes unsupported capabilities that throw a typed error', async () => {
    const native = createNative()
    expect(native.biometrics.supported).toBe(false)
    expect(await native.biometrics.available()).toBe(false)
    expect(native.share.canShare({})).toBe(false)
    await expect(native.share.share({})).rejects.toBeInstanceOf(UnsupportedError)
    expect(native.geolocation.watch(() => {})).toBeTypeOf('function')
  })

  it('prefers a registered platform driver over the web one', async () => {
    const app = createApp({ environment: 'client', providers: [nativeProvider] })
    const log: string[] = []
    app.drivers.register(
      'haptics',
      { impact: async (k) => void log.push(k) },
      { platform: 'mobile' },
    )
    await app.boot()
    const native = app.container.use('native')
    expect(native.haptics.name).toBe('mobile')
    await native.haptics.impact('light')
    expect(log).toEqual(['light'])
  })
})
