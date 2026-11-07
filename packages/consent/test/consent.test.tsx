import { createAnalytics } from '@kitr/analytics'
import { createApp } from '@kitr/core'
import { createMonitoring } from '@kitr/monitoring'
import { KitrProvider } from '@kitr/react'
import { act, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createConsent } from '../src'
import consentProvider from '../src/provider'
import { useConsent } from '../src/react'

describe('consent', () => {
  it('starts undecided, records a choice in a cookie and resets', () => {
    const consent = createConsent({ categories: ['analytics', 'marketing'] })
    expect(consent.decided()).toBe(false)
    expect(consent.has('necessary')).toBe(true)
    expect(consent.has('analytics')).toBe(false)
    consent.grant(['analytics', 'bogus'])
    expect(consent.decided()).toBe(true)
    expect(consent.get().granted).toEqual(['necessary', 'analytics'])
    expect(document.cookie).toContain('consent=')
    consent.acceptAll()
    expect(consent.has('marketing')).toBe(true)
    consent.rejectAll()
    expect(consent.get().granted).toEqual(['necessary'])
    consent.reset()
    expect(consent.decided()).toBe(false)
  })

  it('asks again when the version changes', () => {
    createConsent({ version: 1 }).acceptAll()
    expect(createConsent({ version: 1 }).decided()).toBe(true)
    expect(createConsent({ version: 2 }).decided()).toBe(false)
  })

  it('gates analytics and monitoring from the container', async () => {
    const track = vi.fn()
    const capture = vi.fn()
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
                reporters: [{ name: 'spy', captureException: capture }],
                shouldReport: () => true,
                globalHandlers: false,
              }),
            )
          },
        },
        consentProvider,
      ],
      config: { consent: { monitoring: 'analytics' } },
    })
    await app.boot()
    const analytics = app.container.use('analytics')
    const monitoring = app.container.use('monitoring')
    analytics.track('viewed' as never, {} as never)
    monitoring.captureException(new Error('early'))
    expect(track).not.toHaveBeenCalled()
    expect(capture).not.toHaveBeenCalled()

    app.container.use('consent').acceptAll()
    await vi.waitFor(() => expect(track).toHaveBeenCalledTimes(1))
    monitoring.captureException(new Error('later'))
    expect(capture).toHaveBeenCalledTimes(1)

    app.container.use('consent').rejectAll()
    expect(analytics.enabled).toBe(false)
    monitoring.captureException(new Error('after'))
    expect(capture).toHaveBeenCalledTimes(1)
  })

  it('useConsent() follows the record', async () => {
    const app = createApp({ environment: 'client', providers: [consentProvider] })
    await app.boot()
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(KitrProvider, { app }, children)
    const { result } = renderHook(() => useConsent(), { wrapper })
    expect(result.current.decided).toBe(false)
    act(() => result.current.grant(['analytics']))
    expect(result.current.decided).toBe(true)
    expect(result.current.has('analytics')).toBe(true)
    expect(result.current.has('marketing')).toBe(false)
  })
})
