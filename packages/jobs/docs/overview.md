---
title: Overview
description: Run work in the background or on a schedule, with retries when it fails.
order: 0
---

# Jobs

## What it is

`@kitr/jobs` runs work in the background. Define a job with `defineJob` and a typed payload, dispatch it from a controller or action, and the worker runs it with retries, timeouts and an optional schedule.

Runs on the server only. For work that must finish before the response, call the code directly.

## Install

```sh
kitr add jobs
```

Adds `@kitr/jobs`, its provider, `config/jobs.ts` and an example job. Adds [server](/packages/server) first if missing. [Every change](/packages/jobs/guide#install).

## Quick start

Generate a job with `kitr make:job generate-invoice`:

```ts
// server/jobs/generate_invoice.ts
import { defineJob } from '@kitr/jobs'
import { z } from 'zod'

export const generateInvoice = defineJob('generate_invoice', {
  schema: z.object({ teamId: z.string(), month: z.string().regex(/^\d{4}-\d{2}$/) }),
  retries: 3,
  async run({ teamId, month }, { attempt }) {
    // Load the team's usage, render the PDF, store it.
    return { invoiceNumber: `INV-${month}-${teamId}`, attempt }
  },
})
```

List it in `config/jobs.ts` next to the example, then dispatch it from a controller. `dispatch()` checks the payload, queues the job and resolves with its id straight away:

```ts
// server/controllers/invoices_controller.ts
import type { HttpContext } from '@kitr/api'
import { useJobs } from '@kitr/jobs'
import { generateInvoice } from '#server/jobs/generate_invoice'

export default class InvoicesController {
  async store({ app, params, response }: HttpContext<{ teamId: string }>) {
    const jobId = await useJobs(app).dispatch(generateInvoice, { teamId: params.teamId, month: '2026-10' })
    return response.json({ jobId }, { status: 202 })
    // => { "jobId": "3f0c9a52-6b1e-4d7a-9a51-0e2f8c1d7b44" }
  }
}
```

The request answers at once with the job id. The worker picks the job up within half a second and retries it up to three times. A bad payload throws before anything is queued. Next in the guide: [Dispatch your first job](/packages/jobs/guide#dispatch-your-first-job).

## Built on

kitr adds the typed payload, retries with backoff, timeouts, cron and interval schedules, a memory queue and a `JobsDriver` interface for Redis.

## Problems it solves

- **Slow work inside a request.** [Dispatch your first job](/packages/jobs/guide#dispatch-your-first-job).
- **Untyped payloads.** [Define a job](/packages/jobs/guide#define-a-job).
- **Work that must happen later.** [Delay a job](/packages/jobs/guide#delay-a-job).
- **Nightly and recurring tasks.** [Run a job on a schedule](/packages/jobs/guide#run-a-job-on-a-schedule).
- **Flaky third parties.** [Retry a failing job](/packages/jobs/guide#retry-a-failing-job).
- **Jobs that hang.** [Time out a stuck job](/packages/jobs/guide#time-out-a-stuck-job).
- **One worker competing with web traffic.** [Run the worker in its own process](/packages/jobs/guide#run-the-worker-in-its-own-process).

## Further reading

- [Guide](/packages/jobs/guide).
- [API reference](/packages/jobs/api).
- [Standard Schema](https://standardschema.dev).
- [crontab.guru](https://crontab.guru).
- [Mail](/packages/mail), [Logger](/packages/logger) and [Monitoring](/packages/monitoring).
