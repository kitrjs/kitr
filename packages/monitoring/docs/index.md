---
title: Error monitoring
description: Catch errors in the browser and on the server, and see which user hit them and what they did first.
order: 1
---

# Error monitoring

When something breaks in production, you want to know before a user writes in, and you want enough context to fix it: who it happened to, which page they were on and what they did beforehand. `kitr/monitoring` catches render errors, uncaught errors and failed server requests, adds the signed-in user, tags and breadcrumbs, and sends each report to [Sentry](https://docs.sentry.io/platforms/javascript/) or any other service through one small API.

The examples on this page follow one scenario: Acme's app at `app.acme.com`, where Ada imports projects from a CSV file, Grace manages her team's invoices, and Linus is on call when a report comes in.

`kitr/monitoring` runs in the browser and on the server. The provider and its error boundary need React; a server-only project uses the same API without the provider. It is for failures someone should fix. For lines a developer reads while debugging, use the [logger](/packages/logger); for counting what users do, use [analytics](/packages/analytics).

## Install

```sh
kitr add monitoring
```

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

`kitr add monitoring` asks no questions. To edit `package.json` without running the package manager, pass the global flag:

```sh
kitr add monitoring --no-install
```

The `saas` kit includes monitoring.

`kitr remove monitoring` reverses the provider, `packages` entry, dependency and `AGENTS.md` steps, and deletes `config/monitoring.ts`. The env variable and its `app/env.ts` entry stay.

## Configure

In a project with React, `kitr add monitoring` writes this file:

```ts
// config/monitoring.ts
import { defineConfig } from 'kitr/monitoring'
import { env } from '#app/env'

/**
 * Reporters: development prints to the console, production sends nowhere until one is added.
 * Pass the SDK module so the right flavour (react, browser, node) is bundled for the environment.
 */
export default defineConfig({
  reporters: [
    // import * as Sentry from '@sentry/react'  (pnpm add @sentry/react)
    // ...(env.VITE_SENTRY_DSN ? [sentry(Sentry, { dsn: env.VITE_SENTRY_DSN })] : []),
  ],
  // shouldReport: (error) => !(error instanceof KitrError && error.status < 500),
  tags: { app: env.VITE_APP_NAME },
})
```

In a server-only project it writes this one, with `service` set to the `name` in your `package.json`:

```ts
// config/monitoring.ts
import { defineConfig } from 'kitr/monitoring'

/** Reporters: development prints to the console, production sends nowhere until one is added. */
export default defineConfig({
  reporters: [
    // import * as Sentry from '@sentry/node'  (pnpm add @sentry/node)
    // ...(process.env.SENTRY_DSN ? [sentry(Sentry, { dsn: process.env.SENTRY_DSN })] : []),
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
| `debug` | in development, when `reporters` is set | Also print each exception and message to the console with a `[monitoring]` prefix. Off when the provider falls back to the console reporter, which already prints them. |

| Variable | Used for |
| --- | --- |
| `VITE_SENTRY_DSN` | The Sentry DSN in a project with React. Public, because the browser sends reports. |
| `SENTRY_DSN` | The Sentry DSN in a server-only project. |

Neither variable does anything until you uncomment the reporter line. Until then, development prints errors to the console and [devtools](/packages/devtools), and production sends them nowhere.

## Report your first error

Errors you catch and handle are not reported unless you say so. In a component, read the service with `useService('monitoring')` and call `captureException` in the `catch`:

```tsx
// app/features/projects/import-projects-button.tsx
import { useService } from 'kitr/react'

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

Make the import fail in development and the console reporter prints the report:

```
[monitoring] error Error: Import failed with 500 { fileName: 'projects.csv', size: 18234 }
```

With [devtools](/packages/devtools) open, the report also appears in the Errors panel with its stack and extra data. Add a reporter, as in the next section, and the same call sends it to Sentry in production.

## What is reported for you

You do not need `try`/`catch` for these:

| What | Where | How | `source` |
| --- | --- | --- | --- |
| An error thrown while a component renders | Browser | The provider wraps the app in `MonitoringErrorBoundary`, which reports, then rethrows so the router's error screen shows. | `error-boundary` |
| An uncaught error | Browser | A `window` `error` listener, unless `globalHandlers: false`. | `window` |
| A rejected promise nobody handled | Browser | A `window` `unhandledrejection` listener, unless `globalHandlers: false`. | `window` |
| An error thrown by a server route | Server | The `reportErrors` middleware, once you add it. | `server` |

Every report goes through `shouldReport` first. Expected failures are not incidents: a `KitrError` with a status below 500 (not found, validation, unauthorized) and an aborted `fetch` are dropped by default.

React retries a failed render, and StrictMode renders twice, so one render error can throw several times. The boundary reports it once.

## Reporters

A reporter sends reports to one destination. List any number in `reporters`; each report goes to all of them. A reporter that throws is ignored, so a broken one never breaks your app.

### Sentry in the browser

```sh
pnpm add @sentry/react
```

```ts
// config/monitoring.ts
import * as Sentry from '@sentry/react'
import { defineConfig, sentry } from 'kitr/monitoring'
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

You pass the Sentry module yourself, so the bundle contains `@sentry/react` in the browser and nothing kitr chose for you. Every option you pass to `sentry()` (`dsn`, `environment`, `release`, `tracesSampleRate` and any other) goes to [`Sentry.init`](https://docs.sentry.io/platforms/javascript/guides/react/configuration/options/), which the reporter calls when the monitoring service is created.

### Sentry on the server

```sh
pnpm add @sentry/node
```

```ts
// config/monitoring.ts
import * as Sentry from '@sentry/node'
import { defineConfig, sentry } from 'kitr/monitoring'

export default defineConfig({
  reporters: [...(process.env.SENTRY_DSN ? [sentry(Sentry, { dsn: process.env.SENTRY_DSN })] : [])],
  tags: { service: 'acme-api' },
})
```

In `.env`:

```sh
SENTRY_DSN=https://<key>@o123.ingest.sentry.io/789
```

See [Sentry for Node.js](https://docs.sentry.io/platforms/javascript/guides/node/). In a project with both a web and a server platform, `config/monitoring.ts` is shared, so pick the SDK per side or keep one config per platform.

The reporter maps each call to the SDK: `captureException` and `captureMessage` with your `tags`, `extra` and `level` (messages default to `info`), `setUser`, `addBreadcrumb`, `setTag` and `flush`.

### Console

```ts
// config/monitoring.ts
import { consoleReporter, defineConfig } from 'kitr/monitoring'

export default defineConfig({ reporters: [consoleReporter()], debug: false })
```

Prints exceptions with `console.error('[monitoring]', source, error, extra)` and messages with `console.info`. Breadcrumbs and users are ignored. No env variables. The provider adds it in development when `reporters` is empty, and leaves `debug` off then. When you list it yourself in development, set `debug: false` next to it, or each report prints twice.

### Devtools

`devtoolsReporter(hub)` sends exceptions and messages to the devtools `errors` channel and breadcrumbs to `breadcrumbs`. The provider adds it for you whenever [devtools](/packages/devtools) is active; you never list it yourself.

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
// app/features/invoices/download-invoice.ts
import type { KitrApp } from 'kitr/app'

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

Outside React, the service is `app.container.use('monitoring')`. Don't report an error and then rethrow it to a place that reports it again, such as the error boundary or the server middleware: you get two reports for one failure. Either handle and report, or let it propagate.

## Send a message

`captureMessage(message, context?)` reports something worth knowing that is not an exception:

```ts
// app/features/projects/import-limit.ts
import type { KitrApp } from 'kitr/app'

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

`setUser(user)` attaches the signed-in user to every report that follows, so Linus can see that Ada hit the error and contact her. Call it after sign-in and pass `null` on sign-out:

```ts
// app/features/auth/session.ts
import type { KitrApp } from 'kitr/app'

export function onSignedIn(app: KitrApp, user: { id: string; email: string; teamId: string }) {
  app.container.use('monitoring').setUser({ id: user.id, email: user.email, teamId: user.teamId })
}

export function onSignedOut(app: KitrApp) {
  app.container.use('monitoring').setUser(null)
}
```

The user needs an `id`; `email`, `username` and any other field are optional. Only send what your privacy policy allows. An id alone is often enough to look the person up.

## Leave breadcrumbs

A breadcrumb is a step on the way to a possible error. Reporters that support them, such as Sentry, attach the most recent ones to the next report:

```ts
// app/features/projects/import-projects.ts
import type { KitrApp } from 'kitr/app'

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

The console and memory reporters ignore breadcrumbs; devtools lists them under Breadcrumbs.

## Tag reports

Tags are short strings you filter by. Set them in three places, from widest to narrowest:

- `tags` in `config/monitoring.ts`, on every report from the start. The provider adds `environment` with the app's mode.
- `setTag(key, value)` at run time, for something that stays true for the session, such as the team plan.
- `tags` in the context of one call, as in [Report a caught error](#report-a-caught-error).

```ts
// app/features/teams/team-context.ts
import type { KitrApp } from 'kitr/app'

export function onTeamSelected(app: KitrApp, team: { id: string; plan: 'free' | 'pro' }) {
  const monitoring = app.container.use('monitoring')
  monitoring.setTag('team', team.id)
  monitoring.setTag('plan', team.plan)
}
```

`setTag` is passed to reporters that keep their own scope, such as Sentry. The config tags and per-call tags are merged into each report by `kitr/monitoring` itself, with per-call tags winning.

## Wrap a function

`wrap(fn, context?)` runs `fn`, reports anything it throws or rejects with, and rethrows. It works for sync and async functions:

```ts
// server/services/invoice_service.ts
import type { Monitoring } from 'kitr/monitoring'

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

Use it for work that runs outside a request or render, such as a timer or a queue consumer, where nothing else would see the error.

## Ignore expected errors

`shouldReport(error, context)` decides whether `captureException` sends anything. The default is `defaultShouldReport`, which you can extend instead of replacing:

```ts
// config/monitoring.ts
import { defaultShouldReport, defineConfig } from 'kitr/monitoring'
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
import { KitrError } from 'kitr/app'
import { defaultShouldReport } from 'kitr/monitoring'

defaultShouldReport(KitrError.notFound('Project')) // => false
defaultShouldReport(new KitrError('INTERNAL', 'db down')) // => true
defaultShouldReport(Object.assign(new Error('aborted'), { name: 'AbortError' })) // => false
defaultShouldReport(new Error('Import failed with 500')) // => true
```

## Show a fallback for a render error

The provider's boundary rethrows so the router's error component renders. To keep the rest of a page working when one widget fails, put your own `MonitoringErrorBoundary` around it with a `fallback`:

```tsx
// app/features/invoices/invoice-chart-section.tsx
import { MonitoringErrorBoundary } from 'kitr/monitoring/provider'
import { useService } from 'kitr/react'
import { InvoiceChart } from './invoice-chart'

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

The report carries `source: 'error-boundary'` and the React component stack in `extra.componentStack`.

## Report server errors

On the server, `reportErrors(monitoring)` from `kitr/monitoring/server` is middleware that reports every error a route throws, with the method, URL and request id, then rethrows so kitr's error handler still sends the response.

In a project with React, the provider binds the service on the server too. The app boots on the first request, so resolve the service per request:

```ts
// server/main.ts
import { mountRoutes } from 'kitr/api'
import { reportErrors } from 'kitr/monitoring/server'
import { createServer } from 'kitr/server'
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
import { mountRoutes } from 'kitr/api'
import { createMonitoring } from 'kitr/monitoring'
import { reportErrors } from 'kitr/monitoring/server'
import { createServer } from 'kitr/server'
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

The client still gets kitr's normal 500 response. A route that throws `KitrError.notFound()` answers 404 and is not reported. `createMonitoring` used directly does not add the console reporter or the `environment` tag; add them in the config if you want them.

## Flush before the process exits

Reporters send in the background. In a script, a serverless function or a shutdown hook, wait for them with `flush(timeoutMs?)` before the process ends:

```ts
// scripts/rebuild_invoices.ts
import { createMonitoring } from 'kitr/monitoring'
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

`flush` waits for every reporter that has a `flush` method, up to the timeout (2 seconds by default), and never throws.

## Testing

`memoryReporter()` keeps every report in arrays. Boot an app with the provider and a memory reporter, run the code, and assert on what was reported:

```ts
// test/download_invoice.test.ts
import { memoryReporter } from 'kitr/monitoring'
import monitoringProvider from 'kitr/monitoring/provider'
import { createTestApp } from 'kitr/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadInvoice } from '#app/features/invoices/download-invoice'

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

Breadcrumbs and tags set with `setTag` are not kept. To check that an expected error is dropped, assert `expect(reporter.exceptions).toHaveLength(0)`.

Without the provider, `createMonitoring({ reporters: [reporter] })` gives you the same service with no `environment` tag. Use it to test the server middleware without a server:

```ts
// test/report_errors.test.ts
import { createMonitoring, memoryReporter } from 'kitr/monitoring'
import { reportErrors } from 'kitr/monitoring/server'
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

A reporter is an object with a `name` and a `captureException` method. Every other method is optional: `init`, `captureMessage`, `setUser`, `addBreadcrumb`, `setTag` and `flush`. See [`Reporter`](/packages/monitoring/api#reporter).

This one posts each exception to an internal endpoint, with the user and the last ten breadcrumbs:

```ts
// app/monitoring/acme-reporter.ts
import type { Breadcrumb, MonitoringUser, Reporter } from 'kitr/monitoring'

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
import { defineConfig } from 'kitr/monitoring'
import { acmeReporter } from '#app/monitoring/acme-reporter'
import { env } from '#app/env'

export default defineConfig({
  reporters: [acmeReporter({ endpoint: 'https://errors.acme.com/ingest' })],
  tags: { app: env.VITE_APP_NAME },
})
```

`captureException` must not throw or block: return at once and send in the background. The service calls each reporter inside `try`/`catch` and ignores rejected promises, so a failing endpoint loses its reports silently. `init` runs once, when the service is created. Breadcrumbs reach you without the merged tags; exceptions and messages arrive with them.

## Devtools

With [devtools](/packages/devtools) installed, the provider registers an Errors panel and a devtools reporter in development.

- The panel lists captured exceptions, messages and `setUser` calls, newest first, with the time, the `source` as a badge, the stack and the `extra` data. The latest one is expanded.
- Its tab shows a badge with the number of exceptions.
- Below the list, the last 20 breadcrumbs.
- The Clear errors action empties the list. Throw a test error throws an uncaught error, so you can check the global handler without writing code.

## Next steps

- [Monitoring API reference](/packages/monitoring/api): every export with its signature.
- [Sentry for JavaScript](https://docs.sentry.io/platforms/javascript/): the SDK behind the `sentry()` reporter.
- [Logger](/packages/logger): lines for debugging, next to reports for fixing.
- [Server](/packages/server): request ids and kitr's error responses.
- [Devtools](/packages/devtools): the Errors panel in development.
- [Auth](/packages/auth): where to call `setUser` after sign-in.
