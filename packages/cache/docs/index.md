---
title: Cache
description: Remember slow results on the server and clear them by tag when the data changes.
order: 1
---

# Cache

Some reads are slow or expensive: a project report that joins six tables, a call to a rate-limited exchange-rate API, an invoice PDF summary rendered from a template. `@kitr/cache` keeps the result for a while, so the next request gets it straight from memory or Redis. When the data changes, you clear every cached result about it with one tag instead of hunting down keys.

The package is a small layer of its own, not a wrapper: values are stored as JSON through a six-method driver, with a memory driver built in and an [unstorage](https://unstorage.unjs.io) driver for Redis, Upstash, Cloudflare KV and the rest. On top of a plain key-value store it adds expiry times, tags, a key prefix, and `remember()`, which runs slow work once even when fifty requests ask at the same moment.

It runs on the server only. The provider does nothing in the browser. To cache what the API returns on the client, use [query](/packages/query), which already does.

The examples on this page follow Acme's project dashboard at `app.acme.com`: a report per project, a list of a team's open invoices, and an exchange rate used to show order totals in euros.

## Install

```sh
kitr add cache
```

What `kitr add` does:

- Adds the [server](/packages/server) package first if the project does not have it yet (and [logger](/packages/logger), which the server needs). The cache only runs on the server.
- Adds `@kitr/cache` to `dependencies` in `package.json` and installs it. Pass `--no-install` to skip the install.
- Adds `() => import('@kitr/cache/provider')` to `providers` and `'@kitr/cache'` to `packages` in `kitrrc.ts`. The provider binds `cache` in the container.
- Writes `config/cache.ts`, with `prefix` set to your package name.
- Adds a `## kitr: cache` section to `AGENTS.md`: expensive reads go through `cache.remember()` or `cached()`, `useCache(ctx.app)` in controllers, and writes invalidate by tag instead of guessing keys.

It adds no env variables, no scripts and asks no questions. No kit includes the cache, so every project adds it with this command.

`kitr remove cache` reverses every step above: it takes the provider and the package out of `kitrrc.ts`, deletes `config/cache.ts`, removes the dependency and the `AGENTS.md` section, then lists the files that still import `@kitr/cache`.

## Configure

`kitr add cache` writes this file. In a project whose `package.json` is named `acme-app`, it reads:

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

The cache reads no env variables itself. A Redis driver usually reads `REDIS_URL`; see [unstorage](#unstorage).

Config files are TypeScript, so you can choose values per environment in the file. To keep entries short-lived in development while you iterate on a report:

```ts
// config/cache.ts
import { defineConfig } from '@kitr/cache'

export default defineConfig({
  prefix: 'acme-app:',
  defaultTtl: process.env.NODE_ENV === 'production' ? 300 : 5,
})
```

## Cache your first slow read

On the server, get the cache with `useCache(app)` and wrap the slow call in `remember()`. This controller builds Acme's project report once every ten minutes:

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

The first `GET /api/projects/42/report` runs `buildProjectReport('42')`, stores the result under `acme-app:report:project:42` for 600 seconds and returns it. Every request in the next ten minutes gets the stored copy without touching the database. After a write to project 42, clear the `project:42` tag (see [Clear entries by tag](#clear-entries-by-tag)) and the next request builds a fresh report.

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

`app.container.use('cache')` returns the same object; `useCache` is a shorter, typed spelling. In a background job, the job context carries the app:

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

If the provider is not registered, `useCache` throws `[kitr] No binding named "cache". Did you add the package that provides it?`. Run `kitr add cache`, or check that `() => import('@kitr/cache/provider')` is still in `kitrrc.ts`. The same error appears in browser code, because the provider binds nothing on the client.

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

Four rules decide what `remember()` stores:

| `fn` returns or throws | Stored? | Next call |
| --- | --- | --- |
| A value, including `0`, `''`, `false` and `null` | Yes, for `ttl` seconds | Gets the stored value |
| `undefined` | No | Runs `fn` again |
| Throws or rejects | No; the error reaches every waiting caller | Runs `fn` again |
| Still running when another call arrives with the same key | Once | Waits for the same run |

The last row is the reason to prefer `remember()` over a `get()` then `set()` pair. When a popular entry expires, fifty requests can miss at the same moment. With `get()` and `set()`, all fifty rebuild the report. With `remember()`, the first call runs `fn` and the other forty-nine wait for its result:

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

Sharing a run works inside one server process. Two instances that miss together each run `fn` once.

A failure is not cached, so a database blip does not leave a broken answer in place for ten minutes. Every caller that was waiting on the failed run gets the same error, and the next call tries again:

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

A key names one answer. Put every input that changes the answer into it, from the most general to the most specific:

```ts
// server/reports/keys.ts
export const reportKey = (projectId: string) => `report:project:${projectId}`
export const invoicesKey = (teamId: string, status: 'open' | 'paid', page: number) =>
  `invoices:team:${teamId}:${status}:page:${page}`
export const rateKey = (from: string, to: string) => `rate:${from}:${to}`
```

Keeping keys in one module means the code that reads an entry and the code that deletes it can't drift apart.

Anything that differs per user belongs in the key. Don't cache "my invoices" under `invoices:mine`: the first person to load it, say Ada, would have her invoices served to Grace. Use `invoices:user:${user.id}` instead, or cache the shared part and filter per user after the read.

The `prefix` from `config/cache.ts` is added in front of every key before it reaches the driver. You never write it yourself: `cache.get('rate:USD:EUR')` reads `acme-app:rate:USD:EUR` from the driver.

## Set expiry times

Every entry written through the cache expires. `ttl` is in seconds; without one, the entry gets `defaultTtl` from the config (300 unless you change it):

```ts
// server/rates/refresh.ts
import { useCache } from '@kitr/cache'
import type { KitrApp } from 'kitr/app'
import { fetchRate } from '#server/rates/client'

export async function refreshRates(app: KitrApp) {
  const cache = useCache(app)
  await cache.set('rate:USD:EUR', await fetchRate('USD', 'EUR'), { ttl: 3600 }) // one hour
  await cache.set('rate:USD:GBP', await fetchRate('USD', 'GBP')) // defaultTtl: 300 seconds
}
```

An entry is gone at exactly `ttl` seconds: a `get()` one millisecond before returns the value, a `get()` at the deadline returns `undefined`. The memory driver also sweeps expired entries that nobody reads again, at most once a minute, so a cache full of one-off keys does not grow forever.

Pick the ttl from how stale the answer may be, not from how slow it is to build. A team's invoice count can be two minutes old; an exchange rate for display can be an hour old; a permission check should not be cached at all. When you clear by tag after every write, a long ttl is safe, because the entry is replaced as soon as its data changes.

## Clear entries by tag

Tag an entry with what it is about when you store it. After a write, clear the tag, and every entry about that thing is gone, whatever its key:

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

The report under `report:project:42` and anything else tagged `project:42` are cleared. Entries tagged only `project:43` stay. `invalidateTags()` takes several tags at once and clears an entry that carries any of them:

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

A tag that matches nothing is not an error. With the memory driver, overwriting a key with `set()` drops the old value's tags, so a value written later is never cleared by tags that belonged to the one it replaced. The Redis driver below keeps a key in its old tag sets until those tags are cleared, which can clear a newer value early but never serves a stale one.

Tag by the records a result depends on (`project:42`, `team:design`) and by kind (`reports`, `invoices`). Kind tags let you clear a whole family after a deploy changes how it is built: `invalidateTags('reports')`.

Don't guess keys after a write with a loop of `delete()` calls. Lists, pages and summaries hide under many keys, and the one you forget serves stale data. Clear the tag instead.

## Wrap a function

`cached(cache, fn, options)` turns a function into one that remembers its results. Each distinct argument list gets its own entry, named by `options.key`:

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

The wrapped function has the same arguments and returns a promise of the same result. It follows every `remember()` rule: one run for concurrent callers, `undefined` and errors not stored. Use `cached()` when a function is called from many places; use `remember()` inline when it is called from one.

Entries live in the driver, not in the wrapper, so building the wrapper per request costs nothing and every request shares the stored rates. Don't call `useCache(server.app)` at module level: the module loads before the server boots, and the provider has not bound `cache` yet.

## Read and write entries directly

The cache also works as a typed key-value store. Values go in and come out as JSON:

```ts
// server/teams/budget.ts
import { useCache } from '@kitr/cache'
import type { KitrApp } from 'kitr/app'

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

`get()` returns `undefined` for a miss and the stored value otherwise, so a stored `0`, `false` or `null` comes back as itself. Use `has()` when you need to know whether a key exists without reading it.

## Store values that survive JSON

Every value passes through `JSON.stringify` on the way in and `JSON.parse` on the way out. Plain objects, arrays, strings, numbers, booleans and `null` round-trip exactly. Other types change shape:

```ts
// server/orders/last_order.ts
import { useCache } from '@kitr/cache'
import type { KitrApp } from 'kitr/app'

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

Convert on the way out when you need the richer type: `new Date(order.placedAt)`. Or cache the plain data and build the object after the read.

## Drivers

A driver decides where entries live. The cache talks to it through six methods over strings, so swapping drivers changes nothing else in your code.

| Driver | Shared between instances | Survives a restart | Use for |
| --- | --- | --- | --- |
| Memory (default) | No | No | Development, tests, one server process |
| unstorage (built in) | Yes | Yes | Production: Redis, Upstash, Cloudflare KV, Vercel KV or the filesystem |
| Redis (built in) | Yes | Yes | Production with a Redis server: native expiry, tag sets, a `clear()` that stays inside its prefix |

### Memory

The default. Nothing to install and no config: leave `driver` out of `config/cache.ts`. To pass it explicitly, for example to share one memory driver between two caches in a script:

```ts
// config/cache.ts
import { createMemoryCacheDriver, defineConfig } from '@kitr/cache'

export default defineConfig({
  driver: createMemoryCacheDriver(),
  prefix: 'acme-app:',
  defaultTtl: 300,
})
```

Each server process has its own copy, and it empties when the process restarts. Once you run two instances behind a load balancer, `invalidateTags()` on one instance leaves the other serving the old value until its ttl runs out. Move to a shared store before that happens.

### unstorage

`createUnstorageCacheDriver` stores entries through any [unstorage](https://unstorage.unjs.io) instance, so one line picks the backend from unstorage's [drivers](https://unstorage.unjs.io/drivers): Redis, Upstash, Cloudflare KV, Vercel KV, the filesystem and more. Install unstorage and the client its driver needs:

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

Expiry is checked on every read, so drivers without native expiry work too; the ttl is also passed to drivers that expire keys themselves, such as Redis. Entries live under the `kitr-cache` base (pass `{ base: 'other' }` as the second argument to change it), and `clear()` only removes keys under that base. Like the memory driver, overwriting a key drops the old value's tags.

### Redis

`createRedisCacheDriver` talks to Redis directly: Redis expires entries itself, tags are Redis sets, and every instance reads and clears the same entries. Install a Redis client. The driver takes an [ioredis](https://github.com/redis/ioredis) client:

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

When Grace's invoice report is cached on instance A with `tags: ['team:team_acme']`, the entry lands at `kitr:cache:e:acme-app:report:invoices`. Instance B reads the same key, and `invalidateTags('team:team_acme')` on either instance removes it for both. As with the memory driver, setting a key again drops the old value's tags, so a stale tag never removes a fresh value.

`clear()` scans for keys under `base` and deletes them, so it never touches sessions, queues or anything else in the same Redis. On a large cache it is a slow scan; prefer tags for routine invalidation. See the [ioredis docs](https://github.com/redis/ioredis#readme) for TLS, clusters and Sentinel.

The cache passes tag names to the driver with the prefix in front, as it does keys, so two apps that share one Redis and use the same tag name keep their entries apart.

## Use the cache in production

- **More than one instance needs a shared driver.** With the memory driver, each instance has its own entries, and a tag cleared on one instance stays on the others. Use the [Redis](#redis) or [unstorage](#unstorage) driver.
- **`remember()` shares one run per instance, not per cluster.** Ten concurrent misses on one instance run `fn` once; the same miss on three instances at once runs it three times. For a very slow `fn`, warm the entry from a [job](/packages/jobs) instead of on the first request.
- **The memory driver empties on deploy.** The first requests after a restart all miss. Warm the slowest entries from a job (see [Get the cache on the server](#get-the-cache-on-the-server)) if a cold start hurts.
- **A cache is not a store.** Anything in it can vanish at any time: a restart, an eviction, a `clear()`. Never keep the only copy of data in the cache.
- **Driver errors are not caught.** If Redis is down, `get()`, `set()` and `remember()` reject with the driver's error. Catch it in the caller when the page should still load without the cache.

## Testing

`createCache()` builds a cache with the memory driver and no app, which is all most tests need. Vitest's fake timers move the clock past a ttl without waiting:

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

`createTestApp` boots the app with `environment: 'test'`, which the cache provider treats like the server. Only `environment: 'client'` makes it bind nothing. Each `createCache()` and each test app gets its own memory driver, so tests never see each other's entries.

## Extend

A driver is an object that implements `CacheDriver`: a `name` and six async methods over string keys and string values. The cache has already added the prefix to every key and serialised every value to JSON by the time the driver sees it.

| Member | Called by | Must |
| --- | --- | --- |
| `name` | devtools | Name the driver, e.g. `redis`. |
| `get(key)` | `get`, `has`, `remember` | Return the string, or `undefined` when missing or expired. |
| `set(key, value, ttl)` | `set`, `remember` | Store the string; expire it after `ttl` seconds (`undefined` means never). |
| `delete(key)` | `delete` | Remove the key. |
| `tag(key, tags)` | `set` with `tags` | Record that `key` carries each tag. |
| `invalidateTags(tags)` | `invalidateTags` | Remove every key that carries any of `tags`. |
| `clear()` | `clear` | Remove everything the driver holds. |

`createRedisCacheDriver` in the source is a complete example over Redis. Drivers also compose. This one wraps another driver and counts hits and misses, which helps tune ttls:

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

`cacheStats.stats` now reads `{ hits: 41, misses: 3 }` after a busy minute. See [`CacheDriver`](/packages/cache/api#cachedriver) in the API reference for the exact signatures.

## Devtools

When the [devtools](/packages/devtools) package is installed, the cache provider logs the driver it booted with to the `cache` channel at start-up, for example `driver: memory`. That line is the quickest way to confirm that production picked up the Redis driver.

## Next steps

- [API reference](/packages/cache/api): every export with its signature.
- [Query](/packages/query): cache API responses in the browser.
- [Jobs](/packages/jobs): warm slow entries on a schedule.
- [Server](/packages/server): the runtime the cache provider binds into.
- [ioredis](https://github.com/redis/ioredis): the Redis client the Redis driver takes.
- [Run on more than one instance](/guides/scale-out): the cache, queue, limits and sockets on shared Redis.
