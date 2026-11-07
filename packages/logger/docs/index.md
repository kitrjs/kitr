---
title: Logger
description: Write readable logs in development and structured logs in production.
order: 1
---

# Logger

One `logger` for the server: coloured, readable lines in a terminal and one JSON object per line in production, so a log collector can index `level`, `name`, `requestId` and your own fields. Children carry bindings, `time()` measures an operation, and `error()` takes an `Error` and records its stack.

## Install

```sh
kitr add logger
```

```ts
// config/logger.ts
import { defineConfig } from 'kitr/logger'

export default defineConfig({
  level: process.env.LOG_LEVEL ?? 'info',
  name: 'api',
  // format: 'json' | 'pretty' (default: pretty in development, json otherwise)
})
```

## Use it

```ts
const logger = app.container.use('logger')
logger.info('user signed in', { userId })
logger.error(error, { route: 'projects.create' })

const requestLogger = logger.child({ requestId })
await requestLogger.time('load projects', () => db.projects.findMany())
```

The server binds a child with the request id for every request, so controllers reading `ctx.logger` get it for free.

## Tests

`silentLogger` is a ready-made logger that writes nothing; pass it to `createServer({ logger: silentLogger })`. `createLogger({ write })` captures lines for assertions.
