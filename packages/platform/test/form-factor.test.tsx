import { createApp } from '@kitr/core'
import { KitrProvider } from '@kitr/react'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  createPlatform,
  fallbackFormFactor,
  forPlatform,
  type PlatformDriver,
  perPlatform,
  readFormFactor,
  widthClass,
} from '../src'
import { Except, Only, useFormFactor } from '../src/react'

function driver(overrides: Partial<PlatformDriver> = {}): PlatformDriver {
  return { type: 'web', native: false, os: () => 'macos', ...overrides }
}

async function appWith(d: PlatformDriver) {
  const app = createApp()
  app.drivers.register('platform', d)
  app.container.singleton('platform', () => createPlatform(app))
  await app.boot()
  return app
}

function fakeWindow(width: number, height: number, queries: Record<string, boolean> = {}) {
  return {
    innerWidth: width,
    innerHeight: height,
    matchMedia: (q: string) => ({ matches: queries[q] ?? false }) as MediaQueryList,
  }
}

describe('widthClass and readFormFactor', () => {
  it('classifies widths at 768 and 1024 by default', () => {
    expect(widthClass(375)).toBe('compact')
    expect(widthClass(767)).toBe('compact')
    expect(widthClass(768)).toBe('medium')
    expect(widthClass(1023)).toBe('medium')
    expect(widthClass(1024)).toBe('expanded')
    expect(widthClass(900, { expanded: 900 })).toBe('expanded')
  })

  it('reads width, input and orientation from the window', () => {
    const phone = readFormFactor(
      fakeWindow(390, 844, { '(pointer: coarse)': true, '(hover: hover)': false }),
    )
    expect(phone).toEqual({
      width: 'compact',
      input: 'touch',
      orientation: 'portrait',
      ready: true,
    })
    const laptop = readFormFactor(
      fakeWindow(1440, 900, { '(pointer: coarse)': false, '(hover: hover)': true }),
    )
    expect(laptop).toEqual({
      width: 'expanded',
      input: 'pointer',
      orientation: 'landscape',
      ready: true,
    })
    // A touch laptop still has a hover-capable pointer: pointer affordances.
    const touchLaptop = readFormFactor(
      fakeWindow(1280, 800, { '(pointer: coarse)': true, '(hover: hover)': true }),
    )
    expect(touchLaptop.input).toBe('pointer')
  })

  it('falls back to a phone, or to a wide pointer window in a desktop shell', () => {
    expect(fallbackFormFactor({ type: 'web' })).toEqual({
      width: 'compact',
      input: 'touch',
      orientation: 'portrait',
      ready: false,
    })
    expect(fallbackFormFactor({ type: 'desktop' }).width).toBe('expanded')
    expect(fallbackFormFactor({ type: 'web' }, { fallback: { width: 'medium' } }).width).toBe(
      'medium',
    )
  })
})

describe('perPlatform and forPlatform by name', () => {
  it('prefers the platform name from kitrrc.ts over the OS and the type', () => {
    const impls = {
      phone: () => 'phone',
      ios: () => 'ios',
      mobile: () => 'mobile',
      default: () => 'default',
    }
    expect(
      perPlatform({ type: 'mobile', os: 'ios', native: true, name: 'phone' as never }, impls),
    ).toBe('phone')
    expect(
      perPlatform({ type: 'mobile', os: 'ios', native: true, name: 'tablet' as never }, impls),
    ).toBe('ios')
    expect(perPlatform({ type: 'mobile', os: 'android', native: true }, impls)).toBe('mobile')
  })

  it('platform.is() matches the name as well as the type and the OS', async () => {
    const app = createApp({ platform: 'phone' as never })
    app.drivers.register('platform', driver({ type: 'mobile', os: () => 'ios' }))
    const platform = createPlatform(app)
    expect(platform.name).toBe('phone')
    expect(platform.is('phone' as never)).toBe(true)
    expect(platform.is('mobile')).toBe(true)
    expect(platform.is('ios')).toBe(true)
    expect(platform.is('desktop')).toBe(false)
  })

  it('forPlatform() returns the default outside a kitr build', () => {
    expect(forPlatform({ www: { ssr: true }, default: { ssr: false } })).toEqual({ ssr: false })
  })
})

describe('useFormFactor, <Only> and <Except>', () => {
  function Probe() {
    const f = useFormFactor()
    return (
      <p>
        {f.width} {f.input} {f.orientation} {String(f.ready)}
      </p>
    )
  }

  it('starts from the fallback and measures the window after mount', async () => {
    const app = await appWith(driver())
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 })
    window.matchMedia = ((q: string) =>
      ({
        matches: q === '(hover: hover)',
        addEventListener() {},
        removeEventListener() {},
      }) as unknown as MediaQueryList) as typeof window.matchMedia
    await act(async () => {
      render(
        <KitrProvider app={app}>
          <Probe />
        </KitrProvider>,
      )
    })
    expect(screen.getByText('expanded pointer landscape true')).toBeTruthy()
    await act(async () => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 600 })
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
      window.dispatchEvent(new Event('resize'))
    })
    expect(screen.getByText('compact pointer portrait true')).toBeTruthy()
  })

  it('renders by platform name, type, OS, shell and form factor', async () => {
    const app = createApp({ platform: 'phone' as never })
    app.drivers.register('platform', driver({ type: 'mobile', native: true, os: () => 'ios' }))
    app.container.singleton('platform', () => createPlatform(app))
    await app.boot()
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 })
    window.matchMedia = ((q: string) =>
      ({
        matches: q === '(pointer: coarse)',
        addEventListener() {},
        removeEventListener() {},
      }) as unknown as MediaQueryList) as typeof window.matchMedia
    await act(async () => {
      render(
        <KitrProvider app={app}>
          <Only platform={'phone' as never}>
            <span>name</span>
          </Only>
          <Only platform={['tablet', 'www'] as never} fallback={<span>not those</span>}>
            <span>other names</span>
          </Only>
          <Only type="mobile" os="ios" native>
            <span>ios shell</span>
          </Only>
          <Only width="compact" input="touch">
            <span>compact touch</span>
          </Only>
          <Only width="expanded">
            <span>wide</span>
          </Only>
          <Except os="android">
            <span>not android</span>
          </Except>
          <Except type="mobile">
            <span>not mobile</span>
          </Except>
        </KitrProvider>,
      )
    })
    expect(screen.getByText('name')).toBeTruthy()
    expect(screen.getByText('not those')).toBeTruthy()
    expect(screen.queryByText('other names')).toBeNull()
    expect(screen.getByText('ios shell')).toBeTruthy()
    expect(screen.getByText('compact touch')).toBeTruthy()
    expect(screen.queryByText('wide')).toBeNull()
    expect(screen.getByText('not android')).toBeTruthy()
    expect(screen.queryByText('not mobile')).toBeNull()
  })
})
