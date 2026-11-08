---
title: Overview
description: Run work in the background or on a schedule, with retries when it fails.
order: 0
---

# Jobs

Some work should not keep a request waiting: emailing an invoice, generating a PDF, syncing orders with a payment provider, pruning expired sessions at 3am. Done inline, it makes responses slow and failures fatal. Done with a bare `setTimeout` or a cron entry, it has no retries, no timeout and no record of what ran.

`@kitr/jobs` hands that work to a background worker that retries, times out and runs on a schedule.

## What it is

`@kitr/jobs` lets you define a job with `defineJob` and a typed payload, dispatch it from a controller or action with `useJobs()`, and have the worker run it with retries, exponential backoff, a timeout and an optional cron or interval schedule. The queue lives in the server's memory by default, which suits one process; a driver moves it to a shared store for several servers or for jobs that must survive a restart.

It runs on the server only, with no dependencies beyond kitr. For work that must finish before the response, such as charging a card, call the code directly instead of dispatching a job.

## Built on

`@kitr/jobs` is kitr's own, built on the [server](/packages/server) lifecycle: the worker starts with the app and drains before shutdown. Payloads are validated with any [Standard Schema](https://standardschema.dev) library. The queue is a `JobsDriver` with a memory implementation built in; the [Extend](/packages/jobs/guide#extend) section shows a Redis-backed one. Schedules use standard five-field cron expressions, parsed by `cronMatches`, or plain intervals parsed by `parseInterval`. Warnings and failures go to the [logger](/packages/logger), and jobs that keep failing can be reported to [monitoring](/packages/monitoring).

## Problems it solves

- **Slow work inside a request.** Dispatch the job and respond at once; the worker runs it. See [Dispatch your first job](/packages/jobs/guide#dispatch-your-first-job).
- **Untyped payloads.** A job declares its payload schema, so dispatching the wrong shape is a type error and a bad payload is rejected. See [Define a job](/packages/jobs/guide#define-a-job).
- **Work that must happen later.** Delay a job by a duration or until a time. See [Delay a job](/packages/jobs/guide#delay-a-job).
- **Nightly and recurring tasks.** Give a job a cron expression or an interval and the worker runs it on time. See [Run a job on a schedule](/packages/jobs/guide#run-a-job-on-a-schedule).
- **Flaky third parties.** Retries with backoff, then a handler for jobs that keep failing. See [Retry a failing job](/packages/jobs/guide#retry-a-failing-job).
- **Jobs that hang.** A timeout per job frees the worker. See [Time out a stuck job](/packages/jobs/guide#time-out-a-stuck-job).
- **One worker competing with web traffic.** Run the worker in its own process. See [Run the worker in its own process](/packages/jobs/guide#run-the-worker-in-its-own-process).

## Further reading

- [Guide](/packages/jobs/guide): install, configure and every task.
- [API reference](/packages/jobs/api): every export with its signature.
- [Standard Schema](https://standardschema.dev): the schema libraries a job accepts.
- [crontab.guru](https://crontab.guru): a quick reference for the cron expressions schedules use.
- [Mail](/packages/mail), [Logger](/packages/logger) and [Monitoring](/packages/monitoring): what jobs send, where they log, and where failures are reported.
