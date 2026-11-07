import { describe, expect, it, vi } from 'vitest'
import { Container } from '../src/container'

describe('Container', () => {
  it('binds values and reports keys', () => {
    const c = new Container().value('a', 1).singleton('b', () => 2)
    expect(c.has('a')).toBe(true)
    expect(c.has('b')).toBe(true)
    expect(c.has('nope')).toBe(false)
    expect(c.keys().sort()).toEqual(['a', 'b'])
  })

  it('throws a helpful error for unknown bindings, sync and async', async () => {
    const c = new Container()
    expect(() => c.use('missing')).toThrow(/No binding named "missing"/)
    await expect(c.make('missing')).rejects.toThrow(/No binding named "missing"/)
  })

  it('shares one in-flight promise between concurrent make() calls', async () => {
    const factory = vi.fn(async () => ({ created: Date.now() }))
    const c = new Container().singleton('svc', factory)
    const [a, b, d] = await Promise.all([c.make('svc'), c.make('svc'), c.make('svc')])
    expect(factory).toHaveBeenCalledTimes(1)
    expect(a).toBe(b)
    expect(b).toBe(d)
  })

  it('passes itself to factories so bindings can depend on each other', async () => {
    const c = new Container()
      .value('base', 'http://x')
      .singleton('client', (container) => ({ url: container.use('base') }))
    expect(await c.make('client')).toEqual({ url: 'http://x' })
  })

  it('retries a factory that failed instead of caching the rejection', async () => {
    let attempts = 0
    const c = new Container().singleton('flaky', async () => {
      attempts++
      if (attempts === 1) throw new Error('transient')
      return 'ok'
    })
    await expect(c.make('flaky')).rejects.toThrow('transient')
    await expect(c.make('flaky')).resolves.toBe('ok')
    expect(attempts).toBe(2)
  })

  it('re-binding replaces the factory and drops the cached instance', async () => {
    const c = new Container().singleton('x', () => 1)
    expect(c.use('x')).toBe(1)
    c.singleton('x', () => 2)
    expect(c.use('x')).toBe(2)
    c.value('x', 3)
    expect(await c.make('x')).toBe(3)
  })

  it('reset() keeps factories but rebuilds instances', () => {
    let n = 0
    const c = new Container().singleton('n', () => ++n)
    expect(c.use('n')).toBe(1)
    c.reset()
    expect(c.use('n')).toBe(2)
  })

  it('resolveAll() makes async bindings usable synchronously', async () => {
    const c = new Container().singleton('a', async () => 'A').singleton('b', () => 'B')
    expect(() => c.use('a')).toThrow(/async factory/)
    await c.resolveAll()
    expect(c.use('a')).toBe('A')
    expect(c.use('b')).toBe('B')
  })

  it('children see parent bindings and keys but keep their own instances', async () => {
    const parent = new Container().singleton('shared', () => ({}))
    const child = parent.child().value('own', true)
    expect(child.keys().sort()).toEqual(['own', 'shared'])
    expect(parent.has('own')).toBe(false)
    expect(await child.make('shared')).toBe(parent.use('shared'))
  })
})
