---
title: API
description: Every export of kitr/jobs, with its signature.
order: 2
---

# API

Every export of `kitr/jobs`, `kitr/jobs/provider`, `kitr/jobs/kitr`, read from the published type definitions. The [guide](/packages/jobs) shows them in use.

## kitr/jobs

### createJobs

```ts
function createJobs(app: KitrApp, config?: JobsConfig): Jobs;
```

Create the jobs service without the provider, for scripts and tests. Takes the same options as `config/jobs.ts`.

### createMemoryJobsDriver

```ts
function createMemoryJobsDriver(): JobsDriver;
```

The default driver: an in-process queue sorted by `runAt`. Lost on restart and not shared between processes.

### cronMatches

```ts
function cronMatches(expression: string, date: Date): boolean;
```

Does a 5-field cron expression (minute hour day month weekday) match this minute?

### defineJob

```ts
function defineJob<Payload = void>(name: string, options: JobOptions<Payload>): Job<Payload>;
```

Declare a background job. List it in `config/jobs.ts`, then queue it with `useJobs(app).dispatch(job, payload)`.

### parseInterval

```ts
function parseInterval(text: string): number;
```

Parse an interval such as `'30s'`, `'5m'` or `'1.5h'` into milliseconds (`'5m'` → 300000). Throws on anything else.

### useJobs

```ts
function useJobs(app: KitrApp): Jobs;
```

The jobs service the provider bound in this app's container. Throws in the browser, where nothing is bound.

### defineConfig

```ts
const defineConfig: <const C extends JobsConfig>(config: C) => C;
```

Types `config/jobs.ts`. Returns its argument unchanged.

### DispatchOptions

```ts
interface DispatchOptions {
  /** Milliseconds from now. */
  delay?: number;
  /** A fixed time instead. */
  at?: Date;
}
```

The third argument of `dispatch()`: when the job may run.

### Job

```ts
interface Job<Payload = unknown> extends JobOptions<Payload> {
  /** Identifies the job in the queue; keep it stable across deploys. */
  name: string;
  /** The payload type, for inference only. */
  readonly __payload?: Payload;
}
```

A job made by `defineJob`: its options plus the name the queue refers to it by.

### JobContext

```ts
interface JobContext {
  /** The app, for the container and services such as `useMailer(app)`. */
  app: KitrApp;
  /** 1 on the first run, then one more per retry. */
  attempt: number;
  /** The id `dispatch()` returned; the same across retries. */
  jobId: string;
  /** Aborts when the attempt passes its `timeout`; pass it to fetch and database calls. */
  signal: AbortSignal;
}
```

The second argument of a job's `run`: the app, the attempt number, the job id and an abort signal.

### JobOptions

```ts
interface JobOptions<Payload> {
  /** Validates the payload when dispatched and when a queue driver hands it back. */
  schema?: StandardSchemaV1<unknown, Payload>;
  /** Retries after a failure. Default 3. */
  retries?: number;
  /** Milliseconds before the first retry, doubled each time. Default 1000. */
  backoff?: number;
  /** Milliseconds a run may take before it is aborted. Default 60 000. */
  timeout?: number;
  /** Run on a schedule: a 5-field cron expression or an `every` interval such as `'5m'`, `'1h'`. */
  schedule?: string | {
    every: string;
  };
  /** The work. Throw to fail the attempt; the return value is what `jobs.run()` resolves with. */
  run(payload: Payload, ctx: JobContext): Promise<unknown> | unknown;
}
```

What `defineJob` takes: the work, plus its schema, retries, backoff, timeout and schedule.

### Jobs

```ts
interface Jobs {
  /** Add jobs after creation, checking their schedules. Returns the service for chaining. */
  register(...jobs: Job<any>[]): Jobs;
  /** Validate the payload and queue the job; resolves with its id. */
  dispatch<P>(job: Job<P>, payload: P, options?: DispatchOptions): Promise<string>;
  /** Run a job now, in this process, with retries; what the worker does. */
  run<P>(job: Job<P>, payload: P, attempt?: number): Promise<unknown>;
  /** Start polling the queue and dispatching scheduled jobs. Idempotent. */
  start(): void;
  /** Stop polling and wait for running jobs to settle. */
  stop(): Promise<void>;
  /** Whether the worker is polling. */
  readonly running: boolean;
  /** The queue driver. */
  readonly driver: JobsDriver;
  /** Known jobs by name. */
  readonly jobs: ReadonlyMap<string, Job<any>>;
}
```

The service the provider binds as `jobs`: queue, run and schedule jobs, and control the worker.

### JobsConfig

```ts
interface JobsConfig {
  /** Jobs the worker knows about (`server/jobs/*.ts`). Dispatching by object registers on the fly. */
  jobs?: Job<any>[];
  /** Where queued jobs wait. Default: the in-memory driver, lost on restart. */
  driver?: JobsDriver;
  /** Jobs run at once per process. Default 5. */
  concurrency?: number;
  /** Milliseconds between queue polls. Default 500. */
  pollInterval?: number;
  /** Start the worker when the server starts. Default true; set false for a separate worker process. */
  worker?: boolean;
  /** Called when a job has used up its retries. */
  onFailed?: (job: QueuedJob, error: unknown) => void;
}
```

The options in `config/jobs.ts`.

### JobsDriver

```ts
interface JobsDriver {
  /** Identifies the driver, such as `memory` or `redis`. */
  name: string;
  /** Store a job; called by `dispatch()` and for each retry. */
  push(job: QueuedJob): Promise<void>;
  /**
   * Jobs whose `runAt` has passed. A driver that implements `ack` should only reserve them here
   * (hide them from other workers) and delete them in `ack`, so a worker that dies mid-job leaves
   * the job to be picked up again. Without `ack`, pulled jobs are gone from the queue.
   */
  pull(now: number, limit: number): Promise<QueuedJob[]>;
  /** Called once a pulled job is done with: it ran, it failed for good, or its retry was queued. */
  ack?(job: QueuedJob): Promise<void>;
  /** How many jobs are waiting. */
  size(): Promise<number>;
  /** Remove every waiting job. */
  clear(): Promise<void>;
}
```

Where queued work waits. The memory driver is the default; Redis or a table are a few methods.

### QueuedJob

```ts
interface QueuedJob {
  /** The id `dispatch()` returned. */
  id: string;
  /** The job's name. */
  name: string;
  /** The payload as validated at dispatch; must survive JSON for shared drivers. */
  payload: unknown;
  /** 1 for the first run, one more per retry. */
  attempt: number;
  /** ms epoch when it may run. */
  runAt: number;
}
```

A job waiting in the queue, as drivers store it and `onFailed` receives it.

## kitr/jobs/provider

### jobsProvider

```ts
const jobsProvider: import("@kitr/core").KitrProvider;
```

Binds `jobs` from `config/jobs.ts`. The worker starts when the server is ready and drains
on shutdown; `worker: false` leaves starting to a separate process (`jobs.start()`).

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
