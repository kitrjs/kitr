---
title: Jobs
description: Run work in the background or on a schedule, with retries when it fails.
order: 1
---

# Jobs

Some work should not keep a request waiting: emailing an invoice, generating a PDF, syncing orders with a payment provider, pruning expired sessions at 3am. `kitr/jobs` hands that work to a background worker. You define a job with a typed payload, dispatch it from a controller, and the worker runs it with retries, exponential backoff, a timeout and an optional cron or interval schedule.

The examples on this page follow one scenario: Acme's app at `app.acme.com` generates a monthly invoice for each team, emails it to the team owner, and cleans up old data every night.

`kitr/jobs` runs on the server only, with no dependencies beyond kitr. The built-in queue lives in the server's memory, which suits one process. For several servers, or for jobs that must survive a restart, give it a shared driver ([Extend](#extend)). For work that must finish before the response (charging a card), call the code directly instead of dispatching a job.

## Install

```sh
kitr add jobs
```

What `kitr add` does, in order:

- Installs `@kitr/jobs`. Jobs require the [server](/packages/server) package, so `kitr add` also adds `server` (and its `logger`) when the project does not have them yet.
- Adds `'@kitr/jobs'` to `packages` and `() => import('@kitr/jobs/provider')` to `providers` in `kitrrc.ts`.
- Writes `config/jobs.ts` (shown in [Configure](#configure)) and regenerates `config/index.ts`.
- Writes an example job, `server/jobs/example.ts`, exporting `exampleJob`.
- When you answer no to the worker question, adds a `worker` script (`kitr jobs:work`) to `package.json`.
- Adds a `## kitr: jobs` section to `AGENTS.md` telling coding agents to put background work in `server/jobs/` and never `setTimeout` work in a request, plus a line about the separate worker when there is one.

`kitr add jobs` asks one question. Agents and CI answer it with a flag:

| Question | Default | Flag |
| --- | --- | --- |
| Run the job worker inside the server process? | yes | `--worker` / `--no-worker` |

```sh
kitr add jobs --no-worker
```

With `--no-worker`, `config/jobs.ts` gets `worker: false` and the worker runs in its own process, as in [Run the worker in its own process](#run-the-worker-in-its-own-process). `kitr add jobs` adds no env variables. To edit `package.json` without running the package manager, pass `--no-install`.

No kit includes jobs; add it to any kit with a server platform.

`kitr remove jobs` reverses every step above: the provider, the `packages` entry, the `worker` script, the `AGENTS.md` section, the dependency and `config/jobs.ts`. Your jobs in `server/jobs/` stay, because you may have edited them.

## Configure

`kitr add jobs` writes this file:

```ts
// config/jobs.ts
import { defineConfig } from 'kitr/jobs'
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
| `jobs` | `[]` | Every job the worker can run. A queued job whose name is not here, and was not dispatched by this process, is dropped with a warning. Schedules only run for jobs listed here or passed to `register()`. |
| `driver` | the memory driver | Where queued jobs wait. See [Extend](#extend). |
| `concurrency` | `5` | How many jobs run at once in each process. |
| `pollInterval` | `500` | Milliseconds between checks of the queue. |
| `worker` | `true` | Start the worker when the server starts. `false` when a separate process runs jobs. |
| `onFailed(job, error)` | none | Called when a job has used up its retries, or its payload fails the schema. Receives the `QueuedJob` and the last error. |

Per-job options (`retries`, `backoff`, `timeout`, `schedule`) live on the job itself; see [Define a job](#define-a-job).

`kitr/jobs` reads no env variables. Use your own in `config/jobs.ts` when a setting changes per deploy, as in [Run the worker in its own process](#run-the-worker-in-its-own-process).

## Dispatch your first job

Generate a job:

```sh
kitr make:job generate-invoice
```

That writes `server/jobs/generate_invoice.ts`. Edit it to build a team's invoice for a month:

```ts
// server/jobs/generate_invoice.ts
import { defineJob } from 'kitr/jobs'
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
import { defineConfig } from 'kitr/jobs'
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
// server/controllers/invoices_controller.ts
import type { HttpContext } from 'kitr/api'
import { useJobs } from 'kitr/jobs'
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

Register the route with `api.post('/teams/:teamId/invoices', [InvoicesController, 'store'])` in `server/routes.ts`. The request answers at once with the job id. Within half a second (`pollInterval`) the worker in the same process picks the job up and runs it.

The payload is typed from the schema, so a missing `month` is a type error. A wrong value at run time, such as `month: 'October'`, makes `dispatch()` throw a `KitrError` with code `VALIDATION` before anything is queued; in a controller that becomes a 422 response.

## Define a job

`defineJob(name, options)` returns a job object. The name is how the queue refers to it, so keep it stable across deploys: a queued job whose name no longer exists is dropped.

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

Without a schema, the type parameter types the payload: `defineJob<{ teamId: string }>('notify_team', { run: ... })`. With one, the payload type comes from the schema. A job with no payload is dispatched with `undefined`: `dispatch(pruneSessions, undefined)`.

## Dispatch a job

On the server, `useJobs(app).dispatch(job, payload, options?)` queues a job and resolves with its id. It works in controllers, actions, services and other jobs:

```ts
// server/jobs/close_month.ts
import { defineJob, useJobs } from 'kitr/jobs'
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
| An action or service during a request | `useJobs(useRequestApp())`, with `useRequestApp` from `kitr/server` |
| A script | `useJobs(server.app)` after `await server.boot()` |

`useJobs(app)` is `app.container.use('jobs')`. The provider binds nothing in the browser.

Pass ids and small plain values in the payload, not whole records. With a shared driver the payload is stored as data, and the job should load fresh records when it runs.

Don't `setTimeout(() => sendEmail(), 0)` in a request handler. The work has no retries, nothing waits for it at shutdown, and an error in it is lost. Dispatch a job.

## Delay a job

Pass `delay` in milliseconds, or `at` for a fixed time:

```ts
// server/services/trial_service.ts
import type { KitrApp } from 'kitr/app'
import { useJobs } from 'kitr/jobs'
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

The job is queued at once with that `runAt` time, and the worker leaves it until then. With the memory driver a delayed job is lost if the process restarts before it runs.

## Run a job on a schedule

Give a job a `schedule` and list it in `config/jobs.ts`. The worker dispatches it itself; you never call `dispatch()`:

```ts
// server/jobs/prune_sessions.ts
import { defineJob } from 'kitr/jobs'

/** Every day at 03:00 server time. */
export const pruneSessions = defineJob('prune_sessions', {
  schedule: '0 3 * * *',
  async run(_payload, { app }) {
    app.container.use('logger').info('pruning expired sessions')
  },
})
```

```ts
// server/jobs/sync_orders.ts
import { defineJob } from 'kitr/jobs'

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

Each field takes `*`, a number, a list (`1,15`), a range (`1-5`) and a step (`*/10`, `5/15`, `0-30/10`). Names like `MON` or `JAN` are not supported. When both day of month and weekday are set, either may match, as in standard cron: `0 0 1 * 1` runs on the 1st and on every Monday.

Intervals take a number and a unit: `250ms`, `30s`, `5m`, `1.5h`, `1d`. An interval job runs once as soon as the worker starts, then every interval after its last dispatch.

A scheduled job is dispatched with an `undefined` payload, so it cannot have a schema that rejects `undefined`. If it does, the worker logs `[jobs] could not queue scheduled <name>` every time and the job never runs.

A bad expression in `register()` throws at once: `[kitr/jobs] Bad cron "61 * * * *" (field "61")`. A bad interval in `config/jobs.ts` throws when the app boots. A bad cron expression in `config/jobs.ts` is not checked at boot; the worker logs `[jobs] worker poll failed` once a minute instead. Check new expressions with `cronMatches()`:

```ts
// scripts/check_cron.ts
import { cronMatches, parseInterval } from 'kitr/jobs'

cronMatches('0 3 * * *', new Date(2026, 10, 7, 3, 0)) // => true
cronMatches('*/15 9-17 * * 1-5', new Date(2026, 10, 7, 9, 30)) // => false, a Saturday
parseInterval('5m') // => 300000
```

Every process with a running worker dispatches scheduled jobs. With two web servers that both run the worker, `prune_sessions` runs twice. Run the worker in one process, as below.

## Retry a failing job

When `run` throws or times out, the worker queues the job again after `backoff × 2^(attempt - 1)` milliseconds, until it has used its retries:

```ts
// server/jobs/send_invoice_email.ts
import { defineJob } from 'kitr/jobs'
import { useMailer } from 'kitr/mail'
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

With `retries: 5` and `backoff: 10_000`, a mail outage is retried after 10s, 20s, 40s, 80s and 160s, then given up. The logger shows each step:

```
WARN  09:00:10.112 [app] [jobs] send_invoice_email failed (attempt 1), retry in 10000ms
WARN  09:00:20.140 [app] [jobs] send_invoice_email failed (attempt 2), retry in 20000ms
...
ERROR 09:05:10.301 [app] [jobs] send_invoice_email failed after 6 attempts
```

A payload that fails the schema when the worker picks it up is dropped without a retry, since it would fail every time, and logged as `[jobs] <name> dropped: bad payload`. Make `run` safe to repeat: a job that fails after charging a card is retried, and charges again unless you check first.

## Handle a job that keeps failing

`onFailed` in `config/jobs.ts` runs when a job has used its retries or its payload was rejected. It is the place to alert someone:

```ts
// config/jobs.ts
import { defineConfig } from 'kitr/jobs'
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

`onFailed` has no `app`. To report through [monitoring](/packages/monitoring), catch and report inside `run` with `ctx.app`, and rethrow so the job still retries:

```ts
// server/jobs/generate_invoice.ts
import { defineJob } from 'kitr/jobs'

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

Each attempt gets `timeout` milliseconds, 60 seconds by default. At the limit, `ctx.signal` aborts and the attempt fails with `[jobs] <name> timed out after <ms>ms`, which counts as a failure and is retried. Pass the signal to anything that accepts one, so the work really stops:

```ts
// server/jobs/export_projects.ts
import { defineJob } from 'kitr/jobs'

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

A job that ignores its signal still fails at the timeout and frees its worker slot, but its code keeps running in the background until it finishes on its own.

## Run a job inline

`useJobs(app).run(job, payload)` runs a job now, in this process, with its retries and timeout, and resolves with what `run` returned. Nothing is queued:

```ts
// scripts/backfill_invoices.ts
import { useJobs } from 'kitr/jobs'
import { generateInvoice } from '#server/jobs/generate_invoice'
import { server } from '#server/main'

await server.boot()
const result = await useJobs(server.app).run(generateInvoice, { teamId: 'team_engines', month: '2026-09' })
// => { invoiceNumber: 'INV-2026-09-team_engines', attempt: 1 }
await server.close()
```

When every attempt fails, `run()` throws the last error. It waits the real backoff between attempts, and it does not call `onFailed`. A payload that fails the schema throws a `VALIDATION` error at once, without retrying.

## Run the worker in its own process

By default the worker runs inside the web server: it starts when `server.listen()` runs, or on the first request served through `server.fetch()` outside tests, and drains on shutdown. That suits one server.

With several web servers, or long jobs that should not compete with requests, run one worker process and turn the worker off in the web servers. The queue must then be shared between processes, so this needs a shared driver ([Extend](#extend)); with the memory driver, a job dispatched in the web server never reaches the worker.

```ts
// config/jobs.ts
import { defineConfig } from 'kitr/jobs'
import { generateInvoice } from '#server/jobs/generate_invoice'
import { pruneSessions } from '#server/jobs/prune_sessions'
import { createRedisJobsDriver } from '#server/jobs/redis_driver'

export default defineConfig({
  jobs: [generateInvoice, pruneSessions],
  driver: createRedisJobsDriver(process.env.REDIS_URL ?? 'redis://localhost:6379'),
  // JOBS_WORKER=off on the web servers: they only queue, the worker process runs jobs.
  worker: process.env.JOBS_WORKER !== 'off',
})
```

```ts
// server/worker.ts
import { useJobs } from 'kitr/jobs'
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

Deploy the web servers with `JOBS_WORKER=off`, and start one worker next to them with `tsx server/worker.ts`. Or skip `server/worker.ts` and run `kitr jobs:work`, which boots the app and starts the worker the same way; it needs `server/main.ts` to export `app`, as shown in [Commands](#commands). `kitr add jobs --no-worker` adds that command as the `worker` script. It calls `start()` itself, so the setting does not matter there; in development, with the variable unset, the web server runs the worker as before. `server/main.ts` only listens when it is the entry file, so importing it here boots the app without opening a port.

`jobs.stop()` stops polling and waits for running jobs. Each job waits at most its timeout. Set your platform's shutdown grace period above your longest job timeout.

## Read the queue

The `Jobs` service exposes its state for health checks and admin pages:

```ts
// server/controllers/admin_jobs_controller.ts
import type { HttpContext } from 'kitr/api'
import { useJobs } from 'kitr/jobs'

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

`dispatch()` registers a job it does not know yet, in this process only. Always list jobs in `config/jobs.ts`, so a separate worker knows them too.

## Errors

| Error | When | What to do |
| --- | --- | --- |
| `KitrError` `VALIDATION` (422), message `[jobs] <name>: bad payload` | `dispatch()` or `run()` with a payload the schema rejects. `error.fieldErrors` lists the fields. | Fix the payload. In a controller it becomes a 422 response. |
| `[kitr/jobs] Bad cron "<expr>" (5 fields)` | A cron expression without exactly five fields. | Use `minute hour day month weekday`. |
| `[kitr/jobs] Bad cron "<expr>" (field "<field>")` | A field out of range, a name like `MON`, or a step of `0`. | See the table in [Run a job on a schedule](#run-a-job-on-a-schedule). |
| `[kitr/jobs] Bad interval "<text>" (use 30s, 5m, 1h, 1d)` | `{ every }` without a number and a unit. | Write `5m`, not `5 minutes`. |
| `[jobs] <name> timed out after <ms>ms` | An attempt ran past `timeout`. Counts as a failure. | Raise `timeout`, or pass `signal` to the slow call. |

The worker never throws: it logs these messages through the app's [logger](/packages/logger) instead.

| Log line | Level | Meaning |
| --- | --- | --- |
| `[jobs] <name> failed (attempt <n>), retry in <ms>ms` | warn | An attempt failed and the job is queued again. |
| `[jobs] <name> failed after <n> attempts` | error | Retries used up; `onFailed` runs. |
| `[jobs] <name> dropped: bad payload` | error | The queued payload failed the schema; `onFailed` runs. |
| `[jobs] unknown job "<name>" dropped` | warn | No job with that name is listed in this process. |
| `[jobs] could not queue scheduled <name>` | error | A scheduled dispatch failed, usually a schema that rejects `undefined`. |
| `[jobs] worker poll failed` | error | The driver threw (Redis restarted) or a cron expression is bad. The worker keeps polling. |

## Commands

| Command | What it does |
| --- | --- |
| `kitr jobs:list` | Loads `config/jobs.ts` and prints each job's name, retries, timeout and schedule. `--json` prints the rows as JSON. |
| `kitr jobs:work` | Boots the app from `server/main.ts` and runs the worker in this process until `SIGINT` or `SIGTERM`, then waits for running jobs. `--entry <file>` boots another file. |
| `kitr make:job <name>` | Writes a job to `server/jobs/<snake_name>.ts`. `--force` overwrites an existing file. |
| `kitr eject stub job` | Copies the generator's template to `stubs/job.ts`, so `make:job` writes your own starting point. |

`kitr jobs:list` reads the defaults when a job sets none (3 retries, a 60,000 ms timeout):

```sh
kitr jobs:list
# name              retries  timeout  schedule
# generate_invoice  3        60000
# prune_sessions    3        60000    0 3 * * *
```

`kitr jobs:work` needs the entry file to export `app`. The generated `server/main.ts` exports `server`, so add one line to it before you use the command:

```ts
// server/main.ts
export const app = server.app
```

`kitr doctor` adds one finding from this package: an info line when `config/jobs.ts` lists no jobs (`jobs: []`), with the fix `kitr make:job <name>`, then add it to `jobs: [...]`.

`kitr make:job generate-invoice` writes `server/jobs/generate_invoice.ts`:

```ts
// server/jobs/generate_invoice.ts
import { defineJob } from 'kitr/jobs'
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

The generator does not add the job to `config/jobs.ts`; add it to `jobs` yourself.

## Testing

In a test the worker does not start: `createTestApp()` boots the app but does not run the providers' `ready` step. Dispatched jobs wait in the memory queue, where you can read them, and `jobs.run()` runs one inline:

```ts
// test/generate_invoice.test.ts
import { useJobs } from 'kitr/jobs'
import jobsProvider from 'kitr/jobs/provider'
import { createTestApp } from 'kitr/testing'
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

`driver.pull()` removes what it returns, which is what you want at the end of a test. To check a delay, pull at a later time: `jobs.driver.pull(Date.now() + 10 * 60_000, 10)`.

`jobs.run()` waits the real backoff between attempts, so a failing job with the defaults takes 7 seconds to give up. To test failure handling, pass `retries: 0` on a test job, or keep `backoff` small:

```ts
// test/flaky_job.test.ts
import { createJobs, defineJob } from 'kitr/jobs'
import { createTestApp } from 'kitr/testing'
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

To test the worker loop itself, start it with a short poll and wait for the effect, then stop it:

```ts
// test/worker.test.ts
import { createJobs, defineJob } from 'kitr/jobs'
import { createTestApp } from 'kitr/testing'
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

A driver is where queued jobs wait. It has four methods; the worker calls `pull(now, limit)` every `pollInterval` and runs what comes back. See [`JobsDriver`](/packages/jobs/api#jobsdriver) and [`QueuedJob`](/packages/jobs/api#queuedjob).

| Method | Must |
| --- | --- |
| `push(job)` | Store a `QueuedJob`. Called by `dispatch()` and for every retry. |
| `pull(now, limit)` | Return up to `limit` jobs whose `runAt` is at or before `now`, earliest first, and remove them so no other worker gets them. |
| `size()` | Count the jobs waiting. |
| `clear()` | Remove every job. |

This driver keeps the queue in a [Redis](https://redis.io/docs/latest/develop/data-types/sorted-sets/) sorted set scored by `runAt`, with [ioredis](https://github.com/redis/ioredis) (`pnpm add ioredis`). Each job is claimed with `ZREM`, so two workers never run the same one:

```ts
// server/jobs/redis_driver.ts
import Redis from 'ioredis'
import type { JobsDriver, QueuedJob } from 'kitr/jobs'

export function createRedisJobsDriver(url: string, key = 'acme:jobs'): JobsDriver {
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
import { defineConfig } from 'kitr/jobs'
import { generateInvoice } from '#server/jobs/generate_invoice'
import { createRedisJobsDriver } from '#server/jobs/redis_driver'

export default defineConfig({
  jobs: [generateInvoice],
  driver: createRedisJobsDriver(process.env.REDIS_URL ?? 'redis://localhost:6379'),
})
```

Payloads pass through `JSON.stringify`, so keep them to plain JSON: a `Date` comes back as a string, and the schema check on pull catches the mismatch. A job is removed from the queue when it is pulled, before it runs. If the process dies mid-run, the job is gone, so a driver that must never lose work moves pulled jobs to a processing list and pushes them back when they are not acknowledged in time. The same four methods fit a database table: `pull` selects due rows and deletes them in one transaction.

## Next steps

- [Jobs API reference](/packages/jobs/api): every export with its signature.
- [Mail](/packages/mail): send email from a job.
- [Logger](/packages/logger): where the worker's warnings and errors go.
- [Monitoring](/packages/monitoring): report jobs that keep failing.
- [Server](/packages/server): the lifecycle that starts and stops the worker.
- [Standard Schema](https://standardschema.dev): the schema libraries a job accepts.
