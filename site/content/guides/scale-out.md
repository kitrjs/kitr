---
title: Run on more than one instance
description: Put every piece of state a kitr app keeps in memory into Redis and object storage, so two or twenty instances behind a load balancer behave like one.
packages: server, realtime, cache, shield, api, jobs, uploads
platforms: server, web
time: 40 min
preview: true
---

# Run on more than one instance

> **Preview**
> The background jobs (`@kitr/jobs`) and file uploads (`@kitr/uploads`) steps use packages that are not published to npm yet. Try them from a kitr checkout with `KITR_PREVIEW=1`; every other step uses released packages.

One instance is the right way to start, and a kitr app runs on one without any of this. The day you add a second, for uptime during deploys or for load, everything a package kept in the memory of its process starts to disagree: Ada's live update reaches only the clients on her instance, a rate limit lets a client through three times, a cached report cleared on one instance is still served by the other, a nightly job runs once per instance, and an upload saved to one disk is a 404 on the next request.

This guide takes `acme-projects`, the app from [Build a full-stack app](/guides/fullstack-app) deployed in [Deploy to production](/guides/deploy), and moves each of those into shared storage: [Redis](https://redis.io) for events, cache entries, counters and the job queue, and an S3-compatible bucket for files. Each package keeps its in-memory default for development, so `kitr dev` still needs nothing but Node. At the end, two instances run side by side on your machine and you watch an event cross from one to the other.

## Before you start

You need `acme-projects` building and starting with `pnpm kitr start site`, as at the end of [Deploy to production](/guides/deploy). You need a Redis server. With Docker, this starts one:

```sh
docker run -d --name acme-redis -p 6379:6379 redis:7
```

Managed Redis works the same way: Upstash, Redis Cloud, ElastiCache, Fly's or Railway's Redis. Copy its connection string; a `rediss://` URL turns on TLS.

kitr's Redis adapters take an [ioredis](https://github.com/redis/ioredis) client, which you install once:

```sh
pnpm add ioredis
```

Add the connection string to `.env`, and to the environment of every instance in production:

```sh
REDIS_URL=redis://localhost:6379
```

## Find what lives in one process

Every package that keeps state starts with a store in memory, and each has a shared replacement behind the same interface. The code that uses the package does not change, only the option that picks the store:

| Package | In memory by default | Shared replacement | Option |
| --- | --- | --- | --- |
| [Realtime](/packages/realtime) | Which clients watch which topic | `createRedisRealtimeAdapter` | `adapter` on `.ws()` and `.sse()` |
| [Cache](/packages/cache) | Cached entries and their tags | `createRedisCacheDriver` | `driver` in `config/cache.ts` |
| [Shield](/packages/shield) | Rate-limit counters | `createRedisRateLimitStore` | `rateLimit.store` in `config/shield.ts` |
| [API](/packages/api) | Counters of a route's `rateLimit()` | `createRedisRateLimitStore` from `@kitr/shield` | `store` on `rateLimit()` |
| [Jobs](/packages/jobs) | The queue, and which worker runs a schedule | `createRedisJobsDriver` | `driver` in `config/jobs.ts` |
| [Uploads](/packages/uploads) | Files on this machine's disk | `createUnstorageUploadsDriver` | `driver` in `config/uploads.ts` |

Sessions need nothing: a signed cookie or a database session reads the same on any instance. The database is already shared. Logs and error reports leave the process as they are written.

## Connect to Redis once

Every adapter takes a client you create, so the app opens one connection and shares it. Put it in its own module:

```ts
// server/redis.ts
import { Redis } from 'ioredis'

/** The app's one Redis connection, shared by the cache, rate limits, jobs and realtime. */
export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  // Fail a command after one retry instead of queueing it while Redis is down.
  maxRetriesPerRequest: 1,
})
```

The realtime adapter also needs a connection in subscriber mode, which can run no other command; it opens that one itself with `redis.duplicate()`. Everything else shares `redis`. ioredis pipelines commands over one connection, so a single client handles a busy instance.

Close the connection when the server stops, so a deploy does not cut a command in half. A provider's `shutdown` runs after in-flight requests have finished:

```ts
// server/providers/redis_provider.ts
import { defineProvider } from 'kitr'
import { redis } from '#server/redis'
import { realtimeAdapter } from '#server/realtime_adapter'

export default defineProvider({
  name: 'redis',
  async shutdown() {
    await realtimeAdapter.close?.()
    await redis.quit()
  },
})
```

Add it last to `providers` in `kitrrc.ts`, so every other provider has shut down first.

## Share live updates

Grace's projects page subscribes to `teamProjectsChannel`, and Ada's action emits `created` on it. With two instances, Grace's socket may be on instance A while Ada's request is served by instance B. Create the realtime adapter:

```ts
// server/realtime_adapter.ts
import { createRedisRealtimeAdapter } from '@kitr/realtime/server'
import { redis } from '#server/redis'

export const realtimeAdapter = createRedisRealtimeAdapter(redis, { prefix: 'acme-projects:rt:' })
```

Pass it to the socket link in `server/routes.ts`:

```ts
// server/routes.ts
// ...
import { teamProjectsChannel } from '#app/channels/projects'
import { realtimeAdapter } from '#server/realtime_adapter'

export const routes = defineRoutes([api, realtime], (router) =>
  router.group('/api', (r) =>
    r
      // ...endpoints as before
      .ws('/ws', { channels: [teamProjectsChannel], adapter: realtimeAdapter }),
  ),
)
```

The action that emits stays as it was. On instance B, `emit('created', project)` publishes the event on the Redis channel `acme-projects:rt:projects:{"teamId":"team_acme"}`. Instance A subscribed to that channel when Grace's socket subscribed to the topic, so it receives the event and writes it to her socket. Each instance subscribes only to the topics its own clients watch, and drops a subscription when the last of them leaves.

A WebSocket stays on the instance it opened on, so the load balancer needs no sticky sessions. The SSE transport does not either: a control `POST` that lands on another instance than its stream is forwarded through Redis. `use(channel, params).size` and `connections` still count this instance only. [Realtime](/packages/realtime#run-more-than-one-server-instance) has the details.

## Share the cache

A cached report on instance A is a miss on instance B, and `invalidateTags()` on B leaves A serving the stale entry. Point the cache at Redis:

```ts
// config/cache.ts
import { createRedisCacheDriver, defineConfig } from '@kitr/cache'
import { redis } from '#server/redis'

export default defineConfig({
  driver: createRedisCacheDriver(redis),
  prefix: 'acme-projects:',
  defaultTtl: 300,
})
```

Every `remember()`, `get()` and `invalidateTags()` now reads and writes the same entries. Redis expires them itself. `clear()` deletes only keys under the driver's base (`kitr:cache:` by default), never the whole Redis, so the queue and the counters sharing it are safe.

`remember()` still shares one run of a slow function per instance, not per cluster: a cold miss on three instances at once runs it three times. For a report that takes seconds, warm it from a scheduled job instead of on the first request.

In development, keep the memory driver by choosing on the environment:

```ts
// config/cache.ts
import { createMemoryCacheDriver, createRedisCacheDriver, defineConfig } from '@kitr/cache'
import { redis } from '#server/redis'

export default defineConfig({
  driver: process.env.REDIS_URL ? createRedisCacheDriver(redis) : createMemoryCacheDriver(),
  prefix: 'acme-projects:',
})
```

## Share rate limits

With three instances, each counts on its own, so a client gets three times the limit, and a deploy resets every counter. Give the shield a Redis store, and trust the load balancer's `X-Forwarded-For` so each visitor gets their own counter:

```ts
// config/shield.ts
import { createRedisRateLimitStore, defineConfig } from '@kitr/shield'
import { redis } from '#server/redis'

export default defineConfig({
  headers: {},
  rateLimit: {
    max: 300,
    windowMs: 60_000,
    trustProxy: true,
    store: createRedisRateLimitStore(redis, { prefix: 'acme-projects:rl:' }),
  },
  csrf: { ignore: ['/webhooks'] },
})
```

Each window is one Redis key that expires with the window. A `rateLimit()` on a single route in `server/routes.ts` takes the same store as its `store` option. Only set `trustProxy` when every request passes through a proxy you control; [Shield](/packages/shield#run-behind-a-proxy) explains why.

## Share the job queue

With the memory driver, a job dispatched on instance A runs on A or not at all, a restart loses the queue, and a `schedule: '0 3 * * *'` job runs once per instance. Move the queue to Redis:

```ts
// config/jobs.ts
import { createRedisJobsDriver, defineConfig } from '@kitr/jobs'
import { redis } from '#server/redis'
import { generateInvoice } from '#server/jobs/generate_invoice'
import { pruneSessions } from '#server/jobs/prune_sessions'

export default defineConfig({
  jobs: [generateInvoice, pruneSessions],
  driver: createRedisJobsDriver(redis, { prefix: 'acme-projects:jobs:', visibilityTimeout: 10 * 60_000 }),
})
```

Every instance's worker now pulls from one queue, and each job runs on exactly one of them. A worker that dies mid-job leaves the job reserved; after `visibilityTimeout` it goes back to the queue and another worker runs it, so keep the timeout above your longest job. Scheduled jobs queue once per run: before queuing `prune_sessions` at 03:00, each worker takes a Redis lock named after the job and the minute, and only the one that gets it queues the run. Give every instance the same `TZ`, because cron reads local time.

To keep jobs off the web instances, run separate workers with `kitr jobs:work` and set `worker: false` on the web servers; [Jobs](/packages/jobs#run-the-worker-in-its-own-process) shows both.

## Store uploads in a bucket

The disk driver writes to `storage/uploads` on the instance that received the file, so the next request for it on another instance is a 404, and a container restart deletes it. Store files in an S3-compatible bucket through [unstorage](https://unstorage.unjs.io) instead:

```sh
pnpm add unstorage
```

```ts
// config/uploads.ts
import { defineConfig } from '@kitr/uploads'
import { createUnstorageUploadsDriver } from '@kitr/uploads/server'
import { createStorage } from 'unstorage'
import s3Driver from 'unstorage/drivers/s3'

const bucket = createStorage({
  driver: s3Driver({
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    endpoint: process.env.S3_ENDPOINT!,
    bucket: 'acme-projects-uploads',
    region: 'auto',
  }),
})

export default defineConfig({
  driver: createUnstorageUploadsDriver(bucket, { publicPath: '/api/uploads' }),
  maxSize: 10 * 1024 * 1024,
})
```

Cloudflare R2, AWS S3, MinIO and any other S3-compatible service work with the same driver. Files are still served through `/api/uploads/:key`, so the bucket stays private.

## Run two instances side by side

Build once, then start two instances on different ports against the same Redis:

```sh
pnpm kitr build
KITR_SITE_PORT=3000 pnpm kitr start site &
KITR_SITE_PORT=3001 pnpm kitr start site &
```

Open `http://localhost:3000/projects` in one browser window as Grace and `http://localhost:3001/projects` in another as Ada, and create "Apollo launch" in Ada's window.

Grace's list shows "Apollo launch" without a reload, although her socket is on port 3000 and Ada's form was served by 3001. Watch the event pass through Redis while you do it:

```sh
docker exec -it acme-redis redis-cli PSUBSCRIBE 'acme-projects:rt:*'
```

```txt
1) "pmessage"
2) "acme-projects:rt:*"
3) "acme-projects:rt:projects:{\"teamId\":\"team_acme\"}"
4) "{\"t\":\"ev\",\"ch\":\"projects\",\"p\":{\"teamId\":\"team_acme\"},\"ev\":\"created\",\"d\":{...}}"
```

In production, put the instances behind your host's load balancer. Fly.io, Railway, Render and Cloud Run scale a service by instance count; Kubernetes by replicas. Point the health check at `/healthz`, which `config/server.ts` serves, so an instance only gets traffic once it is up.

## Plan for Redis going down

Redis is now part of the app. What each package does when it cannot reach it:

| Package | When Redis is unreachable |
| --- | --- |
| Realtime | `emit()` does not throw; the adapter's `onError` logs the failed publish, and clients miss that event. A subscribe answers once Redis is back. |
| Cache | `get()`, `set()` and `remember()` reject with the client's error. Catch it where the page should load without the cache. |
| Shield and API rate limits | The request fails with a 500, because the limit cannot be checked. |
| Jobs | `dispatch()` rejects; the worker logs `[jobs] worker poll failed` and keeps polling until Redis returns. |

Use a managed Redis with a replica and automatic failover for production, and keep `maxRetriesPerRequest` low so requests fail fast instead of hanging while it fails over. Separate Redis databases or prefixes keep apps that share one Redis apart: every adapter takes a `prefix` or `base`.

## Next steps

- [Realtime](/packages/realtime#run-more-than-one-server-instance): the adapter, SSE forwarding and writing your own adapter.
- [Cache](/packages/cache#redis), [Shield](/packages/shield#share-rate-limits-between-instances) and [Jobs](/packages/jobs#share-the-queue-between-processes): each driver's options.
- [Deploy to production](/guides/deploy): the Docker image and hosts these instances run on.
- [Uploads](/packages/uploads#unstorage): the unstorage driver and its options.
- [ioredis](https://github.com/redis/ioredis#readme): TLS, Sentinel and Cluster connections.
