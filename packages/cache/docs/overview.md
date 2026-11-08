---
title: Overview
description: Remember slow results on the server and clear them by tag when the data changes.
order: 0
---

# Cache

## What it is

`@kitr/cache` is a server-side cache: `get`, `set`, `remember`, `cached` and `invalidateTags`. `remember()` computes a value once and stores it; `invalidateTags(['orders'])` clears everything about orders.

Runs on the server only. For caching in the browser, [query](/packages/query) already does it.

## Install

```sh
kitr add cache
```

Adds `@kitr/cache`, its provider and `config/cache.ts` with the memory driver. Needs [server](/packages/server). [Every change](/packages/cache/guide#install).

## Quick start

On the server, wrap a slow read in `remember()`. This controller builds a project report once every ten minutes:

```ts
// server/controllers/reports_controller.ts
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

The first request builds the report and stores it for ten minutes. Every request in that window gets the copy, and concurrent requests build it once. Next in the guide: [Cache your first slow read](/packages/cache/guide#cache-your-first-slow-read).

## Built on

Storage goes through a six-method driver:

| Driver | Built on | Use it for |
| --- | --- | --- |
| Memory | A `Map` in the server process | Development, tests and single-process servers. |
| unstorage | [unstorage](https://unstorage.unjs.io) | Redis, Upstash, Cloudflare KV, Vercel KV and every other unstorage driver. |
| Your own | The `CacheDriver` interface | Anything with get, set, delete and keys. |

kitr adds expiry, tags, the key prefix, `remember()` with request coalescing, serialization for `Date`, `Map` and `Set`, and a devtools panel.

## Problems it solves

- **Slow reads on every request.** [Remember a result](/packages/cache/guide#remember-a-result).
- **Cache stampedes.** [Remember a result](/packages/cache/guide#remember-a-result).
- **Not knowing what to clear.** [Clear entries by tag](/packages/cache/guide#clear-entries-by-tag).
- **Caching logic tangled with business logic.** [Wrap a function](/packages/cache/guide#wrap-a-function).
- **Values JSON cannot represent.** [Store values that survive JSON](/packages/cache/guide#store-values-that-survive-json).
- **A cache that disappears across servers.** [Use the cache in production](/packages/cache/guide#use-the-cache-in-production).

## Further reading

- [Guide](/packages/cache/guide).
- [API reference](/packages/cache/api).
- [unstorage](https://unstorage.unjs.io).
- [ioredis](https://github.com/redis/ioredis).
- [Query](/packages/query).
- [Jobs](/packages/jobs).
