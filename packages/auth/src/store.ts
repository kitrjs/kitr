/** One signed-in browser: what a `SessionStore` keeps under the session id. */
export interface SessionRecord {
  /** The random id the signed cookie carries. */
  id: string
  /** The user it belongs to. */
  userId: string
  /** When it was created (epoch ms). The absolute lifetime counts from here. */
  createdAt: number
  /** When it stops being valid (epoch ms): the sliding expiry, capped by the absolute one. */
  expiresAt: number
  /** Free-form data to keep with the session (a device label, a tenant id). */
  data?: Record<string, unknown>
}

/**
 * Where cookie sessions live. Memory for one process and tests, `createStorageSessionStore` over
 * a `@kitr/storage`-style driver, `createRedisSessionStore` for several instances. A store keeps
 * records; the adapter decides expiry and asks the store to drop what is past it.
 */
export interface SessionStore {
  /** The record for `id`, or `null` when it is missing or past `expiresAt`. */
  get(id: string): Promise<SessionRecord | null>
  /** Create or replace a record. `ttlMs` is how long the store must keep it (until `expiresAt`). */
  set(record: SessionRecord, ttlMs: number): Promise<void>
  /** Drop one session. Dropping a missing one is not an error. */
  delete(id: string): Promise<void>
  /** Drop every session of a user ("sign out everywhere") and resolve how many were dropped. */
  deleteForUser(userId: string): Promise<number>
  /** The live sessions of a user, for an "active devices" list. */
  listForUser(userId: string): Promise<SessionRecord[]>
}

/** Sessions in this process, swept lazily. Lost on restart and not shared between instances. */
export function createMemorySessionStore(): SessionStore {
  const records = new Map<string, SessionRecord>()
  const live = (record: SessionRecord | undefined) => {
    if (!record) return null
    if (record.expiresAt <= Date.now()) {
      records.delete(record.id)
      return null
    }
    return record
  }
  return {
    async get(id) {
      return live(records.get(id))
    },
    async set(record) {
      records.set(record.id, structuredClone(record))
      // Bound the map: drop what has expired once it grows.
      if (records.size > 10_000) for (const r of [...records.values()]) live(r)
    },
    async delete(id) {
      records.delete(id)
    },
    async deleteForUser(userId) {
      let count = 0
      for (const r of [...records.values()]) {
        if (r.userId === userId) {
          records.delete(r.id)
          if (r.expiresAt > Date.now()) count++
        }
      }
      return count
    },
    async listForUser(userId) {
      return [...records.values()].filter((r) => r.userId === userId && live(r))
    },
  }
}

/**
 * The part of a `@kitr/storage` driver (`StorageDriver`) the storage-backed store uses. Any
 * object with these four members works, including `createMemoryStorageDriver()`; the driver
 * must answer `get` synchronously, as storage drivers do.
 */
export interface SessionStorageDriver {
  /** The raw string under `key`, or `null`. */
  get(key: string): string | null
  /** Store a raw string. */
  set(key: string, raw: string): void
  /** Delete one key. */
  remove(key: string): void
  /** Every key; used to find a user's sessions. */
  keys(): string[]
}

/**
 * Sessions in a `@kitr/storage` driver, JSON under `<prefix><id>` (default prefix `kitr:session:`).
 * Drivers have no expiry of their own, so an expired record is dropped when it is read.
 */
export function createStorageSessionStore(
  driver: SessionStorageDriver,
  options: { prefix?: string } = {},
): SessionStore {
  const prefix = options.prefix ?? 'kitr:session:'
  const read = (key: string): SessionRecord | null => {
    const raw = driver.get(key)
    if (!raw) return null
    try {
      const record = JSON.parse(raw) as SessionRecord
      if (record.expiresAt > Date.now()) return record
    } catch {
      // Corrupt entries are treated like expired ones.
    }
    driver.remove(key)
    return null
  }
  const mine = () =>
    driver
      .keys()
      .filter((k) => k.startsWith(prefix))
      .flatMap((k) => {
        const record = read(k)
        return record ? [record] : []
      })
  return {
    async get(id) {
      return read(prefix + id)
    },
    async set(record) {
      driver.set(prefix + record.id, JSON.stringify(record))
    },
    async delete(id) {
      driver.remove(prefix + id)
    },
    async deleteForUser(userId) {
      const own = mine().filter((r) => r.userId === userId)
      for (const r of own) driver.remove(prefix + r.id)
      return own.length
    },
    async listForUser(userId) {
      return mine().filter((r) => r.userId === userId)
    },
  }
}

/**
 * The part of an [ioredis](https://github.com/redis/ioredis) client the Redis session store
 * uses. An ioredis `Redis` fits as it is.
 */
export interface RedisSessionClient {
  get(key: string): Promise<string | null>
  set(key: string, value: string, px: 'PX', ms: number): Promise<unknown>
  del(...keys: string[]): Promise<number>
  mget(...keys: string[]): Promise<Array<string | null>>
  sadd(key: string, ...members: string[]): Promise<number>
  srem(key: string, ...members: string[]): Promise<number>
  smembers(key: string): Promise<string[]>
  pexpire(key: string, ms: number): Promise<number>
  pttl(key: string): Promise<number>
}

/**
 * Sessions in Redis, so every instance sees a sign-in or a revocation at once. Each session is
 * one key Redis expires itself, plus a set of a user's session ids to revoke them together.
 * Keys live under `prefix` (default `kitr:session:`):
 *
 *   store: createRedisSessionStore(new Redis(process.env.REDIS_URL))
 */
export function createRedisSessionStore(
  redis: RedisSessionClient,
  options: { prefix?: string } = {},
): SessionStore {
  const prefix = options.prefix ?? 'kitr:session:'
  const key = (id: string) => `${prefix}s:${id}`
  const userKey = (userId: string) => `${prefix}u:${userId}`
  const parse = (raw: string | null): SessionRecord | null => {
    if (!raw) return null
    try {
      return JSON.parse(raw) as SessionRecord
    } catch {
      return null
    }
  }
  return {
    async get(id) {
      const record = parse(await redis.get(key(id)))
      return record && record.expiresAt > Date.now() ? record : null
    },
    async set(record, ttlMs) {
      const ms = Math.max(1, Math.ceil(ttlMs))
      await redis.set(key(record.id), JSON.stringify(record), 'PX', ms)
      await redis.sadd(userKey(record.userId), record.id)
      // The index lives as long as the user's longest session; a short one never cuts it down.
      if ((await redis.pttl(userKey(record.userId))) < ms)
        await redis.pexpire(userKey(record.userId), ms)
    },
    async delete(id) {
      const record = parse(await redis.get(key(id)))
      await redis.del(key(id))
      if (record) await redis.srem(userKey(record.userId), id)
    },
    async deleteForUser(userId) {
      const ids = await redis.smembers(userKey(userId))
      let count = 0
      if (ids.length) count = await redis.del(...ids.map(key))
      await redis.del(userKey(userId))
      return count
    },
    async listForUser(userId) {
      const ids = await redis.smembers(userKey(userId))
      if (!ids.length) return []
      const records = (await redis.mget(...ids.map(key))).map(parse)
      // Prune ids whose session expired, so the index does not grow with stale entries.
      const gone = ids.filter((_, i) => !records[i])
      if (gone.length) await redis.srem(userKey(userId), ...gone)
      return records.filter((r): r is SessionRecord => !!r && r.expiresAt > Date.now())
    },
  }
}
