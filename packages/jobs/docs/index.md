---
title: Jobs
description: Run work in the background or on a schedule, with retries when it fails.
order: 1
---

# Jobs

Some work shouldn't keep a request waiting: sending a welcome email, resizing an upload, syncing with a payment provider, cleaning up old sessions at 3am. `kitr/jobs` lets you hand that work to a background worker. It retries with backoff when something fails, gives up after a limit you set, and runs scheduled work on cron or an interval.

## Install

```sh
kitr add jobs
```

This writes `config/jobs.ts` and an example job in `server/jobs/example.ts`, and registers the provider. The worker starts when the server starts and finishes running jobs before it shuts down.

`kitr make:job send-welcome` writes a new job in `server/jobs/send_welcome.ts`.

## Define a job

```ts
// server/jobs/send_welcome.ts
import { defineJob } from 'kitr/jobs'
import { useMailer } from 'kitr/mail'
import { z } from 'zod'
import { welcome } from '#server/mail/welcome'

export const sendWelcome = defineJob('send-welcome', {
  schema: z.object({ userId: z.string() }),
  retries: 3,
  backoff: 2000,
  async run({ userId }, { app, attempt, signal }) {
    const user = await findUser(userId, { signal })
    await useMailer(app).send(welcome, { name: user.name }, { to: user.email })
  },
})
```

| Option | Default | Description |
| --- | --- | --- |
| `schema` | none | A zod or valibot schema. The payload is checked when you dispatch and again when the worker picks it up. |
| `retries` | `3` | How many times to retry after a failure. |
| `backoff` | `1000` | Milliseconds before the first retry. It doubles each time: 1s, 2s, 4s. |
| `timeout` | `60000` | Milliseconds a run may take. After that its `signal` aborts and the run counts as failed. |
| `schedule` | none | Run on a schedule. See [Schedules](#schedules). |
| `run(payload, ctx)` | required | The work. `ctx` has `app`, `attempt` (1 on the first run), `jobId` and `signal`. |

Then list it in `config/jobs.ts`, so the worker knows its name:

```ts
// config/jobs.ts
import { defineConfig } from 'kitr/jobs'
import { sendWelcome } from '#server/jobs/send_welcome'

export default defineConfig({
  jobs: [sendWelcome],
  concurrency: 5,
})
```

## Dispatch

From a controller, an action or another job:

```ts
import { useJobs } from 'kitr/jobs'

await useJobs(ctx.app).dispatch(sendWelcome, { userId: user.id })

// later
await useJobs(ctx.app).dispatch(sendWelcome, { userId }, { delay: 10 * 60_000 })
await useJobs(ctx.app).dispatch(sendReport, { teamId }, { at: new Date('2026-12-01T09:00:00Z') })
```

`dispatch` returns the job id straight away. The payload is typed from the schema, so a missing field is a type error, and a wrong value fails right there instead of in the worker.

## Schedules

```ts
// Every day at 03:00 (minute hour day month weekday)
export const pruneSessions = defineJob('prune-sessions', {
  schedule: '0 3 * * *',
  run: () => db.sessions.deleteExpired(),
})

// Every five minutes
export const syncInvoices = defineJob('sync-invoices', {
  schedule: { every: '5m' },
  run: () => billing.sync(),
})
```

Cron expressions have five fields and support `*`, lists (`1,15`), ranges (`1-5`) and steps (`*/10`). Intervals take `ms`, `s`, `m`, `h` and `d`. A bad expression throws when the job is registered, not at 3am. A scheduled job has to be listed in `config/jobs.ts`.

## When a job keeps failing

After its last retry, the job is logged as failed and `onFailed` runs. That's the place to alert someone:

```ts
export default defineConfig({
  jobs: [sendWelcome, pruneSessions],
  onFailed: (job, error) => monitoring.captureException(error, { extra: { job: job.name } }),
})
```

A payload that fails its schema isn't retried, since it would fail every time.

## Running in production

| Option | Default | Description |
| --- | --- | --- |
| `jobs` | `[]` | Every job the worker can run. |
| `driver` | memory | Where queued jobs wait. |
| `concurrency` | `5` | Jobs run at once in each process. |
| `pollInterval` | `500` | Milliseconds between checks for due jobs. |
| `worker` | `true` | Start the worker with the server. |
| `onFailed(job, error)` | none | Called when a job has used up its retries. |

The memory driver keeps the queue inside the server process, so queued jobs are lost on restart and each instance has its own queue. That's fine for one server. For more, give the queue a shared driver. A driver has four methods, `push`, `pull(now, limit)`, `size` and `clear`, so a Redis list or a database table takes a few lines.

With a shared queue you can also run the worker separately: set `worker: false` on the web servers, and start a worker process that boots the app and calls `useJobs(app).start()`.

## Tests

`jobs.run(job, payload)` runs a job right away in the test, with its retries, and returns its result or throws its last error:

```ts
await useJobs(app).run(sendWelcome, { userId: 'u1' })
```
