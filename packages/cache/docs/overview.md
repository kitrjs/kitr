---
title: Overview
description: Remember slow results on the server and clear them by tag when the data changes.
order: 0
---

# Cache

Some reads are slow or expensive: a report that joins six tables, a call to a rate-limited exchange-rate API, a PDF summary rendered from a template. Caching them is easy; keeping the cache correct is not. Keys get invented per call site, nobody knows which ones to clear when an order changes, and fifty requests arriving at once all miss and all run the slow query.

`@kitr/cache` keeps results for a while, clears them by tag, and runs slow work once however many requests ask.

## What it is

`@kitr/cache` is a server-side cache with a small API: `get`, `set`, `remember`, `cached` and `invalidateTags`. Values are stored as JSON under a key prefix, with an expiry time and any number of tags. `remember()` returns a cached value or computes it once and stores it, deduplicating concurrent callers. When data changes, `invalidateTags(['orders'])` removes every entry about orders without anyone listing keys.

It runs on the server only. The provider does nothing in the browser. To cache what the API returns on the client, use [query](/packages/query), which already does.

## Built on

The package is a small layer of its own rather than a wrapper around one store. Storage goes through a six-method driver:

| Driver | Built on | Use it for |
| --- | --- | --- |
| Memory | A `Map` in the server process | Development, tests and single-process servers. |
| unstorage | [unstorage](https://unstorage.unjs.io) | Redis, Upstash, Cloudflare KV, Vercel KV and every other unstorage driver. |
| Your own | The `CacheDriver` interface | Anything with get, set, delete and keys. |

On top of a plain key-value store kitr adds expiry, tags, the key prefix, `remember()` with request coalescing, serialization for `Date`, `Map` and `Set`, and a devtools panel.

## Problems it solves

- **Slow reads on every request.** `remember()` keeps a result for the time you choose and serves it from memory or Redis. See [Remember a result](/packages/cache/guide#remember-a-result).
- **Cache stampedes.** When many requests miss at the same moment, one computes the value and the rest wait for it. See [Remember a result](/packages/cache/guide#remember-a-result).
- **Not knowing what to clear.** Tag entries when you write them and clear by tag when the data changes. See [Clear entries by tag](/packages/cache/guide#clear-entries-by-tag).
- **Caching logic tangled with business logic.** `cached()` turns any async function into a cached one with a key built from its arguments. See [Wrap a function](/packages/cache/guide#wrap-a-function).
- **Values JSON cannot represent.** Dates, maps and sets round-trip through the cache intact. See [Store values that survive JSON](/packages/cache/guide#store-values-that-survive-json).
- **A cache that disappears across servers.** Switch to the unstorage driver and every instance shares Redis. See [Use the cache in production](/packages/cache/guide#use-the-cache-in-production).

## Further reading

- [Guide](/packages/cache/guide): install, configure and every task.
- [API reference](/packages/cache/api): every export with its signature.
- [unstorage](https://unstorage.unjs.io): the drivers available for production.
- [ioredis](https://github.com/redis/ioredis): the Redis client the guide's driver uses.
- [Query](/packages/query): cache API responses in the browser.
- [Jobs](/packages/jobs): warm slow entries on a schedule.
