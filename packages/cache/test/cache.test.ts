import { createApp } from '@kitr/core'
import { describe, expect, it, vi } from 'vitest'
import { cached, createCache } from '../src'
import cacheProvider from '../src/provider'

describe('cache', () => {
  it('remembers, expires and invalidates by tag', async () => {
    vi.useFakeTimers()
    const cache = createCache({ prefix: 'app:' })
    const fn = vi.fn(async () => ({ n: 1 }))
    expect(await cache.remember('a', fn, { ttl: 10, tags: ['users'] })).toEqual({ n: 1 })
    expect(await cache.remember('a', fn)).toEqual({ n: 1 })
    expect(fn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(11_000)
    expect(await cache.get('a')).toBeUndefined()
    await cache.set('b', 'x', { tags: ['users'] })
    await cache.set('c', 'y', { tags: ['other'] })
    await cache.invalidateTags('users')
    expect(await cache.has('b')).toBe(false)
    expect(await cache.get('c')).toBe('y')
    vi.useRealTimers()
  })

  it('shares one in-flight computation between concurrent callers', async () => {
    const cache = createCache()
    let runs = 0
    const slow = () =>
      new Promise<number>((r) =>
        setTimeout(() => {
          runs++
          r(42)
        }, 5),
      )
    const [a, b] = await Promise.all([cache.remember('k', slow), cache.remember('k', slow)])
    expect([a, b]).toEqual([42, 42])
    expect(runs).toBe(1)
  })

  it('cached() keys on the arguments', async () => {
    const cache = createCache()
    const load = vi.fn(async (id: string) => `user ${id}`)
    const user = cached(cache, load, { key: (id) => `user:${id}` })
    expect(await user('1')).toBe('user 1')
    expect(await user('1')).toBe('user 1')
    expect(await user('2')).toBe('user 2')
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('binds cache from config', async () => {
    const app = createApp({ providers: [cacheProvider], config: { cache: { prefix: 'x:' } } })
    await app.boot()
    const cache = app.container.use('cache')
    await cache.set('k', 1)
    expect(await cache.driver.get('x:k')).toBe('1')
  })
})
