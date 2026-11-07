import { createDefineConfig, type KitrApp } from '@kitr/core'

/**
 * What a cache backend implements: six async methods over string keys and string values.
 * Values arrive already serialised to JSON by the cache, and keys already carry the prefix.
 */
export interface CacheDriver {
  /** Shown in devtools and logs, e.g. `memory` or `redis`. */
  name: string
  /** The stored string, or `undefined` when the key is missing or expired. */
  get(key: string): Promise<string | undefined>
  /** `ttl` in seconds; `undefined` keeps the entry until deleted. */
  set(key: string, value: string, ttl?: number): Promise<void>
  /** Remove one key and forget its tags. */
  delete(key: string): Promise<void>
  /** Remove every key tagged with any of `tags`. */
  invalidateTags(tags: string[]): Promise<void>
  /** Record the tags of a key so `invalidateTags` can find it. */
  tag(key: string, tags: string[]): Promise<void>
  /** Remove every key and every tag. */
  clear(): Promise<void>
}

/** The options in `config/cache.ts`, also accepted by `createCache()`. */
export interface CacheConfig {
  /** Where entries live. Default: `createMemoryCacheDriver()`. */
  driver?: CacheDriver
  /** Prepended to every key, so several apps can share one Redis. */
  prefix?: string
  /** Seconds, when `remember()` is called without a ttl. Default 300. */
  defaultTtl?: number
}

/** Per-entry options for `set()`, `remember()` and `cached()`. */
export interface RememberOptions {
  /** Seconds the entry lives. Default: the cache's `defaultTtl`. */
  ttl?: number
  /** Labels to clear the entry by later with `invalidateTags()`. */
  tags?: string[]
}

/** The cache service bound as `cache` in the container: JSON values over a driver, with TTLs and tags. */
export interface Cache {
  /** The parsed value, or `undefined` on a miss or after expiry. */
  get<T>(key: string): Promise<T | undefined>
  /** Store a value as JSON (`undefined` is stored as `null`), with an optional ttl and tags. */
  set<T>(key: string, value: T, options?: RememberOptions): Promise<void>
  /** Whether a live entry exists, including one holding `null`. */
  has(key: string): Promise<boolean>
  /** Remove one entry. */
  delete(key: string): Promise<void>
  /** Return the cached value, or run `fn`, store its result and return it. Concurrent calls share one run. */
  remember<T>(key: string, fn: () => Promise<T> | T, options?: RememberOptions): Promise<T>
  /** Remove every entry tagged with any of `tags`, whatever its key. */
  invalidateTags(...tags: string[]): Promise<void>
  /** Remove every entry from the driver. */
  clear(): Promise<void>
  /** The driver underneath, for its `name` or a raw read. */
  readonly driver: CacheDriver
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    cache: CacheConfig
  }
  interface ContainerBindings {
    cache: Cache
  }
}

/** Type the default export of `config/cache.ts`. Returns its argument unchanged. */
export const defineConfig = createDefineConfig<CacheConfig>()

/** In-process cache with TTLs and tags. The default; fine for one server, wrong for several. */
export function createMemoryCacheDriver(): CacheDriver {
  const entries = new Map<string, { value: string; expires?: number; tags?: string[] }>()
  const tags = new Map<string, Set<string>>()
  let lastSweep = Date.now()
  const drop = (key: string) => {
    const e = entries.get(key)
    if (!e) return
    entries.delete(key)
    for (const t of e.tags ?? []) {
      const set = tags.get(t)
      set?.delete(key)
      if (set?.size === 0) tags.delete(t)
    }
  }
  // Expired entries that are never read again would otherwise stay in memory for good.
  const sweep = () => {
    const now = Date.now()
    if (now - lastSweep < 60_000) return
    lastSweep = now
    for (const [key, e] of entries) if (e.expires !== undefined && e.expires <= now) drop(key)
  }
  const alive = (key: string) => {
    const e = entries.get(key)
    if (!e) return undefined
    if (e.expires !== undefined && e.expires <= Date.now()) {
      drop(key)
      return undefined
    }
    return e
  }
  return {
    name: 'memory',
    async get(key) {
      return alive(key)?.value
    },
    async set(key, value, ttl) {
      sweep()
      // A new value starts untagged: tags from the old one must not invalidate it later.
      drop(key)
      entries.set(key, { value, expires: ttl === undefined ? undefined : Date.now() + ttl * 1000 })
    },
    async delete(key) {
      drop(key)
    },
    async tag(key, list) {
      const e = entries.get(key)
      if (!e) return
      e.tags = [...new Set([...(e.tags ?? []), ...list])]
      for (const t of list) {
        const set = tags.get(t) ?? new Set()
        set.add(key)
        tags.set(t, set)
      }
    },
    async invalidateTags(list) {
      for (const t of list) {
        for (const key of [...(tags.get(t) ?? [])]) drop(key)
        tags.delete(t)
      }
    },
    async clear() {
      entries.clear()
      tags.clear()
    },
  }
}

/**
 * The part of an [unstorage](https://unstorage.unjs.io) `Storage` the cache uses. Any unstorage
 * instance fits, whatever its driver: Redis, Upstash, Cloudflare KV, Vercel KV, the filesystem.
 */
export interface UnstorageLike {
  getItem(key: string): Promise<unknown>
  setItem(key: string, value: string, options?: { ttl?: number }): Promise<void>
  removeItem(key: string): Promise<void>
  getKeys(base?: string): Promise<string[]>
}

interface Envelope {
  /** The serialised value. */
  v: string
  /** Expiry, ms since the epoch. */
  e?: number
  /** Tags this value was stored with. */
  t?: string[]
}

/**
 * A cache driver over any unstorage instance, so several servers share one cache:
 *
 *   import { createStorage } from 'unstorage'
 *   import redisDriver from 'unstorage/drivers/redis'
 *   export default defineConfig({
 *     driver: createUnstorageCacheDriver(createStorage({ driver: redisDriver({ url: env.REDIS_URL }) })),
 *   })
 *
 * Expiry is checked on read, so drivers without native TTLs work too; the ttl is also passed to
 * `setItem` for drivers that expire keys themselves (Redis, KV). Entries live under `base`
 * (default `kitr-cache`), so `clear()` leaves the rest of the store alone.
 */
export function createUnstorageCacheDriver(
  storage: UnstorageLike,
  options: { base?: string } = {},
): CacheDriver {
  const base = options.base ?? 'kitr-cache'
  const entry = (key: string) => `${base}:e:${key}`
  const tagKey = (tag: string) => `${base}:t:${tag}`
  // unstorage parses JSON strings on read; accept either form.
  const decode = <T>(raw: unknown): T | undefined => {
    if (raw === null || raw === undefined) return undefined
    if (typeof raw !== 'string') return raw as T
    try {
      return JSON.parse(raw) as T
    } catch {
      return undefined
    }
  }
  const read = async (key: string): Promise<Envelope | undefined> => {
    const env = decode<Envelope>(await storage.getItem(entry(key)))
    if (!env || typeof env.v !== 'string') return undefined
    if (env.e !== undefined && env.e <= Date.now()) {
      await storage.removeItem(entry(key))
      return undefined
    }
    return env
  }
  const write = (key: string, env: Envelope) => {
    const ttl = env.e === undefined ? undefined : Math.max(1, Math.ceil((env.e - Date.now()) / 1000))
    return storage.setItem(entry(key), JSON.stringify(env), ttl === undefined ? undefined : { ttl })
  }
  return {
    name: 'unstorage',
    async get(key) {
      return (await read(key))?.v
    },
    async set(key, value, ttl) {
      // A new value starts untagged, as with the memory driver.
      await write(key, { v: value, e: ttl === undefined ? undefined : Date.now() + ttl * 1000 })
    },
    async delete(key) {
      await storage.removeItem(entry(key))
    },
    async tag(key, list) {
      const env = await read(key)
      if (!env) return
      await write(key, { ...env, t: [...new Set([...(env.t ?? []), ...list])] })
      for (const t of list) {
        const keys = decode<string[]>(await storage.getItem(tagKey(t))) ?? []
        if (!keys.includes(key)) await storage.setItem(tagKey(t), JSON.stringify([...keys, key]))
      }
    },
    async invalidateTags(list) {
      for (const t of list) {
        for (const key of decode<string[]>(await storage.getItem(tagKey(t))) ?? []) {
          // Only entries still carrying the tag: a key re-set since then keeps its new value.
          const env = await read(key)
          if (env?.t?.includes(t)) await storage.removeItem(entry(key))
        }
        await storage.removeItem(tagKey(t))
      }
    },
    async clear() {
      for (const key of await storage.getKeys(base)) await storage.removeItem(key)
    },
  }
}

/** Build a cache without an app: what the provider binds, and what tests and scripts call directly. */
export function createCache(config: CacheConfig = {}): Cache {
  const driver = config.driver ?? createMemoryCacheDriver()
  const prefix = config.prefix ?? ''
  const defaultTtl = config.defaultTtl ?? 300
  const inflight = new Map<string, Promise<unknown>>()
  const k = (key: string) => `${prefix}${key}`
  const cache: Cache = {
    driver,
    async get(key) {
      const raw = await driver.get(k(key))
      return raw === undefined ? undefined : (JSON.parse(raw) as never)
    },
    async set(key, value, options = {}) {
      await driver.set(k(key), JSON.stringify(value ?? null), options.ttl ?? defaultTtl)
      if (options.tags?.length) await driver.tag(k(key), options.tags)
    },
    async has(key) {
      return (await driver.get(k(key))) !== undefined
    },
    async delete(key) {
      await driver.delete(k(key))
    },
    async remember(key, fn, options) {
      const hit = await cache.get(key)
      if (hit !== undefined) return hit as never
      const running = inflight.get(key)
      if (running) return running as never
      const run = (async () => {
        try {
          const value = await fn()
          // `undefined` reads back as a miss, so storing it (as null) would change the answer.
          if (value !== undefined) await cache.set(key, value, options)
          return value
        } finally {
          inflight.delete(key)
        }
      })()
      inflight.set(key, run)
      return run
    },
    async invalidateTags(...tags) {
      await driver.invalidateTags(tags)
    },
    async clear() {
      await driver.clear()
    },
  }
  return cache
}

/** Wrap a function so each distinct argument list is remembered under `key(...args)`. */
export function cached<Args extends unknown[], T>(
  cache: Cache,
  fn: (...args: Args) => Promise<T> | T,
  options: RememberOptions & { key: (...args: Args) => string },
): (...args: Args) => Promise<T> {
  return (...args) => cache.remember(options.key(...args), () => fn(...args), options)
}

/** The app's cache, from the container. Pass `ctx.app` in a controller; throws if the cache provider is not registered. */
export function useCache(app: KitrApp): Cache {
  return app.container.use('cache')
}
