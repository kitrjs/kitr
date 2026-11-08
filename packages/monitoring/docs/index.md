---
title: Error monitoring
description: Catch errors in the browser and on the server, and see which user hit them and what they did first.
order: 1
---

# Error monitoring

When something breaks in production, you want to know before a user writes in, with enough context to fix it. `@kitr/monitoring` catches render errors, uncaught errors and failed server requests, adds the signed-in user, tags and breadcrumbs, and sends each report to [Sentry](https://docs.sentry.io/platforms/javascript/), [Better Stack](https://betterstack.com/docs/errors/collecting-errors/sentry-sdk/) or any other service.

> [!SUMMARY]
> Catches errors in the browser and on the server and reports them, with the user and what they did first, to Sentry, Better Stack or your own service. Add it with `kitr add monitoring`; the overview is at [/packages/monitoring](/packages/monitoring).

It runs in the browser and on the server; the provider and its error boundary need React, and a server-only project uses the same API without the provider. For lines you read while debugging, use the [logger](/packages/logger); for counting what users do, use [analytics](/packages/analytics). The examples follow Acme's app at `app.acme.com`.

## Install

```sh
kitr add monitoring
```

<details>
<summary>Everything kitr add changes</summary>

What `kitr add` does depends on whether the project has React. In a project with React (every kit with a web platform):

- Installs `@kitr/monitoring`.
- Adds `'@kitr/monitoring'` to `packages` and `() => import('@kitr/monitoring/provider')` to `providers` in `kitrrc.ts`.
- Declares `VITE_SENTRY_DSN: e.string({ optional: true })` under `public` in `app/env.ts`, and adds `VITE_SENTRY_DSN=` to `.env.example` (and `.env` when it exists).
- Writes `config/monitoring.ts` for the browser (shown in [Configure](#configure)) and regenerates `config/index.ts`.
- Adds a `## kitr: monitoring` section to `AGENTS.md`: what is reported automatically, how to report caught errors, `setUser` on sign-in and sign-out, and the server middleware.

In a server-only project (the `server` kit, or any project with the server package and no React):

- Installs `@kitr/monitoring`.
- Adds `'@kitr/monitoring'` to `packages` in `kitrrc.ts`. It adds no provider, because the provider imports React. See [Report server errors](#report-server-errors) for the two lines that replace it.
- Adds `SENTRY_DSN=` under a `# Monitoring` comment to `.env.example` (and `.env` when it exists).
- Writes `config/monitoring.ts` for the server and regenerates `config/index.ts`.
- Adds a `## kitr: monitoring` section to `AGENTS.md` about the server middleware and `captureException`.

`kitr remove monitoring` reverses the provider, `packages` entry, dependency and `AGENTS.md` steps, and deletes `config/monitoring.ts`. The env variable and its `app/env.ts` entry stay.

</details>

To edit `package.json` without running the package manager, pass `--no-install`:

```sh
kitr add monitoring --no-install
```

The `saas` kit includes monitoring.

## Configure

In a project with React, `kitr add monitoring` writes this file:

```ts
// config/monitoring.ts
import { defineConfig } from '@kitr/monitoring'
import { env } from '#app/env'

/**
 * Reporters: development prints to the console, production sends nowhere until one is added.
 * Pass the SDK module so the right flavour (react, browser, node) is bundled for the environment.
 */
export default defineConfig({
  reporters: [
    // import * as Sentry from '@sentry/react'  (pnpm add @sentry/react)
    // ...(env.VITE_SENTRY_DSN ? [sentry(Sentry, { dsn: env.VITE_SENTRY_DSN })] : []),
    // Better Stack takes the same SDK: betterStack(Sentry, { dsn }) with its DSN.
  ],
  // shouldReport: (error) => !(error instanceof KitrError && error.status < 500),
  tags: { app: env.VITE_APP_NAME },
})
```

In a server-only project it writes this one, with `service` set to the `name` in your `package.json`:

```ts
// config/monitoring.ts
import { defineConfig } from '@kitr/monitoring'

/** Reporters: development prints to the console, production sends nowhere until one is added. */
export default defineConfig({
  reporters: [
    // import * as Sentry from '@sentry/node'  (pnpm add @sentry/node)
    // ...(process.env.SENTRY_DSN ? [sentry(Sentry, { dsn: process.env.SENTRY_DSN })] : []),
    // Better Stack takes the same SDK: betterStack(Sentry, { dsn }) with its DSN.
  ],
  tags: { service: 'acme-api' },
})
```

| Option | Default | Description |
| --- | --- | --- |
| `reporters` | `[]` | Where reports go. With none, the provider uses the console reporter in development and nothing in production. |
| `shouldReport(error, context)` | `defaultShouldReport` | Return `false` to drop an error. The default drops kitr errors with a status below 500 and `AbortError`s. Applies to `captureException` only. |
| `globalHandlers` | `true` | In the browser, report uncaught errors and unhandled promise rejections. |
| `tags` | none | Tags added to every exception and message. The provider adds `environment` (the app's mode: `development`, `production` or `test`) under yours. |
| `debug` | `true` in development | Also print each error to the console. |

| Variable | Used for |
| --- | --- |
| `VITE_SENTRY_DSN` | The Sentry DSN in a project with React. Public, because the browser sends reports. |
| `SENTRY_DSN` | The Sentry DSN in a server-only project. |

Neither variable does anything until you uncomment the reporter line.

## Report your first error

Errors you catch and handle are not reported unless you say so. In a component, read the service with `useService('monitoring')` and call `captureException` in the `catch`:

```tsx
// app/components/projects/import-projects-button.tsx
import { useService } from '@kitr/react'

export function ImportProjectsButton({ file }: { file: File }) {
  const monitoring = useService('monitoring')

  async function importProjects() {
    try {
      const res = await fetch('/api/projects/import', { method: 'POST', body: file })
      if (!res.ok) throw new Error(`Import failed with ${res.status}`)
    } catch (error) {
      monitoring.captureException(error, { extra: { fileName: file.name, size: file.size } })
      alert('That file could not be imported.')
    }
  }

  return (
    <button type="button" onClick={importProjects}>
      Import projects
    </button>
  )
}
```

Make the import fail in development and the console reporter prints it:

```
[monitoring] error Error: Import failed with 500 { fileName: 'projects.csv', size: 18234 }
```

With [devtools](/packages/devtools) open it also appears in the Errors panel. Add a reporter, as below, and the same call sends it to Sentry in production.

## What is reported for you

You do not need `try`/`catch` for these:

| What | Where | How | `source` |
| --- | --- | --- | --- |
| An error thrown while a component renders | Browser | The provider wraps the app in `MonitoringErrorBoundary`, which reports, then rethrows so the router's error screen shows. | `error-boundary` |
| An uncaught error | Browser | A `window` `error` listener, unless `globalHandlers: false`. | `window` |
| A rejected promise nobody handled | Browser | A `window` `unhandledrejection` listener, unless `globalHandlers: false`. | `window` |
| An error thrown by a server route | Server | The `reportErrors` middleware, once you add it. | `server` |

Every report goes through `shouldReport` first. A `KitrError` with a status below 500 (not found, validation, unauthorized) and an aborted `fetch` are dropped by default. The boundary reports a render error once, even when React retries.

## Reporters

A reporter sends reports to one destination. List any number in `reporters`; each report goes to all of them, and a reporter that throws is ignored.

### Sentry in the browser

```sh
pnpm add @sentry/react
```

```ts
// config/monitoring.ts
import * as Sentry from '@sentry/react'
import { defineConfig, sentry } from '@kitr/monitoring'
import { env } from '#app/env'

export default defineConfig({
  reporters: [
    ...(env.VITE_SENTRY_DSN
      ? [sentry(Sentry, { dsn: env.VITE_SENTRY_DSN, release: 'acme-web@1.4.0', tracesSampleRate: 0 })]
      : []),
  ],
  tags: { app: env.VITE_APP_NAME },
})
```

In `.env`:

```sh
VITE_SENTRY_DSN=https://<key>@o123.ingest.sentry.io/456
```

You pass the Sentry module yourself. Every option you give `sentry()` goes to [`Sentry.init`](https://docs.sentry.io/platforms/javascript/guides/react/configuration/options/), which the reporter calls when the service is created.

### Sentry on the server

```sh
pnpm add @sentry/node
```

```ts
// config/monitoring.ts
import * as Sentry from '@sentry/node'
import { defineConfig, sentry } from '@kitr/monitoring'

export default defineConfig({
  reporters: [...(process.env.SENTRY_DSN ? [sentry(Sentry, { dsn: process.env.SENTRY_DSN })] : [])],
  tags: { service: 'acme-api' },
})
```

In `.env`:

```sh
SENTRY_DSN=https://<key>@o123.ingest.sentry.io/789
```

See [Sentry for Node.js](https://docs.sentry.io/platforms/javascript/guides/node/).

> [!WARNING] One config for web and server
> `config/monitoring.ts` is shared, so in a project with both platforms pick the SDK per side or keep one config per platform.

### Better Stack

[Better Stack](https://betterstack.com/docs/errors/collecting-errors/sentry-sdk/) takes reports from the Sentry SDK: install it and give it Better Stack's DSN (Errors, your application, Ingest).

```sh
pnpm add @sentry/react
```

```ts
// config/monitoring.ts
import * as Sentry from '@sentry/react'
import { betterStack, defineConfig } from '@kitr/monitoring'
import { env } from '#app/env'

export default defineConfig({
  reporters: [...(env.VITE_SENTRY_DSN ? [betterStack(Sentry, { dsn: env.VITE_SENTRY_DSN })] : [])],
})
```

In `.env`:

```sh
VITE_SENTRY_DSN=https://<token>@<ingesting-host>/<application-id>
```

`betterStack()` takes the same options as `sentry()`. On the server, use `@sentry/node` and `SENTRY_DSN`.

### Console

```ts
// config/monitoring.ts
import { consoleReporter, defineConfig } from '@kitr/monitoring'

export default defineConfig({ reporters: [consoleReporter()], debug: false })
```

Prints exceptions with `console.error` and messages with `console.info`; breadcrumbs and users are ignored. The provider adds it in development when `reporters` is empty.

> [!WARNING] Duplicate console lines
> If you list it yourself in development, set `debug: false` next to it, or each report prints twice.

### Devtools

The provider adds `devtoolsReporter` whenever [devtools](/packages/devtools) is active; you never list it yourself.

### Memory

`memoryReporter()` keeps reports in arrays for tests. See [Testing](#testing).

## Report a caught error

`captureException(error, context?)` reports an error you handled. The context is optional:

| Field | Description |
| --- | --- |
| `extra` | Any data that helps: ids, sizes, the input that failed. |
| `tags` | Short string values you filter by in Sentry, such as `{ feature: 'billing' }`. Merged over the config `tags`. |
| `level` | `'fatal'`, `'error'`, `'warning'`, `'info'` or `'debug'`. |
| `source` | Where it came from. The built-in sources are `error-boundary`, `window` and `server`. |

```ts
// app/lib/invoices/download-invoice.ts
import type { KitrApp } from '@kitr/kitr/app'

export async function downloadInvoice(app: KitrApp, invoiceNumber: string) {
  const monitoring = app.container.use('monitoring')
  try {
    const res = await fetch(`/api/invoices/${invoiceNumber}.pdf`)
    if (!res.ok) throw new Error(`PDF download failed with ${res.status}`)
    return await res.blob()
  } catch (error) {
    monitoring.captureException(error, {
      tags: { feature: 'billing' },
      extra: { invoiceNumber },
      level: 'warning',
    })
    return null
  }
}
```

Outside React, the service is `app.container.use('monitoring')`.

> [!WARNING] Report once
> Don't report an error and then rethrow it to the error boundary or server middleware: you get two reports. Either handle and report, or let it propagate.

## Send a message

`captureMessage(message, context?)` reports something worth knowing that is not an exception:

```ts
// app/lib/projects/import-limit.ts
import type { KitrApp } from '@kitr/kitr/app'

export function warnImportLimit(app: KitrApp, teamId: string, rows: number) {
  app.container.use('monitoring').captureMessage('project import over the row limit', {
    level: 'warning',
    tags: { feature: 'import' },
    extra: { teamId, rows, limit: 5_000 },
  })
}
```

Messages skip `shouldReport`; every call is sent.

## Identify the user

`setUser(user)` attaches the signed-in user to every report that follows. Call it after sign-in and pass `null` on sign-out:

```ts
// app/lib/auth/session.ts
import type { KitrApp } from '@kitr/kitr/app'

export function onSignedIn(app: KitrApp, user: { id: string; email: string; teamId: string }) {
  app.container.use('monitoring').setUser({ id: user.id, email: user.email, teamId: user.teamId })
}

export function onSignedOut(app: KitrApp) {
  app.container.use('monitoring').setUser(null)
}
```

The user needs an `id`; other fields are optional. Only send what your privacy policy allows; an id alone is often enough.

## Leave breadcrumbs

A breadcrumb is a step on the way to a possible error. Reporters such as Sentry attach the most recent ones to the next report:

```ts
// app/lib/projects/import-projects.ts
import type { KitrApp } from '@kitr/kitr/app'

export async function importProjects(app: KitrApp, file: File) {
  const monitoring = app.container.use('monitoring')
  monitoring.addBreadcrumb({ category: 'import', message: 'file selected', data: { name: file.name } })
  const text = await file.text()
  monitoring.addBreadcrumb({ category: 'import', message: 'parsed CSV', data: { rows: text.split('\n').length } })
  return text
}
```

| Field | Description |
| --- | --- |
| `message` | What happened. Required. |
| `category` | A group, such as `import`, `navigation` or `api`. |
| `level` | Same values as `level` above. |
| `data` | Extra data. |
| `timestamp` | Milliseconds since the epoch. Set to `Date.now()` when left out. |


## Tag reports

Tags are short strings you filter by. Set them in three places, from widest to narrowest:

- `tags` in `config/monitoring.ts`, on every report from the start. The provider adds `environment` with the app's mode.
- `setTag(key, value)` at run time, for something that stays true for the session, such as the team plan.
- `tags` in the context of one call, as in [Report a caught error](#report-a-caught-error).

```ts
// app/lib/teams/team-context.ts
import type { KitrApp } from '@kitr/kitr/app'

export function onTeamSelected(app: KitrApp, team: { id: string; plan: 'free' | 'pro' }) {
  const monitoring = app.container.use('monitoring')
  monitoring.setTag('team', team.id)
  monitoring.setTag('plan', team.plan)
}
```

Per-call tags win over config tags.

## Wrap a function

`wrap(fn, context?)` runs `fn`, reports anything it throws or rejects with, and rethrows. It works for sync and async functions:

```ts
// server/services/invoice-service.ts
import type { Monitoring } from '@kitr/monitoring'

export function totalInvoice(monitoring: Monitoring, lines: Array<{ amount: number }>) {
  return monitoring.wrap(() => lines.reduce((sum, line) => sum + line.amount, 0), {
    tags: { feature: 'billing' },
  })
}

export async function sendInvoice(monitoring: Monitoring, invoiceNumber: string) {
  return monitoring.wrap(
    async () => {
      const res = await fetch(`https://billing.acme.com/invoices/${invoiceNumber}/send`, { method: 'POST' })
      if (!res.ok) throw new Error(`billing API ${res.status}`)
      return res.status
    },
    { extra: { invoiceNumber } },
  )
}
```

Use it for work outside a request or render, such as a timer or queue consumer.

## Ignore expected errors

`shouldReport(error, context)` decides whether `captureException` sends anything. Extend `defaultShouldReport` instead of replacing it:

```ts
// config/monitoring.ts
import { defaultShouldReport, defineConfig } from '@kitr/monitoring'
import { env } from '#app/env'

export default defineConfig({
  reporters: [],
  shouldReport(error, context) {
    // Browser extensions throw from their own scripts; they are not our bugs.
    if (context?.source === 'window' && error instanceof Error && /extension:\/\//.test(error.stack ?? ''))
      return false
    return defaultShouldReport(error)
  },
  tags: { app: env.VITE_APP_NAME },
})
```

```ts
// scripts/should_report.ts
import { KitrError } from '@kitr/kitr/app'
import { defaultShouldReport } from '@kitr/monitoring'

defaultShouldReport(KitrError.notFound('Project')) // => false
defaultShouldReport(new KitrError('INTERNAL', 'db down')) // => true
defaultShouldReport(Object.assign(new Error('aborted'), { name: 'AbortError' })) // => false
defaultShouldReport(new Error('Import failed with 500')) // => true
```

## Show a fallback for a render error

To keep the rest of a page working when one widget fails, put your own `MonitoringErrorBoundary` around it with a `fallback`:

```tsx
// app/components/invoices/invoice-chart-section.tsx
import { MonitoringErrorBoundary } from '@kitr/monitoring/provider'
import { useService } from '@kitr/react'
import { InvoiceChart } from '#app/components/invoices/invoice-chart'

export function InvoiceChartSection() {
  const monitoring = useService('monitoring')
  return (
    <MonitoringErrorBoundary
      monitoring={monitoring}
      fallback={(error, reset) => (
        <div role="alert">
          <p>The chart could not be drawn: {(error as Error).message}</p>
          <button type="button" onClick={reset}>
            Try again
          </button>
        </div>
      )}
    >
      <InvoiceChart />
    </MonitoringErrorBoundary>
  )
}
```

| Prop | Description |
| --- | --- |
| `monitoring` | The service to report to. |
| `fallback` | A node, or `(error, reset) => node`. `reset()` clears the error and renders the children again. Left out, the boundary rethrows after reporting. |
| `children` | What it guards. |


## Report server errors

On the server, `reportErrors(monitoring)` from `@kitr/monitoring/server` is middleware that reports every error a route throws, with the method, URL and request id, then rethrows so kitr's error handler still sends the response.

In a project with React, the provider binds the service on the server too. The app boots on the first request, so resolve the service per request:

```ts
// server/main.ts
import { mountRoutes } from '@kitr/api'
import { reportErrors } from '@kitr/monitoring/server'
import { createServer } from '@kitr/server'
import { config } from '../config'
import rc from '../kitrrc'
import { routes } from '#server/routes'

export const server = createServer({ providers: rc.providers, config })
mountRoutes(server, routes)
// Report thrown errors before kitr's error handler answers.
server.use((event, next) => reportErrors(server.app.container.use('monitoring'))(event, next))
```

In a server-only project there is no provider, so create the service from the config and bind it yourself. Then `app.container.use('monitoring')` works everywhere, as `AGENTS.md` says:

```ts
// server/main.ts
import { mountRoutes } from '@kitr/api'
import { createMonitoring } from '@kitr/monitoring'
import { reportErrors } from '@kitr/monitoring/server'
import { createServer } from '@kitr/server'
import { config } from '../config'
import rc from '../kitrrc'
import { routes } from '#server/routes'

export const server = createServer({ providers: rc.providers, config })
mountRoutes(server, routes)

const monitoring = createMonitoring(config.monitoring)
server.app.container.value('monitoring', monitoring)
server.use(reportErrors(monitoring))
```

A route that throws `new Error('db down')` while handling `GET /api/projects` is reported as:

```ts
// => error: Error('db down')
// => context: {
//   source: 'server',
//   extra: { method: 'GET', url: 'https://app.acme.com/api/projects', requestId: '9b2f6c1e-...' },
//   tags: { service: 'acme-api' },
// }
```

The client still gets kitr's normal 500 response; a route that throws `KitrError.notFound()` answers 404 and is not reported.

## Flush before the process exits

Reporters send in the background. In a script, a serverless function or a shutdown hook, wait for them with `flush(timeoutMs?)` before the process ends:

```ts
// scripts/rebuild_invoices.ts
import { createMonitoring } from '@kitr/monitoring'
import { config } from '../config'

const monitoring = createMonitoring(config.monitoring)
try {
  throw new Error('invoice INV-2026-007 has no lines')
} catch (error) {
  monitoring.captureException(error, { tags: { job: 'rebuild_invoices' } })
} finally {
  await monitoring.flush(2_000)
}
```

`flush` waits up to the timeout (2 seconds by default) and never throws.

## Testing

`memoryReporter()` keeps every report in arrays. Boot an app with the provider and a memory reporter, run the code, and assert on what was reported:

```ts
// test/download-invoice.test.ts
import { memoryReporter } from '@kitr/monitoring'
import monitoringProvider from '@kitr/monitoring/provider'
import { createTestApp } from '@kitr/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadInvoice } from '#app/lib/invoices/download-invoice'

afterEach(() => vi.unstubAllGlobals())

describe('downloadInvoice', () => {
  it('reports a failed download with the invoice number', async () => {
    const reporter = memoryReporter()
    const app = await createTestApp({
      providers: [monitoringProvider],
      config: { monitoring: { reporters: [reporter], globalHandlers: false } },
    })
    vi.stubGlobal('fetch', async () => new Response('nope', { status: 503 }))

    expect(await downloadInvoice(app, 'INV-2026-007')).toBeNull()

    expect(reporter.exceptions).toHaveLength(1)
    const [report] = reporter.exceptions
    expect((report?.error as Error).message).toBe('PDF download failed with 503')
    expect(report?.context).toMatchObject({
      level: 'warning',
      extra: { invoiceNumber: 'INV-2026-007' },
      tags: { environment: 'test', feature: 'billing' },
    })
  })
})
```

| Field | Holds |
| --- | --- |
| `exceptions` | `{ error, context }` for each reported exception, after `shouldReport` and with tags merged. |
| `messages` | The text of each `captureMessage`. |
| `user` | The last value passed to `setUser`. |

Breadcrumbs and `setTag` values are not kept. Without the provider, `createMonitoring({ reporters: [reporter] })` gives the same service with no `environment` tag; use it to test the server middleware:

```ts
// test/report-errors.test.ts
import { createMonitoring, memoryReporter } from '@kitr/monitoring'
import { reportErrors } from '@kitr/monitoring/server'
import { expect, it } from 'vitest'

it('reports a failed route with its request id', async () => {
  const reporter = memoryReporter()
  const middleware = reportErrors(createMonitoring({ reporters: [reporter] }))
  const event = {
    req: { method: 'GET', url: 'https://app.acme.com/api/projects' },
    context: { kitr: { requestId: 'req_1' } },
  }

  await expect(
    middleware(event, async () => {
      throw new Error('db down')
    }),
  ).rejects.toThrow('db down')

  expect(reporter.exceptions[0]?.context).toEqual({
    source: 'server',
    extra: { method: 'GET', url: 'https://app.acme.com/api/projects', requestId: 'req_1' },
  })
})
```

## Extend

To send reports to a service kitr has no reporter for, write your own. A reporter is an object with a `name` and a `captureException` method. Every other method is optional: `init`, `captureMessage`, `setUser`, `addBreadcrumb`, `setTag` and `flush`. See [`Reporter`](/packages/monitoring/api#reporter).

This one posts each exception to an internal endpoint, with the user and the last ten breadcrumbs:

```ts
// app/monitoring/acme-reporter.ts
import type { Breadcrumb, MonitoringUser, Reporter } from '@kitr/monitoring'

export function acmeReporter(options: { endpoint: string }): Reporter {
  let user: MonitoringUser | null = null
  const crumbs: Breadcrumb[] = []
  const pending = new Set<Promise<unknown>>()

  return {
    name: 'acme',
    setUser: (next) => {
      user = next
    },
    addBreadcrumb: (crumb) => {
      crumbs.push(crumb)
      if (crumbs.length > 10) crumbs.shift()
    },
    captureException(error, context) {
      const body = JSON.stringify({
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        user,
        breadcrumbs: crumbs,
        ...context,
      })
      const sent = fetch(options.endpoint, { method: 'POST', body, keepalive: true })
      pending.add(sent)
      void sent.finally(() => pending.delete(sent))
    },
    async flush(timeoutMs = 2_000) {
      const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), timeoutMs))
      return Promise.race([Promise.all(pending).then(() => true), timeout])
    },
  }
}
```

Register it in `config/monitoring.ts` next to any others:

```ts
// config/monitoring.ts
import { defineConfig } from '@kitr/monitoring'
import { acmeReporter } from '#app/monitoring/acme-reporter'
import { env } from '#app/env'

export default defineConfig({
  reporters: [acmeReporter({ endpoint: 'https://errors.acme.com/ingest' })],
  tags: { app: env.VITE_APP_NAME },
})
```

`captureException` must not throw or block: send in the background. A failing endpoint loses its reports silently.

## Devtools

With [devtools](/packages/devtools) installed, the provider registers an Errors panel and a devtools reporter in development.

- The panel lists exceptions, messages and `setUser` calls, newest first, with source, stack and `extra` data, and the last 20 breadcrumbs below.
- Clear errors empties the list; Throw a test error checks the global handler without writing code.

## Next steps

- [Monitoring API reference](/packages/monitoring/api): every export with its signature.
- [Logger](/packages/logger): lines for debugging, next to reports for fixing.
- [Auth](/packages/auth): where to call `setUser` after sign-in.
