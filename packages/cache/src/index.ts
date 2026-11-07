import { createDefineConfig, type KitrApp } from '@kitr/core'

/** What a cache backend implements. Values are already serialised to strings by the cache. */
export interface CacheDriver {
  name: string
  get(key: string): Promise<string | undefined>
  /** `ttl` in seconds; `undefined` keeps the entry until deleted. */
  set(key: string, value: string, ttl?: number): Promise<void>
  delete(key: string): Promise<void>
  /** Remove every key tagged with any of `tags`. */
  invalidateTags(tags: string[]): Promise<void>
  /** Record the tags of a key so `invalidateTags` can find it. */
  tag(key: string, tags: string[]): Promise<void>
  clear(): Promise<void>
}

export interface CacheConfig {
  driver?: CacheDriver
  /** Prepended to every key, so several apps can share one Redis. */
  prefix?: string
  /** Seconds, when `remember()` is called without a ttl. Default 300. */
  defaultTtl?: number
}

export interface RememberOptions {
  /** Seconds. */
  ttl?: number
  tags?: string[]
}

export interface Cache {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T, options?: RememberOptions): Promise<void>
  has(key: string): Promise<boolean>
  delete(key: string): Promise<void>
  /** Return the cached value, or run `fn`, store its result and return it. Concurrent calls share one run. */
  remember<T>(key: string, fn: () => Promise<T> | T, options?: RememberOptions): Promise<T>
  invalidateTags(...tags: string[]): Promise<void>
  clear(): Promise<void>
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

/** The app's cache, from the container. */
export function useCache(app: KitrApp): Cache {
  return app.container.use('cache')
}
