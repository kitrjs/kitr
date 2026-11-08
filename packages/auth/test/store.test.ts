import { afterAll, describe, expect, it, vi } from 'vitest'
import { createTestRedis, uniquePrefix } from '../../../tests/setup/redis'
import {
  createMemorySessionStore,
  createRedisSessionStore,
  createStorageSessionStore,
  type SessionRecord,
  type SessionStore,
} from '../src/server'

const record = (id: string, userId: string, ttlMs = 60_000): SessionRecord => ({
  id,
  userId,
  createdAt: Date.now(),
  expiresAt: Date.now() + ttlMs,
  data: { device: id },
})

/** The contract every store meets, whatever it keeps sessions in. */
function storeContract(name: string, make: () => SessionStore) {
  describe(`${name} session store`, () => {
    it('keeps, reads and deletes a session', async () => {
      const store = make()
      await store.set(record('a', 'u1'), 60_000)
      expect((await store.get('a'))?.data).toEqual({ device: 'a' })
      await store.delete('a')
      expect(await store.get('a')).toBeNull()
      await store.delete('a')
    })

    it('does not return a session past its expiry', async () => {
      const store = make()
      await store.set(record('old', 'u1', -1000), 1)
      expect(await store.get('old')).toBeNull()
    })

    it('lists and revokes every session of one user only', async () => {
      const store = make()
      await store.set(record('a', 'u1'), 60_000)
      await store.set(record('b', 'u1'), 60_000)
      await store.set(record('c', 'u2'), 60_000)
      expect((await store.listForUser('u1')).map((r) => r.id).sort()).toEqual(['a', 'b'])
      expect(await store.deleteForUser('u1')).toBe(2)
      expect(await store.get('a')).toBeNull()
      expect(await store.get('b')).toBeNull()
      expect((await store.get('c'))?.userId).toBe('u2')
      expect(await store.listForUser('u1')).toEqual([])
    })

    it('replaces a record set twice', async () => {
      const store = make()
      await store.set(record('a', 'u1'), 60_000)
      await store.set({ ...record('a', 'u1'), data: { device: 'changed' } }, 60_000)
      expect((await store.get('a'))?.data).toEqual({ device: 'changed' })
    })
  })
}

storeContract('memory', () => createMemorySessionStore())

const driver = () => {
  const map = new Map<string, string>()
  return {
    get: (k: string) => map.get(k) ?? null,
    set: (k: string, v: string) => void map.set(k, v),
    remove: (k: string) => void map.delete(k),
    keys: () => [...map.keys()],
    map,
  }
}
storeContract('storage driver', () => createStorageSessionStore(driver()))

describe('memory store details', () => {
  it('drops expired records while counting only live ones in deleteForUser', async () => {
    const store = createMemorySessionStore()
    await store.set(record('live', 'u1'), 60_000)
    await store.set(record('dead', 'u1', -1), 1)
    expect(await store.deleteForUser('u1')).toBe(1)
  })

  it('stores a copy, so later changes to the object do not leak in', async () => {
    const store = createMemorySessionStore()
    const r = record('a', 'u1')
    await store.set(r, 60_000)
    r.userId = 'attacker'
    expect((await store.get('a'))?.userId).toBe('u1')
  })

  it('sweeps expired records once it grows large', async () => {
    vi.useFakeTimers()
    try {
      const store = createMemorySessionStore()
      for (let i = 0; i < 10_001; i++) await store.set(record(`s${i}`, 'u', 1000), 1000)
      vi.advanceTimersByTime(2000)
      await store.set(record('fresh', 'u', 60_000), 60_000)
      expect(await store.listForUser('u')).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('storage driver store details', () => {
  it('uses the prefix, ignores other keys and drops corrupt or expired entries', async () => {
    const d = driver()
    const store = createStorageSessionStore(d, { prefix: 'mine:' })
    d.set('other:1', 'x')
    d.set('mine:bad', '{not json')
    await store.set(record('a', 'u1'), 60_000)
    expect(d.keys()).toContain('mine:a')
    expect(await store.get('bad')).toBeNull()
    expect(d.keys()).not.toContain('mine:bad')
    expect(await store.listForUser('u1')).toHaveLength(1)
    expect(d.get('other:1')).toBe('x')
  })
})

describe('Redis session store', () => {
  const redis = createTestRedis()
  const other = createTestRedis()
  afterAll(async () => {
    await redis.quit()
    await other.quit()
  })

  storeContract('redis', () => createRedisSessionStore(redis, { prefix: uniquePrefix('sessions') }))

  it('shares sessions and revocations between two instances', async () => {
    const prefix = uniquePrefix('sessions')
    const a = createRedisSessionStore(redis, { prefix })
    const b = createRedisSessionStore(other, { prefix })
    await a.set(record('s1', 'ada'), 60_000)
    expect((await b.get('s1'))?.userId).toBe('ada')
    await b.deleteForUser('ada')
    expect(await a.get('s1')).toBeNull()
  })

  it('lets Redis expire a session by itself', async () => {
    const store = createRedisSessionStore(redis, { prefix: uniquePrefix('sessions') })
    await store.set({ ...record('short', 'u1'), expiresAt: Date.now() + 50 }, 50)
    expect(await store.get('short')).not.toBeNull()
    await new Promise((r) => setTimeout(r, 120))
    expect(await store.get('short')).toBeNull()
  })

  it('prunes ids of expired sessions from the user index and survives corrupt values', async () => {
    const prefix = uniquePrefix('sessions')
    const store = createRedisSessionStore(redis, { prefix })
    await store.set(record('live', 'u1'), 60_000)
    await store.set({ ...record('gone', 'u1'), expiresAt: Date.now() + 30 }, 30)
    await new Promise((r) => setTimeout(r, 80))
    expect((await store.listForUser('u1')).map((r) => r.id)).toEqual(['live'])
    await redis.set(`${prefix}s:broken`, '{nope')
    expect(await store.get('broken')).toBeNull()
    await store.delete('broken')
  })

  it('only touches keys under its prefix', async () => {
    const prefix = uniquePrefix('sessions')
    const store = createRedisSessionStore(redis, { prefix })
    await redis.set('acme:sessions:ada', 'keep')
    await store.set(record('s', 'ada'), 60_000)
    await store.deleteForUser('ada')
    expect(await redis.get('acme:sessions:ada')).toBe('keep')
    await redis.del('acme:sessions:ada')
  })
})
