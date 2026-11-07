---
title: Error monitoring
description: Catch errors in the browser and on the server, and see which user hit them and what they did first.
order: 1
---

# Error monitoring

When something breaks in production, you want to know before a user writes in, and you want enough context to fix it: who it happened to, which page they were on and what they did just before. `kitr/monitoring` catches errors in the browser and on the server and sends them to [Sentry](https://sentry.io) or any other service through one small API.

## Install

```sh
kitr add monitoring
```

It writes `config/monitoring.ts` and adds an optional `VITE_SENTRY_DSN` (or `SENTRY_DSN` in a server-only project) to your env.

Until you add a reporter, development prints errors to the console and to [devtools](/packages/devtools), and production sends them nowhere.

## Send errors to Sentry

```sh
pnpm add @sentry/react
```

```ts
// config/monitoring.ts
import * as Sentry from '@sentry/react'
import { defineConfig, sentry } from 'kitr/monitoring'
import { env } from '#app/env'

export default defineConfig({
  reporters: [...(env.VITE_SENTRY_DSN ? [sentry(Sentry, { dsn: env.VITE_SENTRY_DSN })] : [])],
  tags: { app: env.VITE_APP_NAME },
})
```

You pass the Sentry module yourself so the right one is bundled: `@sentry/react` in the browser, `@sentry/node` on the server.

| Option | Default | Description |
| --- | --- | --- |
| `reporters` | none | Where errors go. `sentry()`, `consoleReporter()` and `memoryReporter()` are built in. |
| `shouldReport(error, context)` | drops kitr errors below 500 | Return `false` to ignore an error. |
| `globalHandlers` | `true` | Catch uncaught errors and unhandled promise rejections in the browser. |
| `tags` | none | Added to every report, such as the release. |
| `debug` | development | Print to the console as well. |

## What's caught for you

- Errors thrown while a component renders. The provider wraps the app in an error boundary that reports them, then lets the router's error screen show.
- Uncaught errors and rejected promises in the browser.
- Errors in server routes, once you add the middleware below.

Expected failures, like a 404 or a validation error, are not incidents, so they are dropped by default.

## Report things yourself

```tsx
import { useService } from 'kitr/react'

const monitoring = useService('monitoring')

try {
  await importCsv(file)
} catch (error) {
  monitoring.captureException(error, { extra: { fileName: file.name } })
  showToast('That file could not be imported')
}
```

| Method | Use it for |
| --- | --- |
| `captureException(error, context)` | An error you caught and handled. |
| `captureMessage(message, context)` | Something worth knowing that isn't an error. |
| `setUser({ id, email })` | After sign-in. Pass `null` on sign-out. |
| `addBreadcrumb({ category, message })` | Steps leading up to a possible error. |
| `wrap(fn, context)` | Run `fn`, and report and rethrow if it fails. |

Outside React, use `app.container.use('monitoring')`.

## On the server

```ts
// server/main.ts
import { reportErrors } from 'kitr/monitoring/server'

server.use(reportErrors(app.container.use('monitoring')))
```

Every error thrown by a route is reported with its method, URL and request id, and then kitr's error handler sends the response as usual.
