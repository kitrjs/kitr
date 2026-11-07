import { afterEach, describe, expect, it, vi } from 'vitest'
import { isNative, isPluginAvailable, nativeOnly, perPlatform, platform } from '../src'

afterEach(() => {
  delete (globalThis as any).Capacitor
})

const fakeCapacitor = (p: string) => {
  ;(globalThis as any).Capacitor = {
    getPlatform: () => p,
    isNativePlatform: () => p !== 'web',
    isPluginAvailable: (name: string) => name === 'App',
  }
}

describe('capacitor helpers', () => {
  it('report the web without the runtime', async () => {
    expect(platform()).toBe('web')
    expect(isNative()).toBe(false)
    expect(isPluginAvailable('App')).toBe(false)
    const native = vi.fn(async () => 'native')
    expect(await nativeOnly(native, 'web')).toBe('web')
    expect(native).not.toHaveBeenCalled()
  })

  it('read the native runtime', async () => {
    fakeCapacitor('ios')
    expect(platform()).toBe('ios')
    expect(isNative()).toBe(true)
    expect(isPluginAvailable('App')).toBe(true)
    expect(await nativeOnly(async () => 'native', 'web')).toBe('native')
  })

  it('perPlatform picks the most specific implementation', () => {
    const impls = { web: () => 'web', native: () => 'native', android: () => 'android' }
    expect(perPlatform(impls)).toBe('web')
    fakeCapacitor('android')
    expect(perPlatform(impls)).toBe('android')
    fakeCapacitor('ios')
    expect(perPlatform(impls)).toBe('native')
    expect(perPlatform({ web: () => 'web' })).toBe('web')
  })
})
