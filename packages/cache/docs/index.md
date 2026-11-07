---
title: Cache
description: Remember slow results on the server and clear them by tag when the data changes.
order: 1
---

# Cache

A server cache with TTLs and tags. The memory driver is the default; a Redis or database driver is a small object with six methods.

## Install

```sh
kitr add cache
```

`config/cache.ts` sets the driver, a key prefix and the default TTL. The provider binds `cache` in the container, so controllers and actions reach it as `useCache(app)`.

## Remember

```ts
import { useCache } from 'kitr/cache'

const cache = useCache(app)
const projects = await cache.remember('projects:list', () => db.projects.findMany(), {
  ttl: 60,
  tags: ['projects'],
})

// After a write:
await cache.invalidateTags('projects')
```

Concurrent `remember()` calls for the same key share one computation. `cached(cache, fn, { key })` wraps a function so every argument list gets its own entry.

## Drivers

```ts
import { createMemoryCacheDriver, defineConfig } from 'kitr/cache'

export default defineConfig({ driver: createMemoryCacheDriver(), prefix: 'app:', defaultTtl: 300 })
```

A driver implements `get`, `set(key, value, ttl)`, `delete`, `tag`, `invalidateTags` and `clear` over strings; the cache handles JSON.
