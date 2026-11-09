import { createApp } from '@kitr/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { consoleAdapter, googleAnalytics, memoryAdapter, plausible, posthog } from '../src'
import analyticsProvider from '../src/provider'

afterEach(() => {
  const w = globalThis as any
  delete w.dataLayer
  delete w.gtag
  delete w.plausible
  document.head.innerHTML = ''
  vi.restoreAllMocks()
})

describe('googleAnalytics', () => {
  it('loads gtag once, disables automatic page views and forwards calls', () => {
    const ga = googleAnalytics({ measurementId: 'G-TEST' })
    ga.init?.()
    ga.init?.()
    expect(document.querySelectorAll('script[src*="gtag/js?id=G-TEST"]')).toHaveLength(1)
    ga.page('/x', { url: 'https://a/x', title: 'X' })
    ga.track('signup', { plan: 'pro' })
    ga.identify?.('u1', { plan: 'pro' })
    ga.reset?.()
    const entries: unknown[] = (globalThis as any).dataLayer
    // gtag.js ignores anything but an arguments object, so an array here means nothing is sent.
    for (const entry of entries)
      expect(Object.prototype.toString.call(entry)).toBe('[object Arguments]')
    const layer = entries.map((args) => [...(args as ArrayLike<unknown>)] as unknown[])
    expect(layer[0]).toEqual([
      'consent',
      'default',
      {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      },
    ])
    expect(layer).toContainEqual([
      'config',
      'G-TEST',
      { send_page_view: false, debug_mode: undefined },
    ])
    expect(layer).toContainEqual([
      'event',
      'page_view',
      expect.objectContaining({ page_path: '/x', page_title: 'X' }),
    ])
    expect(layer).toContainEqual(['event', 'signup', { plan: 'pro' }])
    expect(layer).toContainEqual(['set', 'user_properties', { plan: 'pro' }])
    expect(layer).toContainEqual([
      'config',
      'G-TEST',
      { user_id: undefined, send_page_view: false },
    ])
  })
})

describe('googleAnalytics with ads', () => {
  it('grants the ad signals when asked', () => {
    googleAnalytics({ measurementId: 'G-ADS', ads: true }).init?.()
    const first = [...(globalThis as any).dataLayer[0]]
    expect(first[2]).toEqual({
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
    })
  })
})

describe('plausible', () => {
  it('injects the manual script once and queues events before it loads', () => {
    const p = plausible({ domain: 'kitr.dev', apiHost: 'https://stats.kitr.dev/' })
    p.init?.()
    p.init?.()
    const scripts = document.querySelectorAll('script[data-kitr-plausible]')
    expect(scripts).toHaveLength(1)
    expect((scripts[0] as HTMLScriptElement).src).toBe('https://stats.kitr.dev/js/script.manual.js')
    expect((scripts[0] as HTMLScriptElement).dataset.domain).toBe('kitr.dev')
    p.page('/a')
    p.track('clicked', { id: 1 })
    expect((globalThis as any).plausible.q).toEqual([
      ['pageview', { u: '/a', props: undefined }],
      ['clicked', { props: { id: 1 } }],
    ])
  })
})

describe('posthog', () => {
  it('initialises without automatic page views and maps calls', () => {
    const client = { init: vi.fn(), capture: vi.fn(), identify: vi.fn(), reset: vi.fn() }
    const ph = posthog(client, { apiKey: 'k', config: { autocapture: false } })
    ph.init?.()
    expect(client.init).toHaveBeenCalledWith('k', {
      api_host: 'https://us.i.posthog.com',
      capture_pageview: false,
      autocapture: false,
    })
    ph.page('/p')
    ph.track('e')
    ph.identify?.('u', { a: 1 })
    ph.reset?.()
    expect(client.capture.mock.calls).toEqual([
      ['$pageview', { $current_url: '/p' }],
      ['e', null],
    ])
    expect(client.identify).toHaveBeenCalledWith('u', { a: 1 })
    expect(client.reset).toHaveBeenCalled()
  })
})

describe('consoleAdapter', () => {
  it('prints with a prefix', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const a = consoleAdapter({ prefix: '[a]' })
    a.track('x', { y: 1 })
    a.page('/p')
    const all = [...log.mock.calls, ...debug.mock.calls, ...info.mock.calls].flat().map(String)
    expect(all.some((s) => s.includes('[a]'))).toBe(true)
  })
})

describe('analyticsProvider', () => {
  it('logs to the console in development and sends nothing by default in production', async () => {
    const dev = createApp({
      providers: [analyticsProvider],
      mode: 'development',
      environment: 'client',
    })
    await dev.boot()
    const prod = createApp({
      providers: [analyticsProvider],
      mode: 'production',
      environment: 'client',
    })
    await prod.boot()
    expect(dev.container.use('analytics')).toBeDefined()
    expect(prod.container.use('analytics')).toBeDefined()
  })

  it('uses configured adapters and mirrors to devtools', async () => {
    const memory = memoryAdapter()
    const hub = { log: vi.fn(), notify: vi.fn() }
    const app = createApp({
      providers: [analyticsProvider],
      config: { analytics: { adapters: [memory] } },
    })
    app.container.value('devtools', hub as any)
    await app.boot()
    const analytics = app.container.use('analytics')
    await analytics.enable()
    analytics.track('clicked')
    expect(memory.calls).toEqual([{ type: 'track', args: ['clicked', undefined] }])
    expect(hub.log).toHaveBeenCalled()
  })
})
