import { createAnalytics } from '@kitr/analytics'
import { createApp } from '@kitr/core'
import { createMonitoring } from '@kitr/monitoring'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createConsent } from '../src'
import consentProvider from '../src/provider'

function clearCookies() {
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0]!.trim()
    if (name) document.cookie = `${name}=; max-age=0; path=/`
  }
}

afterEach(() => {
  clearCookies()
})

async function bootWithSpies(config: Record<string, unknown> = { monitoring: 'analytics' }) {
  const reporter = {
    name: 'spy',
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    setUser: vi.fn(),
    addBreadcrumb: vi.fn(),
    setTag: vi.fn(),
  }
  const track = vi.fn()
  const app = createApp({
    environment: 'client',
    providers: [
      {
        name: 'fakes',
        register(app) {
          app.container.singleton('analytics', () =>
            createAnalytics({ enabled: false, adapters: [{ name: 'spy', track }] } as any),
          )
          app.container.singleton('monitoring', () =>
            createMonitoring({
              reporters: [reporter],
              shouldReport: () => true,
              globalHandlers: false,
            } as any),
          )
        },
      },
      consentProvider,
    ],
    config: { consent: config },
  })
  await app.boot()
  return {
    app,
    reporter,
    track,
    monitoring: app.container.use('monitoring') as any,
    consent: app.container.use('consent'),
  }
}

describe('monitoring gate', () => {
  it('holds back messages, breadcrumbs, tags and the user until consent', async () => {
    const { reporter, monitoring, consent } = await bootWithSpies()
    monitoring.captureException(new Error('x'))
    monitoring.captureMessage('hello')
    monitoring.addBreadcrumb({ message: 'clicked' })
    monitoring.setTag('plan', 'pro')
    monitoring.setUser({ id: 'u1', email: 'a@x.test' })
    for (const fn of Object.values(reporter))
      if (typeof fn === 'function') expect(fn).not.toHaveBeenCalled()

    consent.acceptAll()
    // The visitor is identified as soon as they agree, without the app calling setUser again.
    expect(reporter.setUser).toHaveBeenCalledWith({ id: 'u1', email: 'a@x.test' })
    monitoring.captureMessage('after')
    expect(reporter.captureMessage).toHaveBeenCalledTimes(1)

    consent.rejectAll()
    expect(reporter.setUser).toHaveBeenLastCalledWith(null)
    monitoring.captureException(new Error('y'))
    monitoring.setUser({ id: 'u2' })
    expect(reporter.captureException).not.toHaveBeenCalled()
    expect(reporter.setUser).toHaveBeenCalledTimes(2)
  })

  it('wraps the methods once, however often consent changes', async () => {
    const { reporter, monitoring, consent } = await bootWithSpies()
    for (let i = 0; i < 5; i++) {
      consent.acceptAll()
      consent.rejectAll()
    }
    consent.acceptAll()
    monitoring.captureException(new Error('once'))
    expect(reporter.captureException).toHaveBeenCalledTimes(1)
  })

  it('leaves monitoring alone by default', async () => {
    const { reporter, monitoring } = await bootWithSpies({})
    monitoring.captureException(new Error('x'))
    expect(reporter.captureException).toHaveBeenCalledTimes(1)
  })
})

describe('analytics gate', () => {
  it('stays disabled until granted, and disables again on withdrawal', async () => {
    const { app, consent } = await bootWithSpies()
    const analytics = app.container.use('analytics') as any
    expect(analytics.enabled).toBe(false)
    consent.grant(['analytics'])
    await vi.waitFor(() => expect(analytics.enabled).toBe(true))
    consent.rejectAll()
    expect(analytics.enabled).toBe(false)
  })

  it('analytics: false never gates', async () => {
    const { app } = await bootWithSpies({ analytics: false })
    expect((app.container.use('analytics') as any).enabled).toBe(false)
  })
})

describe('consent record', () => {
  it('ignores a cookie with the wrong shape', () => {
    document.cookie = `consent=${encodeURIComponent(JSON.stringify({ granted: 'analytics', version: 1, decidedAt: 'x' }))}; path=/`
    const consent = createConsent()
    expect(consent.decided()).toBe(false)
    expect(consent.has('analytics')).toBe(false)
  })

  it('always keeps necessary, drops unknown categories and dedupes', () => {
    const consent = createConsent({ categories: ['analytics'] })
    consent.grant(['analytics', 'analytics', 'marketing', 'necessary'])
    expect(consent.get().granted).toEqual(['necessary', 'analytics'])
    consent.grant([])
    expect(consent.has('necessary')).toBe(true)
  })

  it('returns the same record object until the choice changes', () => {
    const consent = createConsent()
    const a = consent.get()
    expect(consent.get()).toBe(a)
    consent.acceptAll()
    expect(consent.get()).not.toBe(a)
  })

  it('notifies subscribers and stops after unsubscribe', () => {
    const consent = createConsent()
    const seen: string[][] = []
    const off = consent.subscribe((r) => seen.push(r.granted))
    consent.acceptAll()
    consent.reset()
    off()
    consent.rejectAll()
    expect(seen).toEqual([['necessary', 'analytics', 'marketing'], ['necessary']])
  })

  it('a new consent instance reads the stored choice with its timestamp', () => {
    createConsent().grant(['marketing'])
    const later = createConsent()
    expect(later.has('marketing')).toBe(true)
    expect(new Date(later.get().decidedAt!).getTime()).toBeGreaterThan(Date.now() - 5000)
  })
})
