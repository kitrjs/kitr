---
title: Monitoring
description: Catch errors in the browser and on the server, and see which user hit them and what they did first.
order: 1
---

# Monitoring

`captureException`, breadcrumbs, user context and tags behind one API, with reporters for Sentry and the console and room for your own. On the client, window errors, unhandled rejections and render errors are captured by the provider's error boundary; on the server, `reportErrors` middleware reports every thrown error with the method, URL and request id.

## Install

```sh
kitr add monitoring
```

```ts
// config/monitoring.ts
import { defineConfig, sentry } from 'kitr/monitoring'
import * as Sentry from '@sentry/react'
import { env } from '#app/env'

export default defineConfig({
  reporters: env.VITE_SENTRY_DSN ? [sentry(Sentry, { dsn: env.VITE_SENTRY_DSN })] : [],
  tags: { app: env.VITE_APP_NAME, release: env.VITE_APP_VERSION },
  // shouldReport: (error) => !(error instanceof KitrError && error.status < 500),
})
```

Expected failures (kitr errors under 500, aborted requests) are dropped by default. Development also logs to the console and the devtools Errors panel.

## Use it

```ts
const monitoring = app.container.use('monitoring')
monitoring.setUser({ id: user.id, email: user.email }) // after sign-in; setUser(null) on sign-out
monitoring.addBreadcrumb({ category: 'checkout', message: 'payment started' })
try {
  await pay()
} catch (error) {
  monitoring.captureException(error, { extra: { orderId } })
}
```

`monitoring.wrap(fn)` reports and rethrows. On the server:

```ts
import { reportErrors } from 'kitr/monitoring/server'
server.use(reportErrors(app.container.use('monitoring')))
```

## Reporters

A reporter is `{ name, captureException, captureMessage?, setUser?, addBreadcrumb?, setTag?, flush? }`. `consoleReporter()` prints, `memoryReporter()` records for tests. With [Consent](/packages/consent) you can gate reports behind a category.
