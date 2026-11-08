import { googleAnalytics } from '@kitr/analytics'
import analyticsProvider from '@kitr/analytics/provider'
import { createApp } from '@kitr/core'
import { afterEach, describe, expect, it } from 'vitest'
import consentProvider from '../src/provider'

afterEach(() => {
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0]!.trim()
    if (name) document.cookie = `${name}=; max-age=0; path=/`
  }
  document.head.innerHTML = ''
  const w = globalThis as any
  delete w.dataLayer
  delete w.gtag
})

const gtagLoaded = () => document.querySelectorAll('script[src*="googletagmanager"]').length > 0

async function boot(
  order: 'analytics-first' | 'consent-first',
  consent: Record<string, unknown> = {},
) {
  const providers =
    order === 'analytics-first'
      ? [analyticsProvider, consentProvider]
      : [consentProvider, analyticsProvider]
  const app = createApp({
    environment: 'client',
    mode: 'production',
    providers,
    config: {
      analytics: { adapters: [googleAnalytics({ measurementId: 'G-TEST' })] },
      consent,
    },
  } as never)
  await app.boot()
  // Resolving analytics is what would inject the script.
  app.container.use('analytics')
  return app
}

describe('analytics waits for consent whatever the provider order', () => {
  it.each(['analytics-first', 'consent-first'] as const)(
    '%s: no tracker until the visitor agrees',
    async (order) => {
      const app = await boot(order)
      await new Promise((r) => setTimeout(r, 10))
      expect(gtagLoaded()).toBe(false)
      app.container.use('consent').acceptAll()
      await new Promise((r) => setTimeout(r, 10))
      expect(gtagLoaded()).toBe(true)
    },
  )

  it('a returning visitor who agreed gets tracking at boot', async () => {
    const first = await boot('analytics-first')
    first.container.use('consent').acceptAll()
    document.head.innerHTML = ''
    const w = globalThis as any
    delete w.dataLayer
    delete w.gtag
    await boot('analytics-first')
    await new Promise((r) => setTimeout(r, 10))
    expect(gtagLoaded()).toBe(true)
  })

  it('consent with analytics: false leaves analytics on', async () => {
    await boot('analytics-first', { analytics: false })
    await new Promise((r) => setTimeout(r, 10))
    expect(gtagLoaded()).toBe(true)
  })
})
