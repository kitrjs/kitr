import { afterAll, describe, expect, it } from 'vitest'
import { createTestRedis, uniquePrefix } from '../../../tests/setup/redis'
import { createCache, createRedisCacheDriver } from '../src'

describe('Redis cache driver', () => {
  const redis = createTestRedis()
  const other = createTestRedis()
  afterAll(async () => {
    await redis.quit()
    await other.quit()
  })

  it('shares entries and tag invalidation between two instances', async () => {
    const base = uniquePrefix('cache')
    const a = createCache({ driver: createRedisCacheDriver(redis, { base }) })
    const b = createCache({ driver: createRedisCacheDriver(other, { base }) })
    await a.set('invoice:1', { total: 120 }, { tags: ['team:acme'] })
    await a.set('invoice:2', { total: 80 }, { tags: ['team:other'] })
    expect(await b.get('invoice:1')).toEqual({ total: 120 })
    await b.invalidateTags('team:acme')
    expect(await a.get('invoice:1')).toBeUndefined()
    expect(await a.get('invoice:2')).toEqual({ total: 80 })
  })

  it('a re-set key loses the tags of its old value', async () => {
    const driver = createRedisCacheDriver(redis, { base: uniquePrefix('cache') })
    await driver.set('user:1', 'old')
    await driver.tag('user:1', ['team:a'])
    await driver.set('user:1', 'new')
    await driver.invalidateTags(['team:a'])
    expect(await driver.get('user:1')).toBe('new')
  })

  it('expires entries with the ttl', async () => {
    const driver = createRedisCacheDriver(redis, { base: uniquePrefix('cache') })
    await driver.set('report', 'v', 1)
    expect(await driver.get('report')).toBe('v')
    await new Promise((r) => setTimeout(r, 1100))
    expect(await driver.get('report')).toBeUndefined()
  })

  it('clear() removes only keys under its base', async () => {
    const base = uniquePrefix('cache')
    const driver = createRedisCacheDriver(redis, { base })
    await driver.set('k1', 'v')
    await driver.tag('k1', ['t'])
    await redis.set(`${base.slice(0, -1)}-unrelated`, 'keep')
    await redis.set('acme:sessions:ada', 'keep')
    await driver.clear()
    expect(await driver.get('k1')).toBeUndefined()
    expect(await redis.get('acme:sessions:ada')).toBe('keep')
    expect(await redis.get(`${base.slice(0, -1)}-unrelated`)).toBe('keep')
    await redis.del('acme:sessions:ada', `${base.slice(0, -1)}-unrelated`)
  })
})
