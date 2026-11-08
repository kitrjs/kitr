import { describe, expect, it } from 'vitest'
import { createMemoryNativeDrivers } from '../src'

describe('memory native drivers', () => {
  it('records clipboard, share and haptics calls and answers the rest with fixed values', async () => {
    const d = createMemoryNativeDrivers()
    await d.clipboard.writeText('hi')
    expect(await d.clipboard.readText()).toBe('hi')
    expect(d.share.canShare()).toBe(true)
    expect(await d.share.share({ title: 'x' })).toBe(true)
    expect(d.shared).toEqual([{ title: 'x' }])
    await d.haptics.impact('light')
    expect(d.haptics_log).toEqual(['light'])
    expect((await d.geolocation.current()).accuracy).toBe(1)
    expect(typeof d.geolocation.watch(() => {})).toBe('function')
    expect(await d.camera.capture()).toBeNull()
    expect(await d.biometrics.available()).toBe(true)
    expect(await d.biometrics.authenticate('why')).toBe(true)
  })
})
