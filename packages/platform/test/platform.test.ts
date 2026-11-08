import { createApp } from '@kitr/core'
import { describe, expect, it } from 'vitest'
import { createPlatform, deepLinkPath, osFromUserAgent, perPlatform } from '../src'

describe('perPlatform', () => {
  const impls = {
    default: () => 'default',
    native: () => 'native',
    android: () => 'android',
    desktop: () => 'desktop',
  }
  it('picks the most specific implementation: os, then type, then native, then default', () => {
    expect(perPlatform({ type: 'web', os: 'macos', native: false }, impls)).toBe('default')
    expect(perPlatform({ type: 'mobile', os: 'android', native: true }, impls)).toBe('android')
    expect(perPlatform({ type: 'mobile', os: 'ios', native: true }, impls)).toBe('native')
    expect(perPlatform({ type: 'desktop', os: 'windows', native: true }, impls)).toBe('desktop')
  })
})

describe('deepLinkPath', () => {
  it('strips schemes and configured prefixes', () => {
    expect(deepLinkPath('myapp://projects/1')).toBe('/projects/1')
    expect(deepLinkPath('https://example.com/app/projects/1', ['/app'])).toBe('/projects/1')
  })
})

// Regression: `deepLinkPrefixes` in config/platform.ts was read by nothing; every app had to
// thread it through to deepLinkPath() by hand.
describe('platform.linkPath', () => {
  it('strips the deepLinkPrefixes from config/platform.ts', () => {
    const app = createApp({
      environment: 'test',
      config: { platform: { deepLinkPrefixes: ['/open'] } },
    })
    const platform = createPlatform(app)
    expect(platform.linkPath('acme://open/orders/1042')).toBe('/orders/1042')
    expect(platform.linkPath('acme://orders/7')).toBe('/orders/7')
  })

  it('works without config/platform.ts', () => {
    expect(createPlatform(createApp({ environment: 'test' })).linkPath('acme://a/b')).toBe('/a/b')
  })
})

describe('osFromUserAgent', () => {
  it('recognises the common platforms', () => {
    expect(osFromUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios')
    expect(osFromUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('android')
    expect(osFromUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')).toBe('macos')
    expect(osFromUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('windows')
    expect(osFromUserAgent('Mozilla/5.0 (X11; Linux x86_64)')).toBe('linux')
  })
})
