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

  it('builds a sync binding once when resolveAll() runs dependants in parallel', async () => {
    const factory = vi.fn(() => ({ id: Math.random() }))
    const c = new Container()
      .singleton('client', factory)
      .singleton('offline', (container) => ({ client: container.use('client') }))
    await c.resolveAll()
    expect(factory).toHaveBeenCalledTimes(1)
    expect(c.use('offline').client).toBe(c.use('client'))
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

describe('scoped bindings', () => {
  it('builds one instance per container, sharing within it', async () => {
    const { Container } = await import('../src')
    const root = new Container()
    let n = 0
    root.scoped('cache', () => ({ id: ++n }))
    root.singleton('shared', () => ({ s: true }))
    const a = root.child()
    const b = root.child()
    expect(a.use('cache')).toBe(a.use('cache'))
    expect(a.use('cache')).not.toBe(b.use('cache'))
    expect(root.use('cache')).not.toBe(a.use('cache'))
    expect(await b.make('cache')).toBe(b.use('cache'))
    expect(a.use('shared')).toBe(b.use('shared'))
    const grandchild = a.child()
    expect(grandchild.use('cache')).not.toBe(a.use('cache'))
  })

  it('a child built before the root resolved still gets its own instance', async () => {
    const { Container } = await import('../src')
    const root = new Container()
    root.scoped('cache', async () => ({}))
    await root.resolveAll()
    const child = root.child()
    expect(await child.make('cache')).not.toBe(root.use('cache'))
  })
})

describe('make(Class)', () => {
  it('builds a new instance per call from the bindings named by static inject', async () => {
    const { Container } = await import('../src')
    const root = new Container()
    let n = 0
    root.scoped('counter', () => ({ id: ++n }))
    root.singleton('name', async () => 'projects')
    class Controller {
      static inject = ['name', 'counter'] as const
      constructor(
        readonly name: string,
        readonly counter: { id: number },
      ) {}
    }
    const a = root.child()
    const b = root.child()
    const first = await a.make(Controller)
    expect(first).toBeInstanceOf(Controller)
    expect(first.name).toBe('projects')
    // A new instance each time, but the services come from the container that built it.
    expect(await a.make(Controller)).not.toBe(first)
    expect((await a.make(Controller)).counter).toBe(first.counter)
    expect((await b.make(Controller)).counter).not.toBe(first.counter)
  })

  it('builds a class without inject with no arguments, and reports a missing binding', async () => {
    const { Container } = await import('../src')
    class Plain {
      args: unknown[]
      constructor(...args: unknown[]) {
        this.args = args
      }
    }
    expect((await new Container().make(Plain)).args).toEqual([])
    class Needy {
      static inject = ['db'] as const
      readonly ready = true
    }
    await expect(new Container().make(Needy)).rejects.toThrow(/No binding named "db"/)
  })
})
