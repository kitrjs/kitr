---
title: Overview
description: Catch errors in the browser and on the server, and see which user hit them and what they did first.
order: 0
---

# Error monitoring

## What it is

`@kitr/monitoring` catches render errors, uncaught errors, unhandled rejections and failed server requests, adds the user and breadcrumbs, and hands each report to a reporter such as Sentry. In development, reports show in [devtools](/packages/devtools) instead.

Runs in the browser and on the server. For debugging lines, use the [logger](/packages/logger).

## Install

```sh
kitr add monitoring
```

Adds `@kitr/monitoring`, its provider, `config/monitoring.ts` and `VITE_SENTRY_DSN` in `.env.example`. [Every change](/packages/monitoring/guide#install).

## Quick start

Uncaught errors are reported for you. For one you catch, call `captureException`:

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

The report also appears in the devtools Errors panel. Set `VITE_SENTRY_DSN` and the same call goes to Sentry. Next in the guide: [Report your first error](/packages/monitoring/guide#report-your-first-error).

## Built on

Reports go through a `Reporter`. Three are built in:

| Reporter | Built on | Use it for |
| --- | --- | --- |
| `sentry()` | [Sentry for JavaScript](https://docs.sentry.io/platforms/javascript/) | Production. |
| `devtoolsReporter` | The devtools hub | Development. |
| `memoryReporter` | An array | Tests. |

kitr adds the global handlers, the error boundary, shared user and breadcrumb context, expected-error filtering, server middleware and the `Reporter` interface.

## Problems it solves

- **Errors nobody sees.** [What is reported for you](/packages/monitoring/guide#what-is-reported-for-you).
- **Reports without context.** [auth](/packages/auth).
- **A white screen on a render error.** [Show a fallback for a render error](/packages/monitoring/guide#show-a-fallback-for-a-render-error).
- **Noise from expected failures.** [Ignore expected errors](/packages/monitoring/guide#ignore-expected-errors).
- **Server errors with no request id.** [server](/packages/server).
- **Reports lost on shutdown.** [Flush before the process exits](/packages/monitoring/guide#flush-before-the-process-exits).

## Further reading

- [Guide](/packages/monitoring/guide).
- [API reference](/packages/monitoring/api).
- [Sentry for JavaScript](https://docs.sentry.io/platforms/javascript/).
- [Logger](/packages/logger), [Devtools](/packages/devtools) and [Auth](/packages/auth).
