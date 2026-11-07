import { afterEach, describe, expect, it, vi } from 'vitest'
import { capacitorPlatform, isCapacitor, isPluginAvailable, nativeOnly } from '../src/client'

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
    expect(capacitorPlatform()).toBe('web')
    expect(isCapacitor()).toBe(false)
    expect(isPluginAvailable('App')).toBe(false)
    const native = vi.fn(async () => 'native')
    expect(await nativeOnly(native, 'web')).toBe('web')
    expect(native).not.toHaveBeenCalled()
  })

  it('read the native runtime', async () => {
    fakeCapacitor('ios')
    expect(capacitorPlatform()).toBe('ios')
    expect(isCapacitor()).toBe(true)
    expect(isPluginAvailable('App')).toBe(true)
    expect(await nativeOnly(async () => 'native', 'web')).toBe('native')
  })
})
