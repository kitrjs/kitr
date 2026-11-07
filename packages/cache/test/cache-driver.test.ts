import { afterEach, describe, expect, it, vi } from 'vitest'
import { type CacheDriver, createCache, createMemoryCacheDriver } from '../src'

afterEach(() => {
  vi.useRealTimers()
})

/** Count the entries the memory driver still holds, through its public API only. */
async function holds(driver: CacheDriver, keys: string[]) {
  let n = 0
  for (const k of keys) if ((await driver.get(k)) !== undefined) n++
  return n
}

describe('memory cache driver', () => {
  it('keeps entries without a ttl until deleted', async () => {
    vi.useFakeTimers()
    const driver = createMemoryCacheDriver()
    await driver.set('forever', 'v')
    vi.advanceTimersByTime(365 * 86_400_000)
    expect(await driver.get('forever')).toBe('v')
  })

  it('expires exactly at the ttl', async () => {
    vi.useFakeTimers()
    const driver = createMemoryCacheDriver()
    await driver.set('k', 'v', 2)
    vi.advanceTimersByTime(1999)
    expect(await driver.get('k')).toBe('v')
    vi.advanceTimersByTime(1)
    expect(await driver.get('k')).toBeUndefined()
  })

  it('a re-set key loses the tags of its old value', async () => {
    const driver = createMemoryCacheDriver()
    await driver.set('user:1', 'old')
    await driver.tag('user:1', ['team:a'])
    await driver.set('user:1', 'new')
    await driver.invalidateTags(['team:a'])
    expect(await driver.get('user:1')).toBe('new')
  })

  it('a deleted and recreated key is not invalidated by stale tags', async () => {
    const driver = createMemoryCacheDriver()
    await driver.set('k', 'a')
    await driver.tag('k', ['t'])
    await driver.delete('k')
    await driver.set('k', 'b')
    await driver.invalidateTags(['t'])
    expect(await driver.get('k')).toBe('b')
  })

  it('invalidates every key under any of several tags, and only those', async () => {
    const driver = createMemoryCacheDriver()
    for (const [key, list] of [
      ['a', ['x']],
      ['b', ['y']],
      ['c', ['x', 'y']],
      ['d', ['z']],
    ] as const) {
      await driver.set(key, key)
      await driver.tag(key, [...list])
    }
    await driver.invalidateTags(['x', 'y'])
    expect(await holds(driver, ['a', 'b', 'c'])).toBe(0)
    expect(await driver.get('d')).toBe('d')
    await driver.invalidateTags(['missing'])
    expect(await driver.get('d')).toBe('d')
  })

  it('sweeps expired entries that are never read again', async () => {
    vi.useFakeTimers()
    const driver = createMemoryCacheDriver()
    const deleted: string[] = []
    // Watch the driver's own map through Map.prototype.delete during the sweep.
    const original = Map.prototype.delete
    for (let i = 0; i < 100; i++) await driver.set(`tmp:${i}`, 'x', 1)
    vi.advanceTimersByTime(61_000)
    Map.prototype.delete = function (this: Map<unknown, unknown>, key: unknown) {
      if (typeof key === 'string' && key.startsWith('tmp:')) deleted.push(key)
      return original.call(this, key)
    }
    try {
      await driver.set('trigger', 'x')
    } finally {
      Map.prototype.delete = original
    }
    expect(new Set(deleted).size).toBe(100)
  })

  it('clear() empties entries and tags', async () => {
    const driver = createMemoryCacheDriver()
    await driver.set('a', '1')
    await driver.tag('a', ['t'])
    await driver.clear()
    expect(await driver.get('a')).toBeUndefined()
    await driver.set('a', '2')
    await driver.invalidateTags(['t'])
    expect(await driver.get('a')).toBe('2')
  })
})

describe('createCache', () => {
  it('round-trips JSON values and stores undefined as null', async () => {
    const cache = createCache()
    const values = [0, '', false, null, [1, 'two'], { nested: { deep: true } }, 'unicode ✓']
    for (const [i, value] of values.entries()) {
      await cache.set(`v${i}`, value)
      expect(await cache.get(`v${i}`)).toEqual(value)
      expect(await cache.has(`v${i}`)).toBe(true)
    }
    await cache.set('u', undefined)
    expect(await cache.get('u')).toBeNull()
  })

  it('remembers falsy results instead of recomputing them', async () => {
    const cache = createCache()
    for (const value of [0, '', false, null]) {
      const fn = vi.fn(() => value)
      await cache.remember(`f:${String(value)}`, fn)
      expect(await cache.remember(`f:${String(value)}`, fn)).toBe(value)
      expect(fn).toHaveBeenCalledTimes(1)
    }
  })

  it('does not cache undefined, so the answer stays consistent', async () => {
    const cache = createCache()
    const fn = vi.fn(() => undefined)
    expect(await cache.remember('none', fn)).toBeUndefined()
    expect(await cache.remember('none', fn)).toBeUndefined()
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('does not cache failures, and the next caller retries', async () => {
    const cache = createCache()
    let n = 0
    const flaky = async () => {
      n++
      if (n === 1) throw new Error('db down')
      return 'ok'
    }
    const [a, b] = await Promise.allSettled([
      cache.remember('k', flaky),
      cache.remember('k', flaky),
    ])
    expect(a.status).toBe('rejected')
    expect(b.status).toBe('rejected')
    expect(n).toBe(1)
    expect(await cache.remember('k', flaky)).toBe('ok')
    expect(await cache.get('k')).toBe('ok')
  })

  it('applies the default ttl, and per-call ttls', async () => {
    vi.useFakeTimers()
    const cache = createCache({ defaultTtl: 10 })
    await cache.set('short', 1, { ttl: 1 })
    await cache.set('default', 1)
    vi.advanceTimersByTime(1500)
    expect(await cache.has('short')).toBe(false)
    expect(await cache.has('default')).toBe(true)
    vi.advanceTimersByTime(9000)
    expect(await cache.has('default')).toBe(false)
  })

  it('keeps prefixed caches on one driver apart, tags included', async () => {
    const driver = createMemoryCacheDriver()
    const a = createCache({ driver, prefix: 'a:' })
    const b = createCache({ driver, prefix: 'b:' })
    await a.set('k', 'from a', { tags: ['t'] })
    await b.set('k', 'from b')
    expect(await a.get('k')).toBe('from a')
    expect(await b.get('k')).toBe('from b')
    await a.delete('k')
    expect(await b.get('k')).toBe('from b')
  })

  it('passes a custom driver ttl in seconds and tags with prefixed keys', async () => {
    const calls: unknown[] = []
    const driver: CacheDriver = {
      name: 'spy',
      get: async () => undefined,
      set: async (...args) => void calls.push(['set', ...args]),
      delete: async () => {},
      tag: async (...args) => void calls.push(['tag', ...args]),
      invalidateTags: async (tags) => void calls.push(['invalidate', tags]),
      clear: async () => void calls.push(['clear']),
    }
    const cache = createCache({ driver, prefix: 'p:' })
    await cache.remember('k', () => 1, { ttl: 60, tags: ['t1', 't2'] })
    await cache.invalidateTags('t1', 't2')
    await cache.clear()
    expect(calls).toEqual([
      ['set', 'p:k', '1', 60],
      ['tag', 'p:k', ['t1', 't2']],
      ['invalidate', ['t1', 't2']],
      ['clear'],
    ])
  })

  it('does not share in-flight work between different keys', async () => {
    const cache = createCache()
    const [a, b] = await Promise.all([
      cache.remember('a', async () => 'A'),
      cache.remember('b', async () => 'B'),
    ])
    expect([a, b]).toEqual(['A', 'B'])
  })
})
