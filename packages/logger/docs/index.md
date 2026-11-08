---
title: Logger
description: Write readable logs in development and structured logs in production.
order: 1
---

# Logger

When Ada reports that her order never shipped, the logs are where you find out why. In development you want lines you can read at a glance; in production you want one JSON object per line, so your log service can filter by `orderId` or `requestId`. `@kitr/logger` writes both from the same calls.

> [!SUMMARY]
> Readable logs in development and JSON logs in production, with levels, child loggers and a request id on every server line. Every kitr app with a server includes it; the overview is at [/packages/logger](/packages/logger).

It runs on the server and in the browser and is for lines a developer reads. For alerts with the user and the steps that led to an error, use [monitoring](/packages/monitoring); to count what users do, use [analytics](/packages/analytics).

The examples follow Acme's app at `app.acme.com`, where Ada, Grace and Linus read the logs when something goes wrong.

## Install

```sh
kitr add logger
```

<details>
<summary>Everything kitr add changes</summary>

What `kitr add` does:

- Installs `@kitr/logger`.
- Adds `'@kitr/logger'` to `packages` and `() => import('@kitr/logger')` to `providers` in `kitrrc.ts`.
- Writes `config/logger.ts` (shown in [Configure](#configure)) and regenerates `config/index.ts`.
- Adds a `## kitr: logger` section to `AGENTS.md` telling coding agents to log through `ctx.logger` or `app.container.use('logger')`, never `console.log` in server code.

The [server](/packages/server) package requires the logger, so `kitr add server` adds it first and adds `LOG_LEVEL=info` to `.env.example`. Every kit with a server platform already has it.

`kitr remove logger` reverses these steps and deletes `config/logger.ts`.

</details>

## Configure

`kitr add logger` writes this file:

```ts
// config/logger.ts
import { defineConfig } from '@kitr/logger'

export default defineConfig({
  name: 'app',
  level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') ?? 'info',
  // 'pretty' in dev, 'json' in production by default.
})
```

| Option | Default | Description |
| --- | --- | --- |
| `level` | `'info'` | The lowest level written: `trace`, `debug`, `info`, `warn`, `error`, `fatal` or `silent`. |
| `name` | none | Shown in brackets before each message in pretty output, and as `name` in JSON. |
| `format` | `'pretty'` unless `NODE_ENV` is `production`, then `'json'` | How each line is written. |
| `bindings` | `{}` | Fields added to every record, such as `{ region: 'eu-west-1' }`. |
| `write(line, record)` | the console | Where lines go. The default writes `error` and `fatal` to `console.error` (stderr) and the rest to `console.log` (stdout). |

| Variable | Used for |
| --- | --- |
| `LOG_LEVEL` | The lowest level to print, such as `info`. |

The default `format` reads `process.env.NODE_ENV`, not the app's mode. In the browser the logger calls the console directly; see [Log in the browser](#log-in-the-browser).

## Write your first log line

In a controller, the logger is `ctx.logger`. It is a child of the app's logger that adds the request id to every line:

```ts
// server/controllers/orders-controller.ts
import type { HttpContext } from '@kitr/api'

export default class OrdersController {
  async ship({ logger, params }: HttpContext<{ id: string }>) {
    logger.info('order shipped', { orderId: params.id })
    return { orderId: params.id, status: 'shipped' }
  }
}
```

Call `POST /api/orders/1042/ship` in development and the server prints:

```
INFO  14:03:22.418 [app] order shipped {"requestId":"9b2f6c1e-4f3a-4c1d-8e7a-2b5d0c9e1f44","orderId":"1042"}
```

In production, where `NODE_ENV=production`, the same call writes one JSON object:

```json
{"level":"info","time":"2026-11-07T14:03:22.418Z","name":"app","requestId":"9b2f6c1e-4f3a-4c1d-8e7a-2b5d0c9e1f44","orderId":"1042","msg":"order shipped"}
```

Keep the message fixed and put the variable parts in fields: `'order shipped'` with `{ orderId }`, not `` `order ${id} shipped` ``. Your log service can then count and filter the lines.

## Write at a level

Each level has a method. Lines below the configured `level` are dropped before formatting, so a `debug` call in a hot path is nearly free in production.

| Level | Method | Use it for |
| --- | --- | --- |
| `trace` | `logger.trace(msg, fields?)` | Step-by-step detail you only turn on while debugging one thing. |
| `debug` | `logger.debug(msg, fields?)` | Detail for development: the server's request lines, cache hits. |
| `info` | `logger.info(msg, fields?)` | Things that happened: an order shipped, a job finished. |
| `warn` | `logger.warn(msg, fields?)` | Something odd that did not fail: a slow query, a retry. |
| `error` | `logger.error(msgOrError, fields?)` | A failure someone should look at. |
| `fatal` | `logger.fatal(msgOrError, fields?)` | The process cannot continue. |

`silent` is a level for configuration only: it drops everything.

```ts
// server/services/project-service.ts
import type { KitrApp } from '@kitr/kitr/app'

export async function syncProject(app: KitrApp, projectId: string) {
  const logger = app.container.use('logger')
  logger.debug('loading project', { projectId })
  logger.warn('slow query', { projectId, ms: 1840 })
  logger.info('project synced', { projectId, tasks: 42 })
}
```

## Log an error

Pass the `Error` itself to `error()` or `fatal()`. Its message becomes `msg`, and its name, message, stack and `code` are kept under `err`:

```ts
// server/services/invoice-service.ts
import type { KitrApp } from '@kitr/kitr/app'

export async function generateInvoice(app: KitrApp, invoiceNumber: string) {
  const logger = app.container.use('logger')
  try {
    throw Object.assign(new Error('connect ECONNREFUSED 10.0.0.5:5432'), { code: 'ECONNREFUSED' })
  } catch (error) {
    logger.error(error as Error, { invoiceNumber })
    throw error
  }
}
```

In JSON that becomes:

```json
{"level":"error","time":"2026-11-07T14:05:10.002Z","name":"app","invoiceNumber":"INV-2026-007","msg":"connect ECONNREFUSED 10.0.0.5:5432","err":{"name":"Error","message":"connect ECONNREFUSED 10.0.0.5:5432","stack":"Error: connect ECONNREFUSED ...","code":"ECONNREFUSED"}}
```

> [!WARNING] Pass the error as the first argument
> `logger.error('failed', { error })` writes `{}`, because an `Error`'s message and stack are not enumerable.

The server already logs every 5xx response at `error` level, so log only errors you catch and handle yourself.

## Add fields to every line

`child(bindings, name?)` returns a logger that adds `bindings` to every record, so an id travels with a piece of work:

```ts
// server/services/order-service.ts
import type { KitrApp } from '@kitr/kitr/app'

export async function shipOrder(app: KitrApp, orderId: string) {
  const logger = app.container.use('logger').child({ orderId }, 'orders')
  logger.info('picking items')
  logger.info('label printed', { carrier: 'DHL' })
  logger.info('order shipped')
  return { orderId, status: 'shipped' as const }
}
```

```
INFO  14:03:22.418 [orders] picking items {"orderId":"1042"}
INFO  14:03:22.419 [orders] label printed {"orderId":"1042","carrier":"DHL"}
INFO  14:03:22.420 [orders] order shipped {"orderId":"1042"}
```

A child keeps its parent's bindings; fields passed in a call win over bindings with the same key. For fields every line should carry, such as the region, set `bindings` in `config/logger.ts`:

```ts
// config/logger.ts
import { defineConfig } from '@kitr/logger'

export default defineConfig({
  name: 'app',
  level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') ?? 'info',
  bindings: { region: process.env.FLY_REGION ?? 'local', release: process.env.RELEASE ?? 'dev' },
})
```

> [!WARNING] Reserved names
> `level`, `time` and `msg` are reserved. A field or binding with one of those names is dropped.

## Log during a request

Every request gets its own child logger with `requestId`, taken from the `x-request-id` header or a new UUID and echoed in the response header. Grep for it to see every line one request wrote.

| Where | How |
| --- | --- |
| A controller | `ctx.logger` |
| Middleware, an action or a service during a request | `useRequest().logger`, with `useRequest` from `@kitr/server` |
| Code that may run inside or outside a request | `tryUseRequest()?.logger ?? app.container.use('logger')` |

```ts
// server/services/team-service.ts
import { useRequest } from '@kitr/server'

export function inviteToTeam(teamId: string, email: string) {
  const { logger } = useRequest()
  logger.info('team invite sent', { teamId, invitee: email })
}
```

`useRequest()` throws outside a request, such as in a job or at startup.

When a request finishes, the server writes one `debug` line with the method, path, status, client IP and duration:

```
DEBUG 14:03:22.431 [app] POST /api/orders/1042/ship {"requestId":"9b2f6c1e-...","status":200,"ip":"127.0.0.1","durationMs":13}
```

Set `LOG_LEVEL=debug` to see them.

## Log outside a request

The provider binds the logger as `logger` in the container. Jobs, scripts and providers read it from there:

```ts
// server/jobs/prune-sessions.ts
import { defineJob } from '@kitr/jobs'

export const pruneSessions = defineJob('prune_sessions', {
  schedule: '0 3 * * *',
  async run(_payload, { app, jobId }) {
    const logger = app.container.use('logger').child({ jobId }, 'jobs')
    logger.info('pruning expired sessions')
  },
})
```

The server keeps the same logger as `server.logger`, set once `server.boot()` has run.

## Log in the browser

In a component, read the logger with `useService` from [`@kitr/react`](/packages/react):

```tsx
// app/components/projects/project-actions.tsx
import { useService } from '@kitr/react'

export function ArchiveProjectButton({ projectId }: { projectId: string }) {
  const logger = useService('logger')
  return (
    <button type="button" onClick={() => logger.info('project archived', { projectId })}>
      Archive
    </button>
  )
}
```

Browser lines go to the matching console method with the fields as an expandable object, for example `console.info('[app] project archived', { projectId })`. Set `format` or `write` for formatted lines instead. Nothing is sent to your server; to collect client-side failures, use [monitoring](/packages/monitoring).

## Time an operation

`logger.time(msg, fn, fields?)` runs an async function, logs `msg` at `info` with `durationMs` when it settles, and returns its result:

```ts
// server/services/invoice-service.ts
import type { KitrApp } from '@kitr/kitr/app'

export async function renderInvoicePdf(app: KitrApp, invoiceNumber: string) {
  const logger = app.container.use('logger').child({ invoiceNumber }, 'billing')
  const bytes = await logger.time('rendered invoice PDF', async () => new Uint8Array(48_213), {
    pages: 2,
  })
  return bytes.length
  // => 48213
}
```

```
INFO  14:07:41.006 [billing] rendered invoice PDF {"invoiceNumber":"INV-2026-007","pages":2,"durationMs":212}
```

The line is written even when the function throws, and the error is rethrown. The line doesn't say it failed, so log the error separately.

## Change the level at run time

Set `level` to turn on debug output in a running process:

```ts
// server/controllers/admin-controller.ts
import type { HttpContext } from '@kitr/api'

export default class AdminController {
  async setLogLevel({ app, body }: HttpContext<{}, {}, { level: 'debug' | 'info' }>) {
    const logger = app.container.use('logger')
    logger.level = body.level
    return { level: logger.level }
  }
}
```

A child copies its parent's level when created, so a change affects only children created afterwards, such as the next request's logger. Protect a route like this with [auth](/packages/auth).

## Choose the output format

`pretty` is for terminals: a coloured level, the UTC time, `[name]`, the message, fields as dim JSON and any stack. `json` is one record per line, with keys in this order: `level`, `time`, `name`, bindings, fields, `msg`, `err`.

Force one format everywhere, for example JSON in a staging environment that runs with `NODE_ENV=development`:

```ts
// config/logger.ts
import { defineConfig } from '@kitr/logger'

export default defineConfig({
  name: 'app',
  level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') ?? 'info',
  format: process.env.LOG_FORMAT === 'json' ? 'json' : undefined,
})
```

Most hosting platforms collect stdout and stderr and parse JSON lines into searchable fields, so `json` in production needs nothing else.

## Send logs to a file or a service

`write(line, record)` replaces the console. It receives the formatted line and the record for every line at or above the level:

```ts
// config/logger.ts
import { appendFileSync } from 'node:fs'
import { defineConfig } from '@kitr/logger'

export default defineConfig({
  name: 'app',
  format: 'json',
  write(line, record) {
    appendFileSync('storage/logs/app.log', `${line}\n`)
    if (record.level === 'error' || record.level === 'fatal') console.error(line)
  },
})
```

To ship to an HTTP endpoint, buffer records and send them in batches:

```ts
// server/log_shipper.ts
import type { LogRecord } from '@kitr/logger'

const buffer: LogRecord[] = []

export function shipLog(_line: string, record: LogRecord) {
  buffer.push(record)
  if (buffer.length >= 100) void flushLogs()
}

export async function flushLogs() {
  const batch = buffer.splice(0)
  if (!batch.length) return
  await fetch('https://logs.acme.com/ingest', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(batch),
  }).catch(() => {
    // Never let logging take the app down.
  })
}

setInterval(flushLogs, 5_000).unref()
```

```ts
// config/logger.ts
import { defineConfig } from '@kitr/logger'
import { shipLog } from '#server/log_shipper'

export default defineConfig({ name: 'app', format: 'json', write: shipLog })
```

> [!WARNING] Keep write fast and safe
> `write` runs synchronously on every log call, and a throw escapes the `logger.info()` that triggered it. Catch inside it.

## Create a logger without the provider

`createLogger(options)` takes the same options as `config/logger.ts`. Use it in scripts or anywhere no app exists:

```ts
// scripts/import_projects.ts
import { createLogger } from '@kitr/logger'

const logger = createLogger({ name: 'import', level: 'debug' })
logger.info('importing projects', { file: 'projects.csv' })
```

`silentLogger` writes nothing; pass it where an API wants a logger and you want no output.

## See logs in devtools

With [devtools](/packages/devtools) installed, every record is copied to the Log panel under the `logger` channel, so server and client lines sit in one place.

## Testing

`createLogger({ write })` lets a test collect records. For code that reads the logger from the container, boot an app with the provider and a collecting `write`:

```ts
// test/ship-order.test.ts
import { type LogRecord, loggerProvider } from '@kitr/logger'
import { createTestApp } from '@kitr/testing'
import { describe, expect, it } from 'vitest'
import { shipOrder } from '#server/services/order-service'

describe('shipOrder', () => {
  it('logs each step with the order id', async () => {
    const records: LogRecord[] = []
    const app = await createTestApp({
      providers: [loggerProvider],
      config: {
        logger: { level: 'debug', format: 'json', write: (_line, record) => records.push(record) },
      },
    })

    await shipOrder(app, '1042')

    expect(records.map((r) => r.msg)).toEqual(['picking items', 'label printed', 'order shipped'])
    expect(records[1]).toMatchObject({
      level: 'info',
      name: 'orders',
      orderId: '1042',
      carrier: 'DHL',
    })
  })
})
```

Each record is a plain object with `level`, `msg`, `name`, your fields and bindings, `err` and `durationMs`, so assert with `toMatchObject`. To check a line's exact text, assert on the first argument of `write`. To keep a noisy test quiet, use `level: 'silent'` or `silentLogger`:

```ts
// test/quiet-server.test.ts
import { silentLogger } from '@kitr/logger'
import { createServer } from '@kitr/server'
import { expect, it } from 'vitest'

it('answers the health check without printing', async () => {
  const server = createServer({ logger: silentLogger })
  const res = await server.fetch(new Request('http://localhost/healthz'))
  expect(await res.json()).toEqual({ ok: true })
})
```

## Next steps

- [Logger API reference](/packages/logger/api): every export with its signature.
- [Server](/packages/server): request ids, the request logger and error logging.
- [Monitoring](/packages/monitoring): alerts with user and breadcrumbs when something breaks.
