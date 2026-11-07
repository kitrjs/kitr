import { createApp, getDevtools } from '@kitr/core'
import { describe, expect, it } from 'vitest'
import { createDevtoolsHub } from '../src'
import { devtoolsProvider } from '../src/provider'

describe('devtools hub', () => {
  it('logs per channel with a cap, registers panels and notifies once per tick', async () => {
    const hub = createDevtoolsHub({ maxEntries: 2 })
    let notified = 0
    hub.subscribe(() => notified++)
    hub.log('http', 'a')
    hub.log('http', 'b')
    hub.log('http', 'c')
    hub.log('auth', 'x', { id: 1 }, 'debug')
    expect(hub.entries('http').map((e) => e.label)).toEqual(['b', 'c'])
    expect(hub.entries()).toHaveLength(3)
    const off = hub.register({ id: 'p', label: 'P', render: () => null })
    expect(hub.panels.map((p) => p.id)).toEqual(['p'])
    off()
    expect(hub.panels).toEqual([])
    await Promise.resolve()
    expect(notified).toBe(1)
    hub.clear('http')
    expect(hub.entries()).toHaveLength(1)
  })

  it('provider binds the hub in development on the client and collects panels', async () => {
    const app = createApp({
      environment: 'client',
      mode: 'development',
      providers: [
        devtoolsProvider,
        { name: 'custom', devtools: () => [{ id: 'custom', label: 'Custom', render: () => null }] },
      ],
    })
    await app.boot()
    const hub = getDevtools(app)
    expect(hub).not.toBeNull()
    expect(hub?.panels.map((p) => p.id)).toEqual(['app', 'router', 'log', 'custom'])
    expect(app.wrap('children' as never)).not.toBe('children')
  })

  it('provider is a no-op in production', async () => {
    const app = createApp({
      environment: 'client',
      mode: 'production',
      providers: [devtoolsProvider],
    })
    await app.boot()
    expect(getDevtools(app)).toBeNull()
    expect(app.wrap('children' as never)).toBe('children')
  })
})
