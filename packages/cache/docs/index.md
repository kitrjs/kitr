---
title: Cache
description: Remember slow results on the server and clear them by tag when the data changes.
order: 1
---

# Cache

Some reads are slow or expensive: a report that joins six tables, a call to a rate-limited API, a page of Markdown rendered from a CMS. `kitr/cache` keeps the result for a while so the next request gets it instantly. When the data changes, you clear every cached result about it with one tag instead of hunting down keys.

It runs on the server only. In the browser, [query](/packages/query) already caches what the API returns.

## Install

```sh
kitr add cache
```

This writes `config/cache.ts` and registers the provider, which binds `cache` in the container:

```ts
// config/cache.ts
import { defineConfig } from 'kitr/cache'

export default defineConfig({
  prefix: 'my-app:',
  defaultTtl: 300,
})
```

| Option | Default | Description |
| --- | --- | --- |
| `driver` | memory | Where entries live. See [Drivers](#drivers). |
| `prefix` | none | Prepended to every key, so several apps can share one Redis. |
| `defaultTtl` | `300` | Seconds an entry lives when you don't pass a `ttl`. |

## Remember a result

`remember(key, fn, options)` returns the cached value, or runs `fn`, stores what it returns and returns that:

```ts
// server/controllers/reports_controller.ts
import type { HttpContext } from 'kitr/api'
import { useCache } from 'kitr/cache'

export default class ReportsController {
  async show({ app, params }: HttpContext<{ id: string }>) {
    return useCache(app).remember(
      `report:${params.id}`,
      () => buildReport(params.id), // the slow part
      { ttl: 600, tags: ['reports', `project:${params.id}`] },
    )
  }
}
```

If fifty requests miss at the same moment, `fn` runs once and all fifty get its result. A function that returns `undefined` isn't cached, so it's asked again next time.

## Clear by tag

Tag entries with what they're about, then clear the tag after a write:

```ts
async update({ app, params, body }: HttpContext<{ id: string }>) {
  const project = await db.projects.update(params.id, body)
  await useCache(app).invalidateTags(`project:${params.id}`)
  return project
}
```

Every entry tagged `project:42` is gone, whatever its key was. `invalidateTags('a', 'b')` clears several tags at once.

## Wrap a function

`cached()` turns a function into a cached one. Each distinct argument list gets its own entry:

```ts
import { cached, useCache } from 'kitr/cache'

const exchangeRate = cached(
  useCache(app),
  (from: string, to: string) => ratesApi.get(from, to),
  { key: (from, to) => `rate:${from}:${to}`, ttl: 3600 },
)

await exchangeRate('EUR', 'USD')
```

## Reading and writing directly

| Method | Description |
| --- | --- |
| `get(key)` | The value, or `undefined` on a miss. |
| `set(key, value, { ttl, tags })` | Store a value. Values are stored as JSON. |
| `has(key)` | Whether a live entry exists. |
| `delete(key)` | Remove one entry. |
| `clear()` | Remove everything. |

## Drivers

The memory driver is the default. It's fast and needs nothing, but each server process has its own copy and it empties on restart. Once you run more than one instance, use a shared store.

A driver is an object with six methods over strings, so Redis takes a few lines:

```ts
// config/cache.ts
import { defineConfig, type CacheDriver } from 'kitr/cache'
import { Redis } from 'ioredis'

const redis = new Redis(process.env.REDIS_URL!)

const redisDriver: CacheDriver = {
  name: 'redis',
  get: async (key) => (await redis.get(key)) ?? undefined,
  set: async (key, value, ttl) => {
    if (ttl) await redis.set(key, value, 'EX', ttl)
    else await redis.set(key, value)
  },
  delete: async (key) => void (await redis.del(key)),
  tag: async (key, tags) => void (await Promise.all(tags.map((t) => redis.sadd(`tag:${t}`, key)))),
  invalidateTags: async (tags) => {
    for (const t of tags) {
      const keys = await redis.smembers(`tag:${t}`)
      if (keys.length) await redis.del(...keys)
      await redis.del(`tag:${t}`)
    }
  },
  clear: async () => void (await redis.flushdb()),
}

export default defineConfig({ driver: redisDriver, prefix: 'my-app:' })
```

## Tests

`createCache()` builds a cache with the memory driver and no app, which is all a test needs:

```ts
import { createCache } from 'kitr/cache'

const cache = createCache({ defaultTtl: 60 })
```
