import { createApp } from '@kitr/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import webProvider, { webProvider as named } from '../src/provider'

afterEach(() => vi.unstubAllGlobals())

async function platform() {
  const app = createApp({ environment: 'test' })
  await webProvider.register?.(app)
  return app.drivers.resolve('platform')!
}

describe('web provider', () => {
  it('is the default and the named export', () => {
    expect(named).toBe(webProvider)
    expect(webProvider.name).toBe('web')
  })

  it('registers the browser as the web platform at priority 0', async () => {
    const app = createApp({ environment: 'test' })
    await webProvider.register?.(app)
    expect(app.drivers.describe('platform')).toMatchObject({ platform: 'web', priority: 0 })
    expect(app.drivers.resolve('platform')).toMatchObject({ type: 'web', native: false })
  })

  it('names the server when there is no navigator, and is not standalone', async () => {
    vi.stubGlobal('navigator', undefined)
    vi.stubGlobal('window', undefined)
    const driver = await platform()
    expect(driver.os()).toBe('server')
    expect(driver.standalone()).toBe(false)
  })

  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'ios'],
    ['Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', 'ios'],
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8)', 'android'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'macos'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'windows'],
    ['Mozilla/5.0 (X11; Linux x86_64)', 'linux'],
    ['SomethingElse/1.0', 'unknown'],
  ])('reads the OS from %s', async (ua, os) => {
    vi.stubGlobal('navigator', { userAgent: ua })
    expect((await platform()).os()).toBe(os)
  })

  it('is standalone when the display mode says so or iOS reports it', async () => {
    vi.stubGlobal('navigator', { userAgent: 'x' })
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) })
    expect((await platform()).standalone()).toBe(true)
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
    expect((await platform()).standalone()).toBe(false)
    vi.stubGlobal('navigator', { userAgent: 'x', standalone: true })
    expect((await platform()).standalone()).toBe(true)
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', { userAgent: 'x' })
    expect((await platform()).standalone()).toBe(false)
  })
})
