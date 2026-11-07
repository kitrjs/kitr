---
title: Logger
description: Write readable logs in development and structured logs in production.
order: 1
---

# Logger

In development you want logs you can read at a glance: a coloured level, the time, the message. In production you want one JSON object per line, so your log service can search and filter them. `kitr/logger` does both from the same calls, with no dependencies.

## Install

```sh
kitr add logger
```

The [server](/packages/server) package adds it for you. It writes `config/logger.ts`:

```ts
import { defineConfig } from 'kitr/logger'

export default defineConfig({
  name: 'app',
  level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') ?? 'info',
})
```

| Option | Default | Description |
| --- | --- | --- |
| `level` | `info` | The lowest level that is written: `trace`, `debug`, `info`, `warn`, `error`, `fatal` or `silent`. |
| `name` | none | Shown in brackets before each message, and as `name` in JSON. |
| `format` | `pretty` in development, `json` in production | How each line is written. |
| `bindings` | none | Fields added to every record. |
| `write(line, record)` | the console | Where lines go. Errors go to stderr. |

## Write logs

The message comes first and the fields second:

```ts
logger.info('project created', { projectId: project.id })
logger.warn('slow query', { ms: 1840 })
logger.error(error, { projectId })
```

In development that prints:

```
INFO  14:03:22.418 [app] project created {"projectId":"p_42"}
```

In production the same call writes:

```json
{"level":"info","time":"2026-11-07T14:03:22.418Z","name":"app","projectId":"p_42","msg":"project created"}
```

Pass an `Error` and its name, message, stack and code are kept under `err`.

## Where the logger comes from

On the server, every request has its own child logger that adds the request id to each line. In a controller it's `ctx.logger`. Anywhere else during a request, `useRequest().logger` from `kitr/server` returns the same one. Outside a request, use `app.container.use('logger')`.

## Child loggers and timing

```ts
const log = logger.child({ jobId }, 'billing')
log.info('started')

const invoices = await log.time('loaded invoices', () => db.invoices.pending())
// INFO  [billing] loaded invoices {"jobId":"j_1","durationMs":212}
```

## Development tools

With [devtools](/packages/devtools) installed, every log line also appears in the Log panel under "logger", so you can read server and client logs in one place.

## Tests

`silentLogger` drops everything. `createLogger({ write })` lets a test collect records and check them:

```ts
import { createLogger } from 'kitr/logger'

const records: unknown[] = []
const logger = createLogger({ format: 'json', write: (_line, record) => records.push(record) })
```
