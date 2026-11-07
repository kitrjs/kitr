import { createApp } from '@kitr/core'
import { KitrProvider } from '@kitr/react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installGlobalHandlers, memoryReporter, sentry } from '../src'
import monitoringProvider, { MonitoringErrorBoundary } from '../src/provider'

afterEach(() => vi.restoreAllMocks())

function Boom({ when }: { when: boolean }) {
  if (when) throw new Error('render failed')
  return <p>fine</p>
}

describe('MonitoringErrorBoundary', () => {
  it('reports render errors with the component stack and renders the fallback with reset', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const reporter = memoryReporter()
    const app = createApp({
      providers: [monitoringProvider],
      config: { monitoring: { reporters: [reporter], globalHandlers: false } },
    })
    await app.boot()
    const monitoring = app.container.use('monitoring')
    let explode = true
    const { rerender } = render(
      <MonitoringErrorBoundary
        monitoring={monitoring}
        fallback={(e, reset) => (
          <button type="button" onClick={reset}>
            {(e as Error).message}
          </button>
        )}
      >
        <Boom when={explode} />
      </MonitoringErrorBoundary>,
    )
    expect(reporter.exceptions[0]?.context?.source).toBe('error-boundary')
    expect((reporter.exceptions[0]?.context?.extra as any)?.componentStack).toContain('Boom')
    explode = false
    rerender(
      <MonitoringErrorBoundary
        monitoring={monitoring}
        fallback={(e, reset) => (
          <button type="button" onClick={reset}>
            {(e as Error).message}
          </button>
        )}
      >
        <Boom when={explode} />
      </MonitoringErrorBoundary>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'render failed' }))
    expect(screen.getByText('fine')).toBeTruthy()
  })

  it('rethrows without a fallback so the router error component can render', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const reporter = memoryReporter()
    const app = createApp({
      providers: [monitoringProvider],
      config: { monitoring: { reporters: [reporter], globalHandlers: false } },
    })
    await app.boot()
    expect(() =>
      render(
        <KitrProvider app={app}>
          <Boom when />
        </KitrProvider>,
      ),
    ).toThrow('render failed')
    expect(reporter.exceptions).toHaveLength(1)
  })
})

describe('global handlers', () => {
  it('captures window errors and unhandled rejections until disposed', async () => {
    const reporter = memoryReporter()
    const app = createApp({
      providers: [monitoringProvider],
      config: { monitoring: { reporters: [reporter], globalHandlers: false } },
    })
    await app.boot()
    const dispose = installGlobalHandlers(app.container.use('monitoring'))
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('uncaught') }))
    const rejection = new Event('unhandledrejection') as any
    rejection.reason = 'nope'
    window.dispatchEvent(rejection)
    dispose()
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('after') }))
    expect(reporter.exceptions.map((e) => (e.error as any)?.message ?? e.error)).toEqual([
      'uncaught',
      'nope',
    ])
  })
})

describe('sentry reporter', () => {
  it('maps calls to the SDK', async () => {
    const sdk = {
      init: vi.fn(),
      captureException: vi.fn(),
      captureMessage: vi.fn(),
      setUser: vi.fn(),
      addBreadcrumb: vi.fn(),
      setTag: vi.fn(),
    }
    const r = sentry(sdk, { dsn: 'https://x@sentry.io/1' })
    r.init?.()
    r.captureException(new Error('x'), { tags: { a: '1' }, level: 'error' })
    r.captureMessage?.('hello')
    r.setUser?.({ id: 'u' })
    r.addBreadcrumb?.({ message: 'm' })
    r.setTag?.('k', 'v')
    expect(sdk.init).toHaveBeenCalledWith({ dsn: 'https://x@sentry.io/1' })
    expect(sdk.captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: { a: '1' },
      extra: undefined,
      level: 'error',
    })
    expect(sdk.captureMessage).toHaveBeenCalledWith('hello', {
      tags: undefined,
      extra: undefined,
      level: 'info',
    })
    expect(await r.flush?.(10)).toBe(true)
  })
})

describe('monitoringProvider', () => {
  it('tags reports with the mode and mirrors them into devtools', async () => {
    const hub = { log: vi.fn(), notify: vi.fn() }
    const reporter = memoryReporter()
    const app = createApp({
      mode: 'production',
      providers: [monitoringProvider],
      config: { monitoring: { reporters: [reporter], globalHandlers: false } },
    })
    app.container.value('devtools', hub as any)
    await app.boot()
    await act(async () => {
      app.container.use('monitoring').captureException(new Error('x'))
    })
    expect(hub.log).toHaveBeenCalledWith('errors', 'Error: x', expect.anything(), 'error')
    expect(reporter.exceptions[0]?.context?.tags).toMatchObject({ environment: 'production' })
  })
})
