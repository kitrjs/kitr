---
title: Jobs
description: Run work in the background or on a schedule, with retries when it fails.
order: 1
---

# Jobs

Some work should not keep a request waiting: emailing an invoice, generating a PDF, syncing orders, pruning expired sessions at 3am. `@kitr/jobs` hands that work to a background worker. You define a job with a typed payload, dispatch it from a controller, and the worker runs it with retries, backoff, a timeout and an optional schedule.

> [!SUMMARY]
> Background and scheduled jobs with typed payloads, retries and timeouts. Add it with `kitr add jobs`; the overview is at [/packages/jobs](/packages/jobs).

It runs on the server only. The built-in queue lives in memory, which suits one process; for several servers, or jobs that must survive a restart, use a shared driver ([Share the queue between processes](#share-the-queue-between-processes)). Work that must finish before the response, such as charging a card, should be called directly.

The examples follow Acme's app at `app.acme.com`, which generates a monthly invoice for each team, emails it, and cleans up old data every night.

## Install

```sh
kitr add jobs
```

<details>
<summary>Everything kitr add changes</summary>

What `kitr add` does, in order:

- Installs `@kitr/jobs`. Jobs require the [server](/packages/server) package, so `kitr add` also adds `server` (and its `logger`) when the project does not have them yet.
- Adds `'@kitr/jobs'` to `packages` and `() => import('@kitr/jobs/provider')` to `providers` in `kitrrc.ts`.
- Writes `config/jobs.ts` (shown in [Configure](#configure)) and regenerates `config/index.ts`.
- Writes an example job, `server/jobs/example.ts`, exporting `exampleJob`.
- When you answer no to the worker question, adds a `worker` script (`kitr jobs:work`) to `package.json`.
- Adds a `## kitr: jobs` section to `AGENTS.md` telling coding agents to put background work in `server/jobs/` and never `setTimeout` work in a request, plus a line about the separate worker when there is one.

No kit includes jobs; add it to any kit with a server platform.

`kitr remove jobs` reverses every step above. Your jobs in `server/jobs/` stay, because you may have edited them.

</details>

`kitr add jobs` asks one question. Agents and CI answer it with a flag:

| Question | Default | Flag |
| --- | --- | --- |
| Run the job worker inside the server process? | yes | `--worker` / `--no-worker` |

```sh
kitr add jobs --no-worker
```

With `--no-worker`, `config/jobs.ts` gets `worker: false` and the worker runs in its own process, as in [Run the worker in its own process](#run-the-worker-in-its-own-process).

## Configure

`kitr add jobs` writes this file:

```ts
// config/jobs.ts
import { defineConfig } from '@kitr/jobs'
import { exampleJob } from '#server/jobs/example'

export default defineConfig({
  // Every job the worker runs (kitr make:job <name> writes one in server/jobs/).
  jobs: [exampleJob],
  // In-memory queue by default: fine for one process. For several, pass a shared driver.
  concurrency: 5,
  worker: true, // false when a separate worker process runs the jobs
})
```

| Option | Default | Description |
| --- | --- | --- |
| `jobs` | `[]` | Every job the worker can run. A queued job not listed here is dropped with a warning. |
| `driver` | the memory driver | Where queued jobs wait. `createRedisJobsDriver(redis)` shares the queue between processes; see [Share the queue between processes](#share-the-queue-between-processes) and [Extend](#extend). |
| `concurrency` | `5` | How many jobs run at once in each process. |
| `pollInterval` | `500` | Milliseconds between checks of the queue. |
| `worker` | `true` | Start the worker when the server starts. `false` when a separate process runs jobs. |
| `onFailed(job, error)` | none | Called when a job has used up its retries, or its payload fails the schema. Receives the `QueuedJob` and the last error. |

Per-job options (`retries`, `backoff`, `timeout`, `schedule`) live on the job itself; see [Define a job](#define-a-job).

## Dispatch your first job

Generate a job:

```sh
kitr make:job generate-invoice
```

That writes `server/jobs/generate-invoice.ts`. Edit it to build a team's invoice for a month:

```ts
// server/jobs/generate-invoice.ts
import { defineJob } from '@kitr/jobs'
import { z } from 'zod'

export const generateInvoiceInput = z.object({
  teamId: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
})

export const generateInvoice = defineJob('generate_invoice', {
  schema: generateInvoiceInput,
  retries: 3,
  async run({ teamId, month }, { attempt }) {
    // Load the team's usage, render the PDF, store it under storage/invoices/.
    return { invoiceNumber: `INV-${month}-${teamId}`, attempt }
  },
})
```

List it in `config/jobs.ts`, next to the example:

```ts
// config/jobs.ts
import { defineConfig } from '@kitr/jobs'
import { exampleJob } from '#server/jobs/example'
import { generateInvoice } from '#server/jobs/generate_invoice'

export default defineConfig({
  jobs: [exampleJob, generateInvoice],
  concurrency: 5,
  worker: true,
})
```

Dispatch it from a controller. `dispatch()` checks the payload, queues the job and resolves with its id straight away:

```ts
// server/controllers/invoices-controller.ts
import type { HttpContext } from '@kitr/api'
import { useJobs } from '@kitr/jobs'
import { generateInvoice } from '#server/jobs/generate_invoice'

export default class InvoicesController {
  async store({ app, params, response }: HttpContext<{ teamId: string }>) {
    const jobId = await useJobs(app).dispatch(generateInvoice, {
      teamId: params.teamId,
      month: '2026-10',
    })
    return response.json({ jobId }, { status: 202 })
    // => { "jobId": "3f0c9a52-6b1e-4d7a-9a51-0e2f8c1d7b44" }
  }
}
```

Register the route with `api.post('/teams/:teamId/invoices', [InvoicesController, 'store'])` in `server/routes.ts`. The request answers at once; within half a second (`pollInterval`) the worker picks the job up.

The payload is typed from the schema. A wrong value at run time, such as `month: 'October'`, makes `dispatch()` throw a `VALIDATION` error before anything is queued; in a controller that becomes a 422.

## Define a job

`defineJob(name, options)` returns a job object.

> [!WARNING] Keep job names stable
> The name is how the queue refers to the job. A queued job whose name no longer exists is dropped.

| Option | Default | Description |
| --- | --- | --- |
| `run(payload, ctx)` | required | The work. Its return value is what `jobs.run()` resolves with. |
| `schema` | none | A [Standard Schema](https://standardschema.dev) (zod, valibot, arktype). Checked at dispatch and again when the worker picks the job up. |
| `retries` | `3` | Retries after a failure. `3` means up to 4 attempts in all. |
| `backoff` | `1000` | Milliseconds before the first retry. It doubles each time: 1s, 2s, 4s. |
| `timeout` | `60000` | Milliseconds a run may take. Then its `signal` aborts and the attempt fails. |
| `schedule` | none | A 5-field cron expression or `{ every: '5m' }`. See [Run a job on a schedule](#run-a-job-on-a-schedule). |

The second argument of `run` is the `JobContext`:

| Field | Description |
| --- | --- |
| `app` | The app, for `app.container.use(...)` and `useMailer(app)`. |
| `attempt` | `1` on the first run, one more per retry. |
| `jobId` | The id `dispatch()` returned. Stays the same across retries. |
| `signal` | An `AbortSignal` that aborts at the timeout. Pass it to `fetch` and database calls. |

Without a schema, a type parameter types the payload: `defineJob<{ teamId: string }>('notify_team', { run: ... })`. A job with no payload is dispatched with `undefined`.

## Dispatch a job

On the server, `useJobs(app).dispatch(job, payload, options?)` queues a job and resolves with its id. It works in controllers, actions, services and other jobs:

```ts
// server/jobs/close-month.ts
import { defineJob, useJobs } from '@kitr/jobs'
import { generateInvoice } from '#server/jobs/generate_invoice'

/** Fans out one invoice job per team. */
export const closeMonth = defineJob<{ month: string; teamIds: string[] }>('close_month', {
  async run({ month, teamIds }, { app }) {
    const jobs = useJobs(app)
    const ids = await Promise.all(teamIds.map((teamId) => jobs.dispatch(generateInvoice, { teamId, month })))
    return ids.length
  },
})
```

| Where | How to reach the queue |
| --- | --- |
| A controller | `useJobs(ctx.app)` |
| A job | `useJobs(ctx.app)` in `run(payload, ctx)` |
| An action or service during a request | `useJobs(useRequestApp())`, with `useRequestApp` from `@kitr/server` |
| A script | `useJobs(server.app)` after `await server.boot()` |

`useJobs(app)` is `app.container.use('jobs')`. Pass ids and small plain values in the payload, not whole records; the job loads fresh records when it runs.

> [!WARNING] No setTimeout in handlers
> Work started with `setTimeout` has no retries, nothing waits for it at shutdown, and its errors are lost. Dispatch a job.

## Delay a job

Pass `delay` in milliseconds, or `at` for a fixed time:

```ts
// server/services/trial-service.ts
import type { KitrApp } from 'kitr/app'
import { useJobs } from '@kitr/jobs'
import { generateInvoice } from '#server/jobs/generate_invoice'

export async function scheduleFirstInvoice(app: KitrApp, teamId: string) {
  const jobs = useJobs(app)
  // Ten minutes from now.
  await jobs.dispatch(generateInvoice, { teamId, month: '2026-11' }, { delay: 10 * 60_000 })
  // On the first of next month, 09:00 UTC.
  await jobs.dispatch(
    generateInvoice,
    { teamId, month: '2026-11' },
    { at: new Date('2026-12-01T09:00:00Z') },
  )
}
```

| Option | Description |
| --- | --- |
| `delay` | Milliseconds from now. |
| `at` | A `Date`. Takes precedence over `delay`. A time in the past runs at the next poll. |

With the memory driver a delayed job is lost if the process restarts before it runs.

## Run a job on a schedule

Give a job a `schedule` and list it in `config/jobs.ts`. The worker dispatches it; you never call `dispatch()`:

```ts
// server/jobs/prune-sessions.ts
import { defineJob } from '@kitr/jobs'

/** Every day at 03:00 server time. */
export const pruneSessions = defineJob('prune_sessions', {
  schedule: '0 3 * * *',
  async run(_payload, { app }) {
    app.container.use('logger').info('pruning expired sessions')
  },
})
```

```ts
// server/jobs/sync-orders.ts
import { defineJob } from '@kitr/jobs'

/** Every five minutes, starting when the worker starts. */
export const syncOrders = defineJob('sync_orders', {
  schedule: { every: '5m' },
  timeout: 4 * 60_000,
  async run(_payload, { signal }) {
    const res = await fetch('https://payments.acme.com/orders?since=5m', { signal })
    return res.status
  },
})
```

Cron expressions have five fields, read in the server's local time zone:

| Field | Range | Example |
| --- | --- | --- |
| minute | `0`–`59` | `*/15`: every 15 minutes |
| hour | `0`–`23` | `9-17`: office hours |
| day of month | `1`–`31` | `1`: the first |
| month | `1`–`12` | `1,4,7,10`: each quarter |
| weekday | `0`–`7`, `0` and `7` are Sunday | `1-5`: weekdays |

Each field takes `*`, a number, a list (`1,15`), a range (`1-5`) or a step (`*/10`, `0-30/10`). Names like `MON` are not supported. When both day of month and weekday are set, either may match, as in standard cron.

Intervals take a number and a unit: `250ms`, `30s`, `5m`, `1.5h`, `1d`. An interval job runs once when the worker starts, then every interval after.

> [!WARNING] No schema that rejects undefined
> A scheduled job is dispatched with an `undefined` payload. If its schema rejects that, the worker logs `[jobs] could not queue scheduled <name>` and the job never runs.

A bad expression or interval throws at once, when the app boots. Check new expressions with `cronMatches()`:

```ts
// scripts/check_cron.ts
import { cronMatches, parseInterval } from '@kitr/jobs'

cronMatches('0 3 * * *', new Date(2026, 10, 7, 3, 0)) // => true
cronMatches('*/15 9-17 * * 1-5', new Date(2026, 10, 7, 9, 30)) // => false, a Saturday
parseInterval('5m') // => 300000
```

With the memory driver, each worker queues its own copy, so two servers run `prune_sessions` twice; the [Redis driver](#share-the-queue-between-processes) queues each run once. Cron reads each server's local time, so give every server the same `TZ`.

## Retry a failing job

When `run` throws or times out, the worker queues the job again after `backoff × 2^(attempt - 1)` milliseconds, until it has used its retries:

```ts
// server/jobs/send-invoice-email.ts
import { defineJob } from '@kitr/jobs'
import { useMailer } from '@kitr/mail'
import { z } from 'zod'
import { invoiceReadyMail } from '#server/mail/invoice_ready'

export const sendInvoiceEmail = defineJob('send_invoice_email', {
  schema: z.object({ teamName: z.string(), invoiceNumber: z.string(), email: z.string() }),
  retries: 5,
  backoff: 10_000,
  async run({ teamName, invoiceNumber, email }, { app }) {
    await useMailer(app).send(invoiceReadyMail, { teamName, invoiceNumber, total: '$480.00' }, { to: email })
  },
})
```

A mail outage is retried after 10s, 20s, 40s, 80s and 160s, then given up. The logger shows each step:

```
WARN  09:00:10.112 [app] [jobs] send_invoice_email failed (attempt 1), retry in 10000ms
WARN  09:00:20.140 [app] [jobs] send_invoice_email failed (attempt 2), retry in 20000ms
...
ERROR 09:05:10.301 [app] [jobs] send_invoice_email failed after 6 attempts
```

A payload that fails the schema when the worker picks it up is dropped without a retry and logged as `[jobs] <name> dropped: bad payload`.

> [!WARNING] Make run safe to repeat
> A job that fails after charging a card is retried, and charges again unless you check first.

## Handle a job that keeps failing

`onFailed` in `config/jobs.ts` runs when a job has used its retries or its payload was rejected. Use it to alert someone:

```ts
// config/jobs.ts
import { defineConfig } from '@kitr/jobs'
import { generateInvoice } from '#server/jobs/generate_invoice'
import { sendInvoiceEmail } from '#server/jobs/send_invoice_email'

export default defineConfig({
  jobs: [generateInvoice, sendInvoiceEmail],
  onFailed(job, error) {
    console.error(`job ${job.name} (${job.id}) gave up after ${job.attempt} attempts`, error)
  },
})
```

`job` is the `QueuedJob`:

| Field | Description |
| --- | --- |
| `id` | The id `dispatch()` returned. |
| `name` | The job's name. |
| `payload` | The payload as queued. |
| `attempt` | The attempt that failed last. |
| `runAt` | When that attempt was due, in milliseconds since the epoch. |

`onFailed` has no `app`. To report through [monitoring](/packages/monitoring), catch inside `run` with `ctx.app` and rethrow so the job still retries:

```ts
// server/jobs/generate-invoice.ts
import { defineJob } from '@kitr/jobs'

export const generateInvoice = defineJob<{ teamId: string; month: string }>('generate_invoice', {
  retries: 3,
  async run({ teamId, month }, { app, attempt }) {
    try {
      return { invoiceNumber: `INV-${month}-${teamId}` }
    } catch (error) {
      app.container.use('monitoring').captureException(error, { extra: { teamId, month, attempt } })
      throw error
    }
  },
})
```

## Time out a stuck job

Each attempt gets `timeout` milliseconds (60 seconds by default). At the limit `ctx.signal` aborts and the attempt fails and is retried. Pass the signal to anything that accepts one, so the work really stops:

```ts
// server/jobs/export-projects.ts
import { defineJob } from '@kitr/jobs'

export const exportProjects = defineJob<{ teamId: string }>('export_projects', {
  timeout: 5 * 60_000,
  retries: 1,
  async run({ teamId }, { signal }) {
    const res = await fetch(`https://exports.acme.com/teams/${teamId}`, { method: 'POST', signal })
    if (!res.ok) throw new Error(`export failed: ${res.status}`)
    return res.status
  },
})
```

> [!WARNING] Pass the signal
> A job that ignores its signal still fails at the timeout, but its code keeps running until it finishes on its own.

## Run a job inline

`useJobs(app).run(job, payload)` runs a job now, in this process, with its retries and timeout. Nothing is queued:

```ts
// scripts/backfill_invoices.ts
import { useJobs } from '@kitr/jobs'
import { generateInvoice } from '#server/jobs/generate_invoice'
import { server } from '#server/main'

await server.boot()
const result = await useJobs(server.app).run(generateInvoice, { teamId: 'team_engines', month: '2026-09' })
// => { invoiceNumber: 'INV-2026-09-team_engines', attempt: 1 }
await server.close()
```

When every attempt fails, `run()` throws the last error after the real backoff, and does not call `onFailed`.

## Share the queue between processes

With the memory driver, other servers never see the queue's jobs, and a restart loses them. To share one queue, use `createRedisJobsDriver` with an [ioredis](https://github.com/redis/ioredis) client:

```sh
pnpm add ioredis
```

```ts
// config/jobs.ts
import { createRedisJobsDriver, defineConfig } from '@kitr/jobs'
import { Redis } from 'ioredis'
import { generateInvoice } from '#server/jobs/generate_invoice'
import { pruneSessions } from '#server/jobs/prune_sessions'

export default defineConfig({
  jobs: [generateInvoice, pruneSessions],
  driver: createRedisJobsDriver(new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379'), {
    prefix: 'acme-app:jobs:',
    visibilityTimeout: 10 * 60_000,
  }),
})
```

Add the connection string to `.env`:

```sh
REDIS_URL=redis://localhost:6379
```

| Option | Default | Description |
| --- | --- | --- |
| `prefix` | `'kitr:jobs:'` | Prepended to the driver's keys, so apps sharing a Redis keep separate queues. |
| `visibilityTimeout` | `300000` | Milliseconds a pulled job stays hidden from other workers. Keep it above your longest job `timeout`. |

> [!WARNING] Keep visibilityTimeout above your longest job
> A job not acknowledged within `visibilityTimeout` returns to the queue, so a longer job can run twice.

What the driver guarantees:

- **Each due job runs on one worker.** Twenty invoices dispatched while three workers poll are generated twenty times, not sixty.
- **A crashed worker's jobs come back** after `visibilityTimeout`.
- **Scheduled jobs queue once per run**, through a Redis lock named after the job and the minute.
- **Retries keep their id**, so `onFailed` and your logs see one job.

<details>
<summary>Redis keys</summary>

The queue lives under `<prefix>queue` (a sorted set by `runAt`), `<prefix>reserved` and `<prefix>data`. `jobs.driver.size()` counts waiting and reserved jobs across every process.

</details>

## Run the worker in its own process

By default the worker runs inside the web server, starts with it and drains on shutdown. When long jobs should not compete with requests, run a worker process and turn the worker off in the web servers.

> [!WARNING] Needs a shared queue
> With the memory driver, a job dispatched in a web server never reaches a separate worker.

```ts
// config/jobs.ts
import { createRedisJobsDriver, defineConfig } from '@kitr/jobs'
import { Redis } from 'ioredis'
import { generateInvoice } from '#server/jobs/generate_invoice'
import { pruneSessions } from '#server/jobs/prune_sessions'

export default defineConfig({
  jobs: [generateInvoice, pruneSessions],
  driver: createRedisJobsDriver(new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')),
  // JOBS_WORKER=off on the web servers: they only queue, the worker process runs jobs.
  worker: process.env.JOBS_WORKER !== 'off',
})
```

```ts
// server/worker.ts
import { useJobs } from '@kitr/jobs'
import { server } from '#server/main'

await server.boot()
const jobs = useJobs(server.app)
jobs.start()
server.logger.info('worker started', { jobs: [...jobs.jobs.keys()] })

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    // Waits for running jobs, then runs every provider's shutdown.
    await server.close()
    process.exit(0)
  })
}
```

Deploy the web servers with `JOBS_WORKER=off`, and run workers beside them with `tsx server/worker.ts` or `kitr jobs:work`. `jobs.stop()` waits for running jobs, each for at most its timeout, so set your platform's shutdown grace period above your longest job timeout.

## Read the queue

The `Jobs` service exposes its state for health checks:

```ts
// server/controllers/admin-jobs-controller.ts
import type { HttpContext } from '@kitr/api'
import { useJobs } from '@kitr/jobs'

export default class AdminJobsController {
  async show({ app }: HttpContext) {
    const jobs = useJobs(app)
    return {
      driver: jobs.driver.name,
      running: jobs.running,
      queued: await jobs.driver.size(),
      jobs: [...jobs.jobs.keys()],
    }
    // => { driver: 'memory', running: true, queued: 0, jobs: ['example', 'generate_invoice'] }
  }
}
```

| Member | Description |
| --- | --- |
| `register(...jobs)` | Add jobs after boot. Returns the service, so calls chain. Checks cron and interval syntax. |
| `dispatch(job, payload, options?)` | Queue a job; resolves with its id. |
| `run(job, payload, attempt?)` | Run a job inline with retries; resolves with its result. |
| `start()` | Start polling. Calling it twice does nothing. |
| `stop()` | Stop polling and wait for running jobs. |
| `running` | Whether the worker is polling. |
| `driver` | The queue driver. |
| `jobs` | A map of known jobs by name. |

> [!WARNING] List every job in config/jobs.ts
> `dispatch()` registers an unknown job in this process only, so a separate worker would not know it.

## Commands

| Command | What it does |
| --- | --- |
| `kitr jobs:list` | Loads `config/jobs.ts` and prints each job's name, retries, timeout and schedule. `--json` prints the rows as JSON. |
| `kitr jobs:work` | Run the worker until stopped, then finish running jobs. `--entry <file>` boots another file. |
| `kitr make:job <name>` | Writes a job to `server/jobs/<name>.ts` (kebab-case, nested names allowed). `--force` overwrites an existing file. |
| `kitr eject stub job` | Copies the generator's template to `stubs/job.ts`, so `make:job` writes your own starting point. |

`kitr jobs:list` reads the defaults when a job sets none (3 retries, a 60,000 ms timeout):

```sh
kitr jobs:list
# name              retries  timeout  schedule
# generate_invoice  3        60000
# prune_sessions    3        60000    0 3 * * *
```

`kitr jobs:work` boots `server.app` from the entry's exported `server` (or `app`). `kitr doctor` flags a `config/jobs.ts` that lists no jobs.

`kitr make:job generate-invoice` writes `server/jobs/generate-invoice.ts`:

```ts
// server/jobs/generate-invoice.ts
import { defineJob } from '@kitr/jobs'
import { z } from 'zod'

export const generateInvoiceInput = z.object({
  id: z.string(),
})

/** List it in config/jobs.ts, then dispatch with `useJobs(app).dispatch(generateInvoice, { id })`; it runs on the worker with retries. */
export const generateInvoice = defineJob('generate_invoice', {
  schema: generateInvoiceInput,
  retries: 3,
  // schedule: { every: '1h' },
  async run({ id }, ctx) {
    console.info(`generate_invoice ${id} (attempt ${ctx.attempt})`)
  },
})
```

The generator does not add the job to `config/jobs.ts`; do that yourself.

## Errors

| Error | When | What to do |
| --- | --- | --- |
| `KitrError` `VALIDATION` (422), message `[jobs] <name>: bad payload` | `dispatch()` or `run()` with a payload the schema rejects. `error.fieldErrors` lists the fields. | Fix the payload. In a controller it becomes a 422 response. |
| `[@kitr/jobs] Bad cron "<expr>" (5 fields)` | A cron expression without exactly five fields. | Use `minute hour day month weekday`. |
| `[@kitr/jobs] Bad cron "<expr>" (field "<field>")` | A field out of range, a name like `MON`, or a step of `0`. | See the table in [Run a job on a schedule](#run-a-job-on-a-schedule). |
| `[@kitr/jobs] Bad interval "<text>" (use 30s, 5m, 1h, 1d)` | `{ every }` without a number and a unit. | Write `5m`, not `5 minutes`. |
| `[jobs] <name> timed out after <ms>ms` | An attempt ran past `timeout`. Counts as a failure. | Raise `timeout`, or pass `signal` to the slow call. |

The worker never throws; it logs through the app's [logger](/packages/logger):

| Log line | Level | Meaning |
| --- | --- | --- |
| `[jobs] <name> failed (attempt <n>), retry in <ms>ms` | warn | An attempt failed and the job is queued again. |
| `[jobs] <name> failed after <n> attempts` | error | Retries used up; `onFailed` runs. |
| `[jobs] <name> dropped: bad payload` | error | The queued payload failed the schema; `onFailed` runs. |
| `[jobs] unknown job "<name>" dropped` | warn | No job with that name is listed in this process. |
| `[jobs] could not queue scheduled <name>` | error | A scheduled dispatch failed, usually a schema that rejects `undefined`. |
| `[jobs] worker poll failed` | error | The driver threw (Redis restarted) or a cron expression is bad. The worker keeps polling. |

## Testing

In a test the worker does not start. Dispatched jobs wait in the memory queue, where you can read them, and `jobs.run()` runs one inline:

```ts
// test/generate-invoice.test.ts
import { useJobs } from '@kitr/jobs'
import jobsProvider from '@kitr/jobs/provider'
import { createTestApp } from '@kitr/testing'
import { describe, expect, it } from 'vitest'
import { generateInvoice } from '#server/jobs/generate_invoice'

describe('generate_invoice', () => {
  it('queues the job with its payload', async () => {
    const app = await createTestApp({
      providers: [jobsProvider],
      config: { jobs: { jobs: [generateInvoice] } },
    })
    const jobs = useJobs(app)

    const id = await jobs.dispatch(generateInvoice, { teamId: 'team_engines', month: '2026-10' })

    expect(jobs.running).toBe(false)
    expect(await jobs.driver.size()).toBe(1)
    const [queued] = await jobs.driver.pull(Date.now(), 10)
    expect(queued).toMatchObject({
      id,
      name: 'generate_invoice',
      payload: { teamId: 'team_engines', month: '2026-10' },
      attempt: 1,
    })
  })

  it('builds the invoice number', async () => {
    const app = await createTestApp({ providers: [jobsProvider] })
    const result = await useJobs(app).run(generateInvoice, {
      teamId: 'team_engines',
      month: '2026-10',
    })
    expect(result).toEqual({ invoiceNumber: 'INV-2026-10-team_engines', attempt: 1 })
  })

  it('rejects a bad month before queueing', async () => {
    const app = await createTestApp({ providers: [jobsProvider] })
    const jobs = useJobs(app)
    await expect(
      jobs.dispatch(generateInvoice, { teamId: 'team_engines', month: 'October' }),
    ).rejects.toMatchObject({ code: 'VALIDATION', status: 422 })
    expect(await jobs.driver.size()).toBe(0)
  })
})
```

To check a delay, pull at a later time: `jobs.driver.pull(Date.now() + 10 * 60_000, 10)`.

> [!WARNING] run() waits the real backoff
> A failing job with the defaults takes 7 seconds to give up. Use `retries: 0` or a small `backoff` in tests:

```ts
// test/flaky-job.test.ts
import { createJobs, defineJob } from '@kitr/jobs'
import { createTestApp } from '@kitr/testing'
import { expect, it } from 'vitest'

it('retries until the third attempt succeeds', async () => {
  const jobs = createJobs(await createTestApp())
  const attempts: number[] = []
  const flaky = defineJob('sync_orders_flaky', {
    retries: 2,
    backoff: 1,
    run: (_payload, { attempt }) => {
      attempts.push(attempt)
      if (attempt < 3) throw new Error('payments API down')
      return 'synced'
    },
  })
  expect(await jobs.run(flaky, undefined)).toBe('synced')
  expect(attempts).toEqual([1, 2, 3])
})
```

To test the worker loop, start it with a short poll, wait for the effect, then stop it:

```ts
// test/worker.test.ts
import { createJobs, defineJob } from '@kitr/jobs'
import { createTestApp } from '@kitr/testing'
import { expect, it, vi } from 'vitest'

it('runs dispatched jobs on the worker', async () => {
  const done: string[] = []
  const notify = defineJob<string>('notify_team', { run: (teamId) => void done.push(teamId) })
  const jobs = createJobs(await createTestApp(), { jobs: [notify], pollInterval: 5 })
  jobs.start()
  await jobs.dispatch(notify, 'team_engines')
  await vi.waitFor(() => expect(done).toEqual(['team_engines']))
  await jobs.stop()
})
```

`createJobs(app, config)` builds the service without the provider, with the same options as `config/jobs.ts`.

## Extend

A driver is where queued jobs wait. The worker calls `pull(now, limit)` every `pollInterval` and `ack(job)` after each run. See [`JobsDriver`](/packages/jobs/api#jobsdriver) and [`QueuedJob`](/packages/jobs/api#queuedjob).

| Method | Must |
| --- | --- |
| `push(job)` | Store a `QueuedJob`. Called by `dispatch()` and for every retry. |
| `pull(now, limit)` | Return up to `limit` jobs whose `runAt` is at or before `now`, earliest first, and remove them so no other worker gets them. |
| `size()` | Count the jobs waiting, and the ones pulled but not yet acknowledged. |
| `clear()` | Remove every job. |
| `ack(job)` (optional) | Forget a finished job. With it, a job whose worker crashed runs again. |
| `claim(key, ttlMs)` (optional) | Take a lock for `ttlMs`; `true` for one caller only. Stops several workers queuing the same scheduled run. |

The smallest driver that shares a queue is one [Redis](https://redis.io/docs/latest/develop/data-types/sorted-sets/) sorted set scored by `runAt`. Each job is claimed with `ZREM`, so two workers never run the same one:

```ts
// server/jobs/sorted-set-driver.ts
import { Redis } from 'ioredis'
import type { JobsDriver, QueuedJob } from '@kitr/jobs'

export function createSortedSetDriver(url: string, key = 'acme:jobs'): JobsDriver {
  const redis = new Redis(url)
  return {
    name: 'redis',
    async push(job) {
      await redis.zadd(key, job.runAt, JSON.stringify(job))
    },
    async pull(now, limit) {
      const due = await redis.zrangebyscore(key, 0, now, 'LIMIT', 0, limit)
      const claimed: QueuedJob[] = []
      for (const entry of due) {
        // Only the worker whose ZREM removes the entry runs it.
        if ((await redis.zrem(key, entry)) === 1) claimed.push(JSON.parse(entry) as QueuedJob)
      }
      return claimed
    },
    async size() {
      return redis.zcard(key)
    },
    async clear() {
      await redis.del(key)
    },
  }
}
```

Register it in `config/jobs.ts`:

```ts
// config/jobs.ts
import { defineConfig } from '@kitr/jobs'
import { generateInvoice } from '#server/jobs/generate_invoice'
import { createSortedSetDriver } from '#server/jobs/sorted_set_driver'

export default defineConfig({
  jobs: [generateInvoice],
  driver: createSortedSetDriver(process.env.REDIS_URL ?? 'redis://localhost:6379'),
})
```

Keep payloads to plain JSON: a `Date` comes back as a string. Without `ack`, a job is lost if the process dies mid-run; without `claim`, each worker queues its own copy of a scheduled job.

## Next steps

- [Jobs API reference](/packages/jobs/api): every export with its signature.
- [Mail](/packages/mail): send email from a job.
- [Run on more than one instance](/guides/scale-out): the queue, cache and sockets on shared Redis.
