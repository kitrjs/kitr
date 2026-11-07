import { createApp } from '@kitr/core'
import { describe, expect, it, vi } from 'vitest'
import { createJobs, cronMatches, defineJob, parseInterval } from '../src'
import jobsProvider from '../src/provider'

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms))

describe('jobs', () => {
  it('dispatches, runs with the payload and retries with backoff', async () => {
    const app = createApp()
    const jobs = createJobs(app, { pollInterval: 5 })
    const runs: number[] = []
    const flaky = defineJob<{ n: number }>('flaky', {
      retries: 2,
      backoff: 1,
      run: ({ n }, ctx) => {
        runs.push(ctx.attempt)
        if (ctx.attempt < 3) throw new Error('nope')
        return n * 2
      },
    })
    jobs.register(flaky)
    jobs.start()
    await jobs.dispatch(flaky, { n: 21 })
    await vi.waitFor(() => expect(runs).toEqual([1, 2, 3]), { timeout: 2000 })
    await jobs.stop()
    expect(jobs.running).toBe(false)
  })

  it('gives up after the retries and reports the failure', async () => {
    const app = createApp()
    const failed = vi.fn()
    const jobs = createJobs(app, { pollInterval: 5, onFailed: failed })
    const bad = defineJob('bad', {
      retries: 1,
      backoff: 1,
      run: () => {
        throw new Error('always')
      },
    })
    jobs.register(bad).start()
    await jobs.dispatch(bad, undefined)
    await vi.waitFor(() => expect(failed).toHaveBeenCalledTimes(1), { timeout: 2000 })
    expect(failed.mock.calls[0]![0].attempt).toBe(2)
    await jobs.stop()
  })

  it('honours delays and validates payloads with a schema', async () => {
    const app = createApp()
    const jobs = createJobs(app, { pollInterval: 5 })
    const seen: string[] = []
    const schema = {
      '~standard': {
        version: 1 as const,
        vendor: 'test',
        validate: (v: unknown) =>
          typeof v === 'string' ? { value: v } : { issues: [{ message: 'string please' }] },
      },
    }
    const job = defineJob<string>('typed', { schema, run: (p) => void seen.push(p) })
    jobs.register(job).start()
    await expect(jobs.dispatch(job, 1 as never)).rejects.toThrow()
    await jobs.dispatch(job, 'later', { delay: 30 })
    await tick(10)
    expect(seen).toEqual([])
    await vi.waitFor(() => expect(seen).toEqual(['later']), { timeout: 2000 })
    await jobs.stop()
  })

  it('run() executes inline with retries', async () => {
    const jobs = createJobs(createApp())
    let n = 0
    const job = defineJob('inline', {
      retries: 1,
      backoff: 1,
      run: () => {
        n++
        if (n === 1) throw new Error('first')
        return 'ok'
      },
    })
    expect(await jobs.run(job, undefined)).toBe('ok')
  })

  it('parses intervals and matches cron expressions', () => {
    expect(parseInterval('5m')).toBe(300_000)
    expect(parseInterval('2h')).toBe(7_200_000)
    expect(() => parseInterval('soon')).toThrow()
    const date = new Date(2026, 0, 5, 9, 30) // Monday 09:30
    expect(cronMatches('30 9 * * *', date)).toBe(true)
    expect(cronMatches('*/15 * * * 1', date)).toBe(true)
    expect(cronMatches('0 9 * * *', date)).toBe(false)
    expect(cronMatches('30 9 * * 0,6', date)).toBe(false)
  })

  it('runs interval schedules from the worker', async () => {
    const jobs = createJobs(createApp(), { pollInterval: 5 })
    let runs = 0
    jobs
      .register(defineJob('beat', { schedule: { every: '20ms' }, run: () => void runs++ }))
      .start()
    await vi.waitFor(() => expect(runs).toBeGreaterThanOrEqual(2), { timeout: 2000 })
    await jobs.stop()
  })

  it('binds jobs and starts the worker on ready', async () => {
    const app = createApp({ providers: [jobsProvider], config: { jobs: { pollInterval: 5 } } })
    await app.boot()
    const jobs = app.container.use('jobs')
    expect(jobs.running).toBe(false)
    await app.ready()
    expect(jobs.running).toBe(true)
    await app.shutdown()
    expect(jobs.running).toBe(false)
  })
})
