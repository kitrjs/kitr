---
title: Overview
description: Write readable logs in development and structured logs in production.
order: 0
---

# Logger

When a customer reports that an order never shipped, the logs are where you find out why. In development you want lines you can read at a glance: a colored level, the time, the message. In production you want one JSON object per line so your log service can filter by `orderId` or `requestId`. Most projects get one of the two, and lose the request id somewhere between the middleware and the service that failed.

`@kitr/logger` writes both formats from the same calls and carries the request id on every line.

## What it is

`@kitr/logger` is a small logger with levels, child loggers that carry fields, timing helpers and two output formats. On the server, every request gets a child logger with its request id, so a line written deep in a service still says which request it belonged to. In the browser the same API writes to the console and to the [devtools](/packages/devtools) Log panel. The level can change at run time without a restart.

It has no dependencies and runs on the server and in the browser. It is for lines a developer reads. To be alerted about errors with the user and the steps that led to them, use [monitoring](/packages/monitoring); to count what users do, use [analytics](/packages/analytics).

## Install

```sh
kitr add logger
```

This installs `@kitr/logger`, registers the provider in `kitrrc.ts` and writes `config/logger.ts`. [server](/packages/server) adds it for you. The guide's [Install](/packages/logger/guide#install) section lists every change.

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

Keep the message fixed and put the variable parts in fields, so a log service can count every `order shipped` line and filter by `orderId`. The guide continues from here: [Write your first log line](/packages/logger/guide#write-your-first-log-line).

## Built on

`@kitr/logger` is kitr's own. It writes to the console or to any stream, and its JSON format follows the shape the common collectors expect: one object per line with `level`, `time`, `msg` and your fields. Ship those lines to [Pino](https://getpino.io)-compatible tooling, Datadog, Grafana Loki or any service that reads JSON lines; the guide shows a file and an HTTP sink. kitr adds the request-scoped child logger through the [server](/packages/server), the pretty format for development, timing, run-time level changes and the devtools mirror.

## Problems it solves

- **Unreadable logs in development, unsearchable logs in production.** The pretty format and the JSON format come from the same `logger.info()` call. See [Choose the output format](/packages/logger/guide#choose-the-output-format).
- **Repeating the same fields on every line.** A child logger carries `orderId` or `teamId` into every line it writes. See [Add fields to every line](/packages/logger/guide#add-fields-to-every-line).
- **Lines you cannot tie to a request.** The request logger carries the request id, including into services and jobs the request triggered. See [Log during a request](/packages/logger/guide#log-during-a-request).
- **Errors logged as `[object Object]`.** `logger.error(err)` records the message, the stack and the cause. See [Log an error](/packages/logger/guide#log-an-error).
- **Timing by hand.** Time an operation and log its duration in one call. See [Time an operation](/packages/logger/guide#time-an-operation).
- **Restarting to see debug output.** Raise the level at run time, then lower it again. See [Change the level at run time](/packages/logger/guide#change-the-level-at-run-time).

## Further reading

- [Guide](/packages/logger/guide): install, configure and every task.
- [API reference](/packages/logger/api): every export with its signature.
- [Server](/packages/server): request ids, the request logger and error logging.
- [Monitoring](/packages/monitoring) and [Devtools](/packages/devtools): alerts when something breaks, and the Log panel in development.
- [Configuration](/docs/configuration): how `config/logger.ts` and env variables are loaded.
