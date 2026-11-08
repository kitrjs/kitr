---
title: Overview
description: Catch errors in the browser and on the server, and see which user hit them and what they did first.
order: 0
---

# Error monitoring

When something breaks in production, you want to know before a user writes in, and you want enough context to fix it: who it happened to, which page they were on and what they did beforehand. Dropping in a vendor SDK gets you the stack trace. Getting the user, the route, the request id and the breadcrumbs attached takes wiring in every package.

`@kitr/monitoring` does that wiring once and sends each report to the service you choose.

## What it is

`@kitr/monitoring` catches render errors, uncaught errors, unhandled rejections and failed server requests. It adds the signed-in user, tags and breadcrumbs, filters out expected errors, and hands each report to a reporter. An error boundary shows a fallback for render errors. `reportErrors` on the server attaches the request id and the route. In development, reports show in the [devtools](/packages/devtools) Errors panel instead of leaving the machine.

It runs in the browser and on the server. The provider and its error boundary need React; a server-only project uses the same API without the provider. It is for failures someone should fix. For lines a developer reads while debugging, use the [logger](/packages/logger); for counting what users do, use [analytics](/packages/analytics).

## Install

```sh
kitr add monitoring
```

This installs `@kitr/monitoring`, registers the provider in `kitrrc.ts`, writes `config/monitoring.ts` and adds `VITE_SENTRY_DSN` (or `SENTRY_DSN` in a server-only project) to `app/env.ts` and `.env.example`. The guide's [Install](/packages/monitoring/guide#install) section lists every change.

## Quick start

Uncaught errors are reported on their own. For an error you catch and handle, read the service and call `captureException` in the `catch`:

```tsx
// app/features/projects/import-projects-button.tsx
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

Make the import fail in development and the console reporter prints the report:

```
[monitoring] error Error: Import failed with 500 { fileName: 'projects.csv', size: 18234 }
```

With [devtools](/packages/devtools) open, the report also appears in the Errors panel with its stack and extra data. Set `VITE_SENTRY_DSN` and the same call sends it to Sentry in production. The guide continues from here: [Report your first error](/packages/monitoring/guide#report-your-first-error).

## Built on

Reports go through a `Reporter`. Three are built in:

| Reporter | Built on | Use it for |
| --- | --- | --- |
| `sentry()` | [Sentry for JavaScript](https://docs.sentry.io/platforms/javascript/) | Production. |
| `devtoolsReporter` | The devtools hub | Development. |
| `memoryReporter` | An array | Tests. |

kitr adds the global handlers, the React error boundary, user and breadcrumb context shared across packages, `defaultShouldReport` for ignoring expected errors, server middleware, and the `Reporter` interface so any other service plugs in with one function.

## Problems it solves

- **Errors nobody sees.** Uncaught errors, rejections and render failures are reported automatically. See [What is reported for you](/packages/monitoring/guide#what-is-reported-for-you).
- **Reports without context.** The user from [auth](/packages/auth), tags and breadcrumbs ride along with each report. See [Identify the user](/packages/monitoring/guide#identify-the-user) and [Leave breadcrumbs](/packages/monitoring/guide#leave-breadcrumbs).
- **A white screen on a render error.** The error boundary shows a fallback and reports the error. See [Show a fallback for a render error](/packages/monitoring/guide#show-a-fallback-for-a-render-error).
- **Noise from expected failures.** A 404 or a cancelled request is not a bug; filter them out. See [Ignore expected errors](/packages/monitoring/guide#ignore-expected-errors).
- **Server errors with no request id.** `reportErrors` attaches the route and request id from [server](/packages/server). See [Report server errors](/packages/monitoring/guide#report-server-errors).
- **Reports lost on shutdown.** Flush before the process exits. See [Flush before the process exits](/packages/monitoring/guide#flush-before-the-process-exits).

## Further reading

- [Guide](/packages/monitoring/guide): install, configure and every task.
- [API reference](/packages/monitoring/api): every export with its signature.
- [Sentry for JavaScript](https://docs.sentry.io/platforms/javascript/): the SDK behind the `sentry()` reporter.
- [Logger](/packages/logger), [Devtools](/packages/devtools) and [Auth](/packages/auth): debugging lines, the Errors panel, and where to call `setUser`.
