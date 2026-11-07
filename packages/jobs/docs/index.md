---
title: Jobs
description: Run work in the background or on a schedule, with retries when it fails.
order: 1
---

# Jobs

Typed background jobs. Define one, dispatch it from a controller or action, and a worker runs it with retries and backoff. Schedules use cron or an interval.

## Install

```sh
kitr add jobs
kitr make:job send-welcome
```

The provider binds `jobs`, starts the worker when the server is ready and drains it on shutdown. `config/jobs.ts` picks the queue driver, the concurrency and the poll interval.

## Define and dispatch

```ts
// server/jobs/send_welcome.ts
import { defineJob } from 'kitr/jobs'
import { z } from 'zod'

export const sendWelcome = defineJob('send-welcome', {
  schema: z.object({ userId: z.string() }),
  retries: 3,
  backoff: 2000,
  async run({ userId }, { app, attempt, signal }) {
    await app.container.use('mailer').send(welcome, { userId }, { to: user.email })
  },
})

// in a controller
await useJobs(ctx.app).dispatch(sendWelcome, { userId }, { delay: 5000 })
```

List the jobs the worker should know in `config/jobs.ts` (`jobs: [sendWelcome, cleanup]`), or call `jobs.register(...)`; a job dispatched by object is registered on the fly.

## Schedules

```ts
defineJob('cleanup', { schedule: '0 3 * * *', run: () => prune() })      // cron, 5 fields
defineJob('heartbeat', { schedule: { every: '5m' }, run: () => ping() })
```

## Drivers

The memory driver loses the queue on restart. A driver for Redis or a table implements `push`, `pull(now, limit)`, `size` and `clear`. Set `worker: false` on the web servers and run `jobs.start()` in a dedicated worker process when the queue is shared.
