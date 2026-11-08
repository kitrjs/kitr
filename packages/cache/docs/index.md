---
title: Cache
description: Remember slow results on the server and clear them by tag when the data changes.
order: 1
---

# Cache

Some reads are slow or expensive: a project report that joins six tables, a call to a rate-limited API. `@kitr/cache` keeps the result for a while, so the next request gets it straight from memory or Redis. When the data changes, one tag clears every cached result about it.

> [!SUMMARY]
> Remember slow results on the server and clear them by tag when the data changes. Add it with `kitr add cache`; the overview is at [/packages/cache](/packages/cache).

Values are stored as JSON through a six-method driver: memory is built in, with [unstorage](https://unstorage.unjs.io) and Redis drivers for production. On top it adds expiry, tags, a key prefix, and `remember()`, which runs slow work once even when fifty requests ask at the same moment.

It runs on the server only. To cache API results on the client, use [query](/packages/query).

The examples follow Acme's project dashboard at `app.acme.com`: project reports, open invoices and an exchange rate.

## Install

```sh
kitr add cache
```

<details>
<summary>Everything kitr add changes</summary>

What `kitr add` does:

- Adds the [server](/packages/server) package first when missing, which also adds [logger](/packages/logger).
- Adds `@kitr/cache` to `dependencies` in `package.json` and installs it. Pass `--no-install` to skip the install.
- Adds `() => import('@kitr/cache/provider')` to `providers` and `'@kitr/cache'` to `packages` in `kitrrc.ts`. The provider binds `cache` in the container.
- Writes `config/cache.ts`, with `prefix` set to your package name.
- Adds a `## kitr: cache` section to `AGENTS.md`: expensive reads go through `cache.remember()` or `cached()`, `useCache(ctx.app)` in controllers, and writes invalidate by tag instead of guessing keys.

It asks no questions. No kit includes the cache.

`kitr remove cache` reverses every step: it removes the provider and package from `kitrrc.ts`, deletes `config/cache.ts`, removes the dependency and the `AGENTS.md` section, then lists files that still import `@kitr/cache`.

</details>

## Configure

`kitr add cache` writes this file (here for a project named `acme-app`):

```ts
// config/cache.ts
import { defineConfig } from '@kitr/cache'

export default defineConfig({
  // In-memory by default. For several instances pass a shared driver: createUnstorageCacheDriver(...).
  prefix: 'acme-app:',
  defaultTtl: 300,
})
```

| Option | Default | Description |
| --- | --- | --- |
| `driver` | `createMemoryCacheDriver()` | Where entries live. Any object that implements `CacheDriver`. See [Drivers](#drivers). |
| `prefix` | `''` | Prepended to every key before it reaches the driver, so several apps can share one Redis. |
| `defaultTtl` | `300` | Seconds an entry lives when `set()`, `remember()` or `cached()` is called without a `ttl`. |

The cache reads no env variables itself; a Redis driver usually reads `REDIS_URL`. Config files are TypeScript, so values can differ per environment, such as short-lived entries in development:

```ts
// config/cache.ts
import { defineConfig } from '@kitr/cache'

export default defineConfig({
  prefix: 'acme-app:',
  defaultTtl: process.env.NODE_ENV === 'production' ? 300 : 5,
})
```

## Cache your first slow read

Get the cache with `useCache(app)` and wrap the slow call in `remember()`. This controller builds a project report once every ten minutes:

```ts
// server/controllers/reports-controller.ts
import type { HttpContext } from '@kitr/api'
import { useCache } from '@kitr/cache'
import { buildProjectReport } from '#server/reports/project_report'

export default class ReportsController {
  async show({ app, params }: HttpContext<{ id: string }>) {
    return useCache(app).remember(
      `report:project:${params.id}`,
      () => buildProjectReport(params.id),
      { ttl: 600, tags: ['reports', `project:${params.id}`] },
    )
  }
}
```

Add the route next to the others:

```ts
// server/routes.ts
import { defineRoutes } from '@kitr/api'
import ReportsController from '#server/controllers/reports-controller'

export const routes = defineRoutes((router) =>
  router.group({ prefix: '/api' }, (api) =>
    api.get('/projects/:id/report', [ReportsController, 'show'], { name: 'projects.report' }),
  ),
)
```

The first request runs `buildProjectReport('42')` and stores the result for 600 seconds; later requests skip the database. After a write to project 42, [clear the tag](#clear-entries-by-tag) and the next request builds a fresh report.

## Get the cache on the server

The provider binds one cache as `cache` in the container. `useCache(app)` reads it, typed:

```ts
// server/controllers/invoices-controller.ts
import type { HttpContext } from '@kitr/api'
import { useCache } from '@kitr/cache'

export default class InvoicesController {
  async index({ app }: HttpContext) {
    const cache = useCache(app)
    return cache.get<{ id: string; total: number }[]>('invoices:open')
  }
}
```

`useCache` is a typed spelling of `app.container.use('cache')`. In a background job, the job context carries the app:

```ts
// server/jobs/warm-reports.ts
import { useCache } from '@kitr/cache'
import { defineJob } from '@kitr/jobs'
import { buildProjectReport } from '#server/reports/project_report'

export const warmReportsJob = defineJob('warm-reports', {
  schedule: { every: '1h' },
  async run(_payload, { app }) {
    const cache = useCache(app)
    for (const id of ['42', '43']) {
      await cache.set(`report:project:${id}`, await buildProjectReport(id), {
        ttl: 3600,
        tags: ['reports', `project:${id}`],
      })
    }
  },
})
```

> [!WARNING] No binding named "cache"
> `useCache` throws this when the provider is not registered, or in browser code. Run `kitr add cache`, or check `kitrrc.ts` still lists `@kitr/cache/provider`.

## Remember a result

`remember(key, fn, options)` returns the cached value when there is one. On a miss it runs `fn`, stores what it returns and returns that:

```ts
// server/reports/team_summary.ts
import type { Cache } from '@kitr/cache'
import { countOpenInvoices } from '#server/repositories/invoices'

export function teamSummary(cache: Cache, teamId: string) {
  return cache.remember(
    `summary:team:${teamId}`,
    async () => ({ teamId, openInvoices: await countOpenInvoices(teamId) }),
    { ttl: 120, tags: [`team:${teamId}`] },
  )
}

// await teamSummary(cache, 'design')
// => { teamId: 'design', openInvoices: 3 }   (runs countOpenInvoices)
// await teamSummary(cache, 'design')
// => { teamId: 'design', openInvoices: 3 }   (from the cache, nothing runs)
```

What `remember()` stores:

| `fn` returns or throws | Stored? | Next call |
| --- | --- | --- |
| A value, including `0`, `''`, `false` and `null` | Yes, for `ttl` seconds | Gets the stored value |
| `undefined` | No | Runs `fn` again |
| Throws or rejects | No; the error reaches every waiting caller | Runs `fn` again |
| Still running when another call arrives with the same key | Once | Waits for the same run |

The last row is why to prefer `remember()` over `get()` then `set()`: when a popular entry expires, fifty simultaneous misses rebuild the report fifty times with `get()`, but once with `remember()`:

```ts
// server/reports/warm.ts
import type { Cache } from '@kitr/cache'
import { buildProjectReport } from '#server/reports/project_report'

export async function loadReportForEveryone(cache: Cache) {
  const calls = Array.from({ length: 50 }, () =>
    cache.remember('report:project:42', () => buildProjectReport('42'), { ttl: 600 }),
  )
  return Promise.all(calls)
}
// buildProjectReport ran once; all 50 calls got its result.
```

Sharing a run works inside one server process. A failure is not cached, so a database blip does not leave a broken answer in place; waiting callers get the same error and the next call tries again:

```ts
// server/rates/eur_rate.ts
import type { Cache } from '@kitr/cache'
import { fetchRate } from '#server/rates/client'

export async function eurRate(cache: Cache): Promise<number | null> {
  try {
    return await cache.remember('rate:USD:EUR', () => fetchRate('USD', 'EUR'), { ttl: 3600 })
  } catch {
    // The rates API is down. Nothing was stored; the next call asks again.
    return null
  }
}
// await eurRate(cache)   // rates API down
// => null
// await eurRate(cache)   // rates API back
// => 0.92
```

## Choose a key

A key names one answer. Put every input that changes the answer into it, general to specific:

```ts
// server/reports/keys.ts
export const reportKey = (projectId: string) => `report:project:${projectId}`
export const invoicesKey = (teamId: string, status: 'open' | 'paid', page: number) =>
  `invoices:team:${teamId}:${status}:page:${page}`
export const rateKey = (from: string, to: string) => `rate:${from}:${to}`
```

Keep keys in one module so the code that reads an entry and the code that deletes it can't drift apart. The `config/cache.ts` prefix is added for you: `cache.get('rate:USD:EUR')` reads `acme-app:rate:USD:EUR`.

> [!WARNING] Per-user data
> Anything that differs per user belongs in the key. Cached under `invoices:mine`, Ada's invoices would be served to Grace. Use `invoices:user:${user.id}`.

## Set expiry times

Every entry expires. `ttl` is in seconds; without one the entry gets `defaultTtl` (300):

```ts
// server/rates/refresh.ts
import { useCache } from '@kitr/cache'
import type { KitrApp } from '@kitr/kitr/app'
import { fetchRate } from '#server/rates/client'

export async function refreshRates(app: KitrApp) {
  const cache = useCache(app)
  await cache.set('rate:USD:EUR', await fetchRate('USD', 'EUR'), { ttl: 3600 }) // one hour
  await cache.set('rate:USD:GBP', await fetchRate('USD', 'GBP')) // defaultTtl: 300 seconds
}
```

Pick the ttl from how stale the answer may be, not how slow it is to build. An invoice count can be two minutes old, a display exchange rate an hour; a permission check should not be cached. When you clear by tag after every write, a long ttl is safe.

## Clear entries by tag

Tag an entry with what it is about. After a write, clear the tag and every entry about that thing is gone, whatever its key:

```ts
// server/controllers/projects-controller.ts
import type { HttpContext } from '@kitr/api'
import { useCache } from '@kitr/cache'
import { updateProject } from '#server/repositories/projects'

export default class ProjectsController {
  async update({ app, params, body }: HttpContext<{ id: string }, {}, { name: string }>) {
    const project = await updateProject(params.id, body)
    await useCache(app).invalidateTags(`project:${params.id}`)
    return project
  }
}
```

Entries tagged `project:43` stay. `invalidateTags()` takes several tags and clears an entry that carries any of them:

```ts
// server/controllers/invoices-controller.ts
import type { HttpContext } from '@kitr/api'
import { useCache } from '@kitr/cache'
import { markInvoicePaid } from '#server/repositories/invoices'

export default class InvoicesController {
  async pay({ app, params }: HttpContext<{ id: string }>) {
    const invoice = await markInvoicePaid(params.id)
    await useCache(app).invalidateTags(`team:${invoice.teamId}`, `project:${invoice.projectId}`)
    return invoice
  }
}
```

A tag that matches nothing is not an error. Tag by the records a result depends on (`project:42`) and by kind (`reports`), so `invalidateTags('reports')` clears a whole family after a deploy.

> [!WARNING]
> Don't guess keys after a write with a loop of `delete()` calls. Lists and summaries hide under many keys, and the one you forget serves stale data. Clear the tag.

## Wrap a function

`cached(cache, fn, options)` turns a function into one that remembers its results, one entry per argument list, named by `options.key`:

```ts
// server/rates/exchange_rate.ts
import { type Cache, cached } from '@kitr/cache'
import { fetchRate } from '#server/rates/client'

export const exchangeRate = (cache: Cache) =>
  cached(cache, (from: string, to: string) => fetchRate(from, to), {
    key: (from, to) => `rate:${from}:${to}`,
    ttl: 3600,
    tags: ['rates'],
  })
```

Call it with the app's cache wherever you need a rate:

```ts
// server/controllers/orders-controller.ts
import type { HttpContext } from '@kitr/api'
import { useCache } from '@kitr/cache'
import { exchangeRate } from '#server/rates/exchange_rate'

export default class OrdersController {
  async total({ app }: HttpContext) {
    const rate = exchangeRate(useCache(app))
    const eur = await rate('USD', 'EUR') // fetches, stores under rate:USD:EUR
    await rate('USD', 'EUR') // from the cache
    return { totalEur: Math.round(1250 * eur) }
    // => { totalEur: 1150 }   with a rate of 0.92
  }
}
```

The wrapper follows every `remember()` rule. Use `cached()` when a function is called from many places and `remember()` inline when from one. Entries live in the driver, so building the wrapper per request costs nothing.

> [!WARNING]
> Don't call `useCache(server.app)` at module level: the module loads before the provider has bound `cache`.

## Read and write entries directly

The cache is also a typed key-value store:

```ts
// server/teams/budget.ts
import { useCache } from '@kitr/cache'
import type { KitrApp } from '@kitr/kitr/app'

export async function budgetExample(app: KitrApp) {
  const cache = useCache(app)

  await cache.set('budget:team:design', { spent: 1200, limit: 5000 }, { ttl: 60, tags: ['team:design'] })

  await cache.get<{ spent: number; limit: number }>('budget:team:design')
  // => { spent: 1200, limit: 5000 }
  await cache.has('budget:team:design')
  // => true
  await cache.delete('budget:team:design')
  await cache.get('budget:team:design')
  // => undefined
}
```

| Method | Returns | Description |
| --- | --- | --- |
| `get<T>(key)` | `Promise<T \| undefined>` | The parsed value, or `undefined` on a miss or after expiry. |
| `set(key, value, { ttl, tags })` | `Promise<void>` | Store a value as JSON. Replaces any entry under the key, with its tags. |
| `has(key)` | `Promise<boolean>` | Whether a live entry exists, including one that holds `null`. |
| `delete(key)` | `Promise<void>` | Remove one entry. |
| `remember(key, fn, { ttl, tags })` | `Promise<T>` | Cached value, or run `fn` and store it. See [Remember a result](#remember-a-result). |
| `invalidateTags(...tags)` | `Promise<void>` | Remove every entry tagged with any of `tags`. |
| `clear()` | `Promise<void>` | Remove every entry from the driver. |
| `driver` | `CacheDriver` | The driver underneath. |

`get()` returns `undefined` only for a miss, so a stored `0`, `false` or `null` comes back as itself.

## Store values that survive JSON

Values pass through JSON. Plain objects, arrays, strings, numbers, booleans and `null` round-trip exactly; other types change shape:

```ts
// server/orders/last_order.ts
import { useCache } from '@kitr/cache'
import type { KitrApp } from '@kitr/kitr/app'

export async function lastOrderExample(app: KitrApp) {
  const cache = useCache(app)

  await cache.set('order:last', { id: 'ord_1', placedAt: new Date('2026-03-01T09:00:00Z') })
  await cache.get('order:last')
  // => { id: 'ord_1', placedAt: '2026-03-01T09:00:00.000Z' }   a string, not a Date

  await cache.set('order:none', undefined)
  await cache.get('order:none')
  // => null
}
```

| Stored | Read back |
| --- | --- |
| `Date` | ISO string |
| `undefined` (as the whole value) | `null` |
| `undefined` inside an object | The key is missing |
| `Map`, `Set` | `{}` |
| `BigInt` | `set()` throws a `TypeError` |
| Class instance | Plain object, no methods |

Convert after the read when you need the richer type: `new Date(order.placedAt)`.

## Drivers

A driver decides where entries live; swapping drivers changes nothing else in your code.

| Driver | Shared between instances | Survives a restart | Use for |
| --- | --- | --- | --- |
| Memory (default) | No | No | Development, tests, one server process |
| unstorage (built in) | Yes | Yes | Production: Redis, Upstash, Cloudflare KV, Vercel KV or the filesystem |
| Redis (built in) | Yes | Yes | Production with a Redis server: native expiry, tag sets, a `clear()` that stays inside its prefix |

### Memory

The default: leave `driver` out of `config/cache.ts`. To pass it explicitly, for example to share one driver between two caches:

```ts
// config/cache.ts
import { createMemoryCacheDriver, defineConfig } from '@kitr/cache'

export default defineConfig({
  driver: createMemoryCacheDriver(),
  prefix: 'acme-app:',
  defaultTtl: 300,
})
```

Each process has its own copy, emptied on restart. Behind a load balancer, `invalidateTags()` on one instance leaves the others serving the old value, so move to a shared store first.

### unstorage

`createUnstorageCacheDriver` stores entries through any [unstorage](https://unstorage.unjs.io) instance, so one line picks a [backend](https://unstorage.unjs.io/drivers). Install unstorage and the client its driver needs:

```sh
pnpm add unstorage ioredis
```

```ts
// config/cache.ts
import { createUnstorageCacheDriver, defineConfig } from '@kitr/cache'
import { createStorage } from 'unstorage'
import redisDriver from 'unstorage/drivers/redis'

export default defineConfig({
  driver: createUnstorageCacheDriver(
    createStorage({ driver: redisDriver({ url: process.env.REDIS_URL }) }),
  ),
  prefix: 'acme-app:',
})
```

Expiry is checked on every read, so drivers without native expiry work too. Entries live under the `kitr-cache` base (change it with `{ base: 'other' }`), and `clear()` only removes keys under it.

### Redis

`createRedisCacheDriver` talks to Redis directly: Redis expires entries, tags are Redis sets, and every instance shares them. It takes an [ioredis](https://github.com/redis/ioredis) client:

```sh
pnpm add ioredis
```

Use it in the config:

```ts
// config/cache.ts
import { createRedisCacheDriver, defineConfig } from '@kitr/cache'
import { Redis } from 'ioredis'

export default defineConfig({
  driver: createRedisCacheDriver(new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')),
  prefix: 'acme-app:',
  defaultTtl: 300,
})
```

Add the connection string to `.env`:

```sh
REDIS_URL=redis://localhost:6379
```

| Option | Default | Description |
| --- | --- | --- |
| `base` | `'kitr:cache:'` | Prefix for every key the driver writes. Second argument: `{ base }`. |

`invalidateTags()` on any instance removes the entry for all of them. `clear()` scans for keys under `base`, so it never touches sessions or queues in the same Redis, but it is slow on a large cache; prefer tags. Tag names carry the prefix too, so two apps sharing a Redis keep their entries apart. See the [ioredis docs](https://github.com/redis/ioredis#readme) for TLS, clusters and Sentinel.

## Use the cache in production

- **Several instances need a shared driver.** Use [Redis](#redis) or [unstorage](#unstorage).
- **`remember()` shares one run per instance, not per cluster.** For a very slow `fn`, warm the entry from a [job](/packages/jobs).
- **A cache is not a store.** Anything in it can vanish. Never keep the only copy of data there.
- **Driver errors are not caught.** If Redis is down, `get()`, `set()` and `remember()` reject. Catch it where the page should still load without the cache.

## Testing

`createCache()` builds a cache with the memory driver and no app. Vitest's fake timers move the clock past a ttl:

```ts
// server/reports/team_summary.test.ts
import { createCache } from '@kitr/cache'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.useRealTimers()
})

describe('team summary cache', () => {
  it('builds once, serves from the cache, and rebuilds after a tag is cleared', async () => {
    const cache = createCache({ prefix: 'test:', defaultTtl: 60 })
    const countOpenInvoices = vi.fn(async (teamId: string) => (teamId === 'design' ? 3 : 0))
    const summary = (teamId: string) =>
      cache.remember(
        `summary:team:${teamId}`,
        async () => ({ teamId, openInvoices: await countOpenInvoices(teamId) }),
        { tags: [`team:${teamId}`] },
      )

    expect(await summary('design')).toEqual({ teamId: 'design', openInvoices: 3 })
    expect(await summary('design')).toEqual({ teamId: 'design', openInvoices: 3 })
    expect(countOpenInvoices).toHaveBeenCalledTimes(1)

    await cache.invalidateTags('team:design')
    await summary('design')
    expect(countOpenInvoices).toHaveBeenCalledTimes(2)
  })

  it('expires entries after the ttl', async () => {
    vi.useFakeTimers()
    const cache = createCache()
    await cache.set('rate:USD:EUR', 0.92, { ttl: 10 })
    vi.advanceTimersByTime(9_999)
    expect(await cache.get('rate:USD:EUR')).toBe(0.92)
    vi.advanceTimersByTime(1)
    expect(await cache.get('rate:USD:EUR')).toBeUndefined()
  })
})
```

Code that calls `useCache(app)` needs an app with the provider. `createTestApp` from [testing](/packages/testing) boots one with your config:

```ts
// server/reports/report_cache.test.ts
import { useCache } from '@kitr/cache'
import cacheProvider from '@kitr/cache/provider'
import { createTestApp } from '@kitr/testing'
import { expect, it } from 'vitest'

it('binds the cache from config', async () => {
  const app = await createTestApp({
    providers: [cacheProvider],
    config: { cache: { prefix: 'acme-test:' } },
  })
  const cache = useCache(app)
  await cache.set('report:project:42', { total: 12 })
  expect(await cache.driver.get('acme-test:report:project:42')).toBe('{"total":12}')
})
```

Each `createCache()` and test app gets its own memory driver, so tests never see each other's entries.

## Extend

A driver implements `CacheDriver`: a `name` and six async methods over strings. The prefix and JSON are already applied.

| Member | Called by | Must |
| --- | --- | --- |
| `name` | devtools | Name the driver, e.g. `redis`. |
| `get(key)` | `get`, `has`, `remember` | Return the string, or `undefined` when missing or expired. |
| `set(key, value, ttl)` | `set`, `remember` | Store the string; expire it after `ttl` seconds (`undefined` means never). |
| `delete(key)` | `delete` | Remove the key. |
| `tag(key, tags)` | `set` with `tags` | Record that `key` carries each tag. |
| `invalidateTags(tags)` | `invalidateTags` | Remove every key that carries any of `tags`. |
| `clear()` | `clear` | Remove everything the driver holds. |

Drivers compose. This one wraps another and counts hits and misses, which helps tune ttls:

```ts
// server/cache/counting_driver.ts
import type { CacheDriver } from '@kitr/cache'

export function countingDriver(inner: CacheDriver) {
  const stats = { hits: 0, misses: 0 }
  const driver: CacheDriver = {
    name: `counting(${inner.name})`,
    async get(key) {
      const value = await inner.get(key)
      if (value === undefined) stats.misses++
      else stats.hits++
      return value
    },
    set: (key, value, ttl) => inner.set(key, value, ttl),
    delete: (key) => inner.delete(key),
    tag: (key, tags) => inner.tag(key, tags),
    invalidateTags: (tags) => inner.invalidateTags(tags),
    clear: () => inner.clear(),
  }
  return { driver, stats }
}
```

Register it in the config like any other driver:

```ts
// config/cache.ts
import { createMemoryCacheDriver, defineConfig } from '@kitr/cache'
import { countingDriver } from '#server/cache/counting_driver'

export const cacheStats = countingDriver(createMemoryCacheDriver())

export default defineConfig({
  driver: cacheStats.driver,
  prefix: 'acme-app:',
  defaultTtl: 300,
})
```

See [`CacheDriver`](/packages/cache/api#cachedriver) for the exact signatures.

## Devtools

With [devtools](/packages/devtools) installed, the provider logs its driver (for example `driver: memory`) to the `cache` channel, which confirms production picked up Redis.

## Next steps

- [API reference](/packages/cache/api): every export with its signature.
- [Jobs](/packages/jobs): warm slow entries on a schedule.
- [Run on more than one instance](/guides/scale-out): the cache, queue and limits on shared Redis.
