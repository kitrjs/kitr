import {
  createDefineConfig,
  type KitrApp,
  KitrError,
  type StandardSchemaV1,
  validateSync,
} from '@kitr/core'

export interface JobContext {
  app: KitrApp
  /** 1 on the first run, then one more per retry. */
  attempt: number
  jobId: string
  signal: AbortSignal
}

export interface JobOptions<Payload> {
  /** Validates the payload when dispatched and when a queue driver hands it back. */
  schema?: StandardSchemaV1<unknown, Payload>
  /** Retries after a failure. Default 3. */
  retries?: number
  /** Milliseconds before the first retry, doubled each time. Default 1000. */
  backoff?: number
  /** Milliseconds a run may take before it is aborted. Default 60 000. */
  timeout?: number
  /** Run on a schedule: a 5-field cron expression or an `every` interval such as `'5m'`, `'1h'`. */
  schedule?: string | { every: string }
  run(payload: Payload, ctx: JobContext): Promise<unknown> | unknown
}

export interface Job<Payload = unknown> extends JobOptions<Payload> {
  name: string
  /** The payload type, for inference only. */
  readonly __payload?: Payload
}

export function defineJob<Payload = void>(
  name: string,
  options: JobOptions<Payload>,
): Job<Payload> {
  return { name, ...options }
}

export interface QueuedJob {
  id: string
  name: string
  payload: unknown
  attempt: number
  /** ms epoch when it may run. */
  runAt: number
}

/** Where queued work waits. The memory driver is the default; Redis or a table are a few methods. */
export interface JobsDriver {
  name: string
  push(job: QueuedJob): Promise<void>
  /** Jobs whose `runAt` has passed, removed from the queue. */
  pull(now: number, limit: number): Promise<QueuedJob[]>
  size(): Promise<number>
  clear(): Promise<void>
}

export interface JobsConfig {
  /** Jobs the worker knows about (`server/jobs/*.ts`). Dispatching by object registers on the fly. */
  jobs?: Job<any>[]
  driver?: JobsDriver
  /** Jobs run at once per process. Default 5. */
  concurrency?: number
  /** Milliseconds between queue polls. Default 500. */
  pollInterval?: number
  /** Start the worker when the server starts. Default true; set false for a separate worker process. */
  worker?: boolean
  /** Called when a job has used up its retries. */
  onFailed?: (job: QueuedJob, error: unknown) => void
}

export interface DispatchOptions {
  /** Milliseconds from now. */
  delay?: number
  /** A fixed time instead. */
  at?: Date
}

export interface Jobs {
  register(...jobs: Job<any>[]): Jobs
  dispatch<P>(job: Job<P>, payload: P, options?: DispatchOptions): Promise<string>
  /** Run a job now, in this process, with retries; what the worker does. */
  run<P>(job: Job<P>, payload: P, attempt?: number): Promise<unknown>
  start(): void
  stop(): Promise<void>
  readonly running: boolean
  readonly driver: JobsDriver
  readonly jobs: ReadonlyMap<string, Job<any>>
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    jobs: JobsConfig
  }
  interface ContainerBindings {
    jobs: Jobs
  }
}

export const defineConfig = createDefineConfig<JobsConfig>()

export function createMemoryJobsDriver(): JobsDriver {
  const queue: QueuedJob[] = []
  return {
    name: 'memory',
    async push(job) {
      queue.push(job)
      queue.sort((a, b) => a.runAt - b.runAt)
    },
    async pull(now, limit) {
      const due: QueuedJob[] = []
      while (queue.length && queue[0]!.runAt <= now && due.length < limit) due.push(queue.shift()!)
      return due
    },
    async size() {
      return queue.length
    },
    async clear() {
      queue.length = 0
    },
  }
}

const units: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }

/** `'5m'` → 300000. */
export function parseInterval(text: string): number {
  const m = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)$/.exec(text.trim())
  if (!m) throw new Error(`[kitr/jobs] Bad interval "${text}" (use 30s, 5m, 1h, 1d)`)
  return Number(m[1]) * units[m[2]!]!
}

function cronField(
  field: string,
  min: number,
  max: number,
  expression: string,
): (value: number) => boolean {
  const bad = () => new Error(`[kitr/jobs] Bad cron "${expression}" (field "${field}")`)
  const int = (text: string | undefined) => {
    if (!text || !/^\d+$/.test(text)) throw bad()
    return Number(text)
  }
  const sets = field.split(',').map((part) => {
    const [range, stepText, extra] = part.split('/')
    if (extra !== undefined) throw bad()
    const step = stepText === undefined ? 1 : int(stepText)
    let lo = min
    let hi = max
    if (range !== '*') {
      const [a, b, more] = range!.split('-')
      if (more !== undefined) throw bad()
      lo = int(a)
      hi = b !== undefined ? int(b) : stepText !== undefined ? max : lo
    }
    if (step < 1 || lo < min || hi > max || lo > hi) throw bad()
    return (v: number) => v >= lo && v <= hi && (v - lo) % step === 0
  })
  return (v) => sets.some((s) => s(v))
}

/** Does a 5-field cron expression (minute hour day month weekday) match this minute? */
export function cronMatches(expression: string, date: Date): boolean {
  const fields = expression.trim().split(/\s+/)
  if (fields.length !== 5) throw new Error(`[kitr/jobs] Bad cron "${expression}" (5 fields)`)
  const [mi, h, d, mo, w] = fields as [string, string, string, string, string]
  // Weekday 7 is Sunday too, as in every cron.
  const weekday = cronField(w, 0, 7, expression)
  const dayOk = cronField(d, 1, 31, expression)(date.getDate())
  const weekdayOk = weekday(date.getDay()) || (date.getDay() === 0 && weekday(7))
  // Standard cron: when both day-of-month and weekday are restricted, either may match.
  const day = d !== '*' && w !== '*' ? dayOk || weekdayOk : dayOk && weekdayOk
  return (
    cronField(mi, 0, 59, expression)(date.getMinutes()) &&
    cronField(h, 0, 23, expression)(date.getHours()) &&
    day &&
    cronField(mo, 1, 12, expression)(date.getMonth() + 1)
  )
}

export function createJobs(app: KitrApp, config: JobsConfig = {}): Jobs {
  const driver = config.driver ?? createMemoryJobsDriver()
  const registry = new Map<string, Job<any>>()
  const concurrency = config.concurrency ?? 5
  const active = new Set<Promise<unknown>>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false
  let lastCronMinute = -1
  const intervals = new Map<string, number>()
  const lastRun = new Map<string, number>()
  const log = (level: 'info' | 'warn' | 'error', msg: string, data?: unknown) => {
    const logger: any = app.container.has('logger') ? app.container.use('logger') : undefined
    logger?.[level]?.(msg, data)
  }

  const validate = <P>(job: Job<P>, payload: unknown): P => {
    if (!job.schema) return payload as P
    const result = validateSync(job.schema, payload)
    if (!result.success)
      throw KitrError.validation(result.fieldErrors, `[jobs] ${job.name}: bad payload`)
    return result.data as P
  }

  async function runOnce<P>(job: Job<P>, payload: P, attempt: number, id: string) {
    const controller = new AbortController()
    const ms = job.timeout ?? 60_000
    let timeout: ReturnType<typeof setTimeout> | undefined
    // A job that ignores its signal still fails at the timeout, so it can't hold a worker slot
    // (or `stop()`) forever.
    const expired = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        const error = new Error(`[jobs] ${job.name} timed out after ${ms}ms`)
        controller.abort(error)
        reject(error)
      }, ms)
    })
    try {
      return await Promise.race([
        Promise.resolve().then(() =>
          job.run(payload, { app, attempt, jobId: id, signal: controller.signal }),
        ),
        expired,
      ])
    } finally {
      clearTimeout(timeout)
    }
  }

  async function execute(queued: QueuedJob) {
    const job = registry.get(queued.name)
    if (!job) {
      log('warn', `[jobs] unknown job "${queued.name}" dropped`)
      return
    }
    let payload: unknown
    try {
      payload = validate(job, queued.payload)
    } catch (error) {
      // A payload that fails its schema will fail every retry too.
      log('error', `[jobs] ${job.name} dropped: bad payload`, error)
      config.onFailed?.(queued, error)
      return
    }
    try {
      await runOnce(job, payload, queued.attempt, queued.id)
    } catch (error) {
      const retries = job.retries ?? 3
      if (queued.attempt <= retries) {
        const wait = (job.backoff ?? 1000) * 2 ** (queued.attempt - 1)
        log('warn', `[jobs] ${job.name} failed (attempt ${queued.attempt}), retry in ${wait}ms`)
        await driver.push({ ...queued, attempt: queued.attempt + 1, runAt: Date.now() + wait })
      } else {
        log('error', `[jobs] ${job.name} failed after ${queued.attempt} attempts`, error)
        config.onFailed?.(queued, error)
      }
    }
  }

  const dispatchScheduled = (job: Job<any>) =>
    jobs.dispatch(job, undefined as never).catch((error) => {
      log('error', `[jobs] could not queue scheduled ${job.name}`, error)
    })

  async function tick() {
    if (!running) return
    try {
      await poll()
    } catch (error) {
      // A driver hiccup (Redis restart) must not stop the worker for good.
      log('error', '[jobs] worker poll failed', error)
    }
    if (running) timer = setTimeout(tick, config.pollInterval ?? 500)
  }

  async function poll() {
    const now = Date.now()
    const minute = Math.floor(now / 60_000)
    if (minute !== lastCronMinute) {
      lastCronMinute = minute
      for (const job of registry.values())
        if (typeof job.schedule === 'string' && cronMatches(job.schedule, new Date(now)))
          void dispatchScheduled(job)
    }
    for (const [name, every] of intervals) {
      if (now - (lastRun.get(name) ?? 0) >= every) {
        lastRun.set(name, now)
        void dispatchScheduled(registry.get(name)!)
      }
    }
    const room = concurrency - active.size
    if (room > 0) {
      for (const queued of await driver.pull(now, room)) {
        const p = execute(queued).finally(() => active.delete(p))
        active.add(p)
      }
    }
  }

  for (const job of config.jobs ?? []) {
    registry.set(job.name, job)
    if (job.schedule && typeof job.schedule === 'object')
      intervals.set(job.name, parseInterval(job.schedule.every))
  }

  const jobs: Jobs = {
    driver,
    jobs: registry,
    get running() {
      return running
    },
    register(...list) {
      for (const job of list) {
        registry.set(job.name, job)
        if (job.schedule && typeof job.schedule === 'object')
          intervals.set(job.name, parseInterval(job.schedule.every))
        // Check cron syntax now, not at the first tick in production.
        else if (typeof job.schedule === 'string') cronMatches(job.schedule, new Date())
      }
      return jobs
    },
    async dispatch(job, payload, options = {}) {
      if (!registry.has(job.name)) registry.set(job.name, job)
      const id = crypto.randomUUID()
      const runAt = options.at ? options.at.getTime() : Date.now() + (options.delay ?? 0)
      await driver.push({ id, name: job.name, payload: validate(job, payload), attempt: 1, runAt })
      return id
    },
    async run(job, payload, attempt = 1) {
      const retries = job.retries ?? 3
      const valid = validate(job, payload)
      let error: unknown
      for (let a = attempt; a <= retries + 1; a++) {
        try {
          return await runOnce(job, valid, a, crypto.randomUUID())
        } catch (e) {
          error = e
          if (a <= retries)
            await new Promise((r) => setTimeout(r, (job.backoff ?? 1000) * 2 ** (a - 1)))
        }
      }
      throw error
    },
    start() {
      if (running) return
      running = true
      lastCronMinute = Math.floor(Date.now() / 60_000)
      timer = setTimeout(tick, 0)
    },
    async stop() {
      running = false
      if (timer) clearTimeout(timer)
      await Promise.allSettled([...active])
    },
  }
  return jobs
}

export function useJobs(app: KitrApp): Jobs {
  return app.container.use('jobs')
}
