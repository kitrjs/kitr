import { createApp, getDevtools } from '@kitr/core'
import { describe, expect, it } from 'vitest'
import { createDevtoolsHub } from '../src'
import { devtoolsProvider } from '../src/provider'

/** Waits past the hub's frame-coalesced notification. */
const flush = () => new Promise<void>((r) => setTimeout(r, 40))

describe('devtools hub', () => {
  it('keeps a ring buffer per channel, registers panels and notifies once per frame', async () => {
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
    await flush()
    expect(notified).toBe(1)
    hub.clear('http')
    expect(hub.entries()).toHaveLength(1)
  })

  it('merges channels by id and caches the merged view until the next write', () => {
    const hub = createDevtoolsHub()
    hub.log('a', '1')
    hub.log('b', '2')
    hub.log('a', '3')
    expect(hub.entries().map((e) => e.label)).toEqual(['1', '2', '3'])
    expect(hub.entries()).toBe(hub.entries())
    const before = hub.entries()
    hub.log('b', '4')
    expect(hub.entries()).not.toBe(before)
    expect(hub.entries().map((e) => e.id)).toEqual([1, 2, 3, 4])
    expect(hub.entries('missing')).toEqual([])
  })

  it('collapses bursts of identical entries into a count', async () => {
    const hub = createDevtoolsHub()
    hub.log('http', 'GET /a', { s: 1 })
    hub.log('http', 'GET /a', { s: 1 })
    hub.log('http', 'GET /a', { s: 2 })
    hub.log('http', 'GET /a', { s: 2 }, 'warn')
    expect(hub.entries('http').map((e) => e.count ?? 1)).toEqual([2, 1, 1])
    expect(hub.entries()[0]!.id).toBe(1)
    await new Promise((r) => setTimeout(r, 70))
    hub.log('http', 'GET /a', { s: 1 })
    expect(hub.entries('http')).toHaveLength(4)
    hub.log('http', 'x')
    hub.log('http', 'x')
    expect(hub.entries('http').at(-1)?.count).toBe(2)
  })

  it('records marks as info entries on the devtools channel and never collapses them', () => {
    const hub = createDevtoolsHub()
    hub.mark('navigated /orders')
    hub.mark('navigated /orders')
    const marks = hub.entries('devtools')
    expect(marks).toHaveLength(2)
    expect(marks[0]).toMatchObject({ kind: 'mark', level: 'info', label: 'navigated /orders' })
    expect(hub.channels()).toEqual(['devtools'])
  })

  it('lists channels in first-seen order and keeps counts through logs, drops and clear', () => {
    const hub = createDevtoolsHub({ maxEntries: 2 })
    hub.log('b', '1', undefined, 'error')
    hub.log('a', '2', undefined, 'warn')
    hub.log('b', '3', undefined, 'info')
    expect(hub.channels()).toEqual(['b', 'a'])
    expect(hub.counts()).toEqual({ debug: 0, info: 1, warn: 1, error: 1 })
    hub.log('b', '4', undefined, 'info')
    expect(hub.counts()).toEqual({ debug: 0, info: 2, warn: 1, error: 0 })
    hub.clear('b')
    expect(hub.counts()).toEqual({ debug: 0, info: 0, warn: 1, error: 0 })
    hub.clear()
    expect(hub.counts()).toEqual({ debug: 0, info: 0, warn: 0, error: 0 })
    expect(hub.entries()).toEqual([])
  })

  it('bumps version on every change and calls listeners without arguments', async () => {
    const hub = createDevtoolsHub()
    const v0 = hub.version
    const args: unknown[][] = []
    hub.subscribe((...a: unknown[]) => args.push(a))
    hub.log('x', 'y')
    const v1 = hub.version
    hub.notify()
    hub.clear()
    expect(v1).toBeGreaterThan(v0)
    expect(hub.version).toBe(v1 + 2)
    await flush()
    expect(args).toEqual([[]])
  })

  it('orders panels by group then registration order and replaces by id', () => {
    const hub = createDevtoolsHub()
    const p = (id: string, group?: 'app' | 'data' | 'platform' | 'custom', label = id) => ({
      id,
      label,
      group,
      render: () => null,
    })
    hub.register(p('c1'))
    hub.register(p('plat', 'platform'))
    hub.register(p('data', 'data'))
    hub.register(p('app', 'app'))
    hub.register(p('c2', 'custom'))
    expect(hub.panels.map((x) => x.id)).toEqual(['app', 'data', 'plat', 'c1', 'c2'])
    hub.register(p('c1', 'custom', 'New'))
    expect(hub.panels.map((x) => x.id)).toEqual(['app', 'data', 'plat', 'c1', 'c2'])
    expect(hub.panels.find((x) => x.id === 'c1')?.label).toBe('New')
  })
})

describe('devtools provider', () => {
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
