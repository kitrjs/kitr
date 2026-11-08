---
title: Overview
description: Write readable logs in development and structured logs in production.
order: 0
---

# Logger

## What it is

`@kitr/logger` is a small logger with levels, child loggers that carry fields, and two output formats: readable in development, JSON in production. On the server every request gets a child logger with its request id.

Runs on the server and in the browser. For alerts about errors, use [monitoring](/packages/monitoring).

## Install

```sh
kitr add logger
```

Adds `@kitr/logger`, its provider and `config/logger.ts`. [server](/packages/server) adds it for you. [Every change](/packages/logger/guide#install).

## Quick start

In a controller, the logger is `ctx.logger`, a child of the app's logger that adds the request id to every line:

```ts
// server/controllers/orders_controller.ts
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

In production, where `NODE_ENV=production`, the same call writes one JSON object per line, ready for your log service:

```json
{"level":"info","time":"2026-11-07T14:03:22.418Z","name":"app","requestId":"9b2f6c1e-4f3a-4c1d-8e7a-2b5d0c9e1f44","orderId":"1042","msg":"order shipped"}
```

Keep the message fixed and put the variable parts in fields, so a log service can count every `order shipped` line. Next in the guide: [Write your first log line](/packages/logger/guide#write-your-first-log-line).

## Built on

kitr adds the request-scoped child logger, the pretty format, timing, run-time level changes and the devtools mirror.

## Problems it solves

- **Unreadable logs in development, unsearchable logs in production.** [Choose the output format](/packages/logger/guide#choose-the-output-format).
- **Repeating the same fields on every line.** [Add fields to every line](/packages/logger/guide#add-fields-to-every-line).
- **Lines you cannot tie to a request.** [Log during a request](/packages/logger/guide#log-during-a-request).
- **Errors logged as `[object Object]`.** [Log an error](/packages/logger/guide#log-an-error).
- **Timing by hand.** [Time an operation](/packages/logger/guide#time-an-operation).
- **Restarting to see debug output.** [Change the level at run time](/packages/logger/guide#change-the-level-at-run-time).

## Further reading

- [Guide](/packages/logger/guide).
- [API reference](/packages/logger/api).
- [Server](/packages/server).
- [Monitoring](/packages/monitoring) and [Devtools](/packages/devtools).
- [Configuration](/docs/configuration).
