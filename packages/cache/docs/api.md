---
title: API
description: Every export of @kitr/cache, with its signature.
order: 2
---

# API

Every export of `@kitr/cache`, `@kitr/cache/provider`, read from the published type definitions. The [guide](/packages/cache) shows them in use.

## @kitr/cache

### cached

```ts
function cached<Args extends unknown[], T>(cache: Cache, fn: (...args: Args) => Promise<T> | T, options: RememberOptions & {
  key: (...args: Args) => string;
}): (...args: Args) => Promise<T>;
```

Wrap a function so each distinct argument list is remembered under `key(...args)`.

### createCache

```ts
function createCache(config?: CacheConfig): Cache;
```

Build a cache without an app: what the provider binds, and what tests and scripts call directly.

### createMemoryCacheDriver

```ts
function createMemoryCacheDriver(): CacheDriver;
```

In-process cache with TTLs and tags. The default; fine for one server, wrong for several (use `createRedisCacheDriver`).

### createRedisCacheDriver

```ts
function createRedisCacheDriver(redis: RedisCacheClient, options?: {
  base?: string;
}): CacheDriver;
```

A cache driver over Redis, so every instance reads and clears the same entries. Redis expires
entries itself; tags are Redis sets, and a value set again starts untagged, as with the memory
driver. Everything lives under `base` (default `kitr:cache:`), and `clear()` deletes only
keys under it, never the whole database:

```ts
driver: createRedisCacheDriver(new Redis(process.env.REDIS_URL))
```

### createUnstorageCacheDriver

```ts
function createUnstorageCacheDriver(storage: UnstorageLike, options?: {
  base?: string;
}): CacheDriver;
```

A cache driver over any unstorage instance, so several servers share one cache: in
`config/cache.ts`, `driver: createUnstorageCacheDriver(createStorage({ driver: redisDriver(...) }))`
with `createStorage` from unstorage and the driver from `unstorage/drivers/redis` (or any other).

Expiry is checked on read, so drivers without native TTLs work too; the ttl is also passed to
`setItem` for drivers that expire keys themselves (Redis, KV). Entries live under `base`
(default `kitr-cache`), so `clear()` leaves the rest of the store alone.

### useCache

```ts
function useCache(app: KitrApp): Cache;
```

The app's cache, from the container. Pass `ctx.app` in a controller; throws if the cache provider is not registered.

### defineConfig

```ts
const defineConfig: <const C extends CacheConfig>(config: C) => C;
```

Type the default export of `config/cache.ts`. Returns its argument unchanged.

### Cache

```ts
interface Cache {
  /** The parsed value, or `undefined` on a miss or after expiry. */
  get<T>(key: string): Promise<T | undefined>;
  /** Store a value as JSON (`undefined` is stored as `null`), with an optional ttl and tags. */
  set<T>(key: string, value: T, options?: RememberOptions): Promise<void>;
  /** Whether a live entry exists, including one holding `null`. */
  has(key: string): Promise<boolean>;
  /** Remove one entry. */
  delete(key: string): Promise<void>;
  /** Return the cached value, or run `fn`, store its result and return it. Concurrent calls share one run. */
  remember<T>(key: string, fn: () => Promise<T> | T, options?: RememberOptions): Promise<T>;
  /** Remove every entry tagged with any of `tags`, whatever its key. */
  invalidateTags(...tags: string[]): Promise<void>;
  /** Remove every entry from the driver. */
  clear(): Promise<void>;
  /** The driver underneath, for its `name` or a raw read. */
  readonly driver: CacheDriver;
}
```

The cache service bound as `cache` in the container: JSON values over a driver, with TTLs and tags.

### CacheConfig

```ts
interface CacheConfig {
  /** Where entries live. Default: `createMemoryCacheDriver()`. */
  driver?: CacheDriver;
  /** Prepended to every key, so several apps can share one Redis. */
  prefix?: string;
  /** Seconds, when `remember()` is called without a ttl. Default 300. */
  defaultTtl?: number;
}
```

The options in `config/cache.ts`, also accepted by `createCache()`.

### CacheDriver

```ts
interface CacheDriver {
  /** Shown in devtools and logs, e.g. `memory` or `redis`. */
  name: string;
  /** The stored string, or `undefined` when the key is missing or expired. */
  get(key: string): Promise<string | undefined>;
  /** `ttl` in seconds; `undefined` keeps the entry until deleted. */
  set(key: string, value: string, ttl?: number): Promise<void>;
  /** Remove one key and forget its tags. */
  delete(key: string): Promise<void>;
  /** Remove every key tagged with any of `tags`. */
  invalidateTags(tags: string[]): Promise<void>;
  /** Record the tags of a key so `invalidateTags` can find it. */
  tag(key: string, tags: string[]): Promise<void>;
  /** Remove every key and every tag. */
  clear(): Promise<void>;
}
```

What a cache backend implements: six async methods over string keys and string values.
Values arrive already serialised to JSON by the cache, and keys already carry the prefix.

### RedisCacheClient

```ts
interface RedisCacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  set(key: string, value: string, ex: 'EX', seconds: number): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  sadd(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  sismember(key: string, member: string): Promise<number>;
  pttl(key: string): Promise<number>;
  pexpire(key: string, ms: number): Promise<number>;
  scan(cursor: string, match: 'MATCH', pattern: string, count: 'COUNT', n: number): Promise<[
    string,
    string[]
  ]>;
}
```

The part of an [ioredis](https://github.com/redis/ioredis) client the Redis cache driver uses.
An ioredis `Redis` fits as it is.

### RememberOptions

```ts
interface RememberOptions {
  /** Seconds the entry lives. Default: the cache's `defaultTtl`. */
  ttl?: number;
  /** Labels to clear the entry by later with `invalidateTags()`. */
  tags?: string[];
}
```

Per-entry options for `set()`, `remember()` and `cached()`.

### UnstorageLike

```ts
interface UnstorageLike {
  getItem(key: string): Promise<unknown>;
  setItem(key: string, value: string, options?: {
    ttl?: number;
  }): Promise<void>;
  removeItem(key: string): Promise<void>;
  getKeys(base?: string): Promise<string[]>;
}
```

The part of an [unstorage](https://unstorage.unjs.io) `Storage` the cache uses. Any unstorage
instance fits, whatever its driver: Redis, Upstash, Cloudflare KV, Vercel KV, the filesystem.

## @kitr/cache/provider

### cacheProvider

```ts
const cacheProvider: import("@kitr/core").KitrProvider;
```

Binds `cache` from `config/cache.ts` (memory driver by default) on the server; does nothing in the browser.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
