import { createApp } from '@kitr/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createJobs,
  createMemoryJobsDriver,
  cronMatches,
  defineJob,
  type JobsDriver,
  parseInterval,
} from '../src'

const stringSchema = {
  '~standard': {
    version: 1 as const,
    vendor: 'test',
    validate: (v: unknown) =>
      typeof v === 'string' ? { value: v } : { issues: [{ message: 'string please' }] },
  },
}

afterEach(() => {
  vi.useRealTimers()
})

describe('cron', () => {
  // 2026-01-05 is a Monday.
  const at = (day: number, h = 0, mi = 0, month = 0) => new Date(2026, month, day, h, mi)

  it('handles lists, ranges, steps and offsets', () => {
    expect(cronMatches('0,30 * * * *', at(5, 9, 30))).toBe(true)
    expect(cronMatches('0,30 * * * *', at(5, 9, 31))).toBe(false)
    expect(cronMatches('* 9-17 * * *', at(5, 17))).toBe(true)
    expect(cronMatches('* 9-17 * * *', at(5, 18))).toBe(false)
    expect(cronMatches('5/15 * * * *', at(5, 0, 20))).toBe(true)
    expect(cronMatches('5/15 * * * *', at(5, 0, 15))).toBe(false)
    expect(cronMatches('0-30/10 * * * *', at(5, 0, 40))).toBe(false)
    expect(cronMatches('0 0 1 1 *', at(1))).toBe(true)
    expect(cronMatches('0 0 1 2 *', at(1))).toBe(false)
  })

  it('treats weekday 7 as Sunday', () => {
    const sunday = at(4)
    expect(cronMatches('0 0 * * 7', sunday)).toBe(true)
    expect(cronMatches('0 0 * * 0', sunday)).toBe(true)
    expect(cronMatches('0 0 * * 1-7', sunday)).toBe(true)
    expect(cronMatches('0 0 * * 7', at(5))).toBe(false)
  })

  it('ORs day-of-month and weekday when both are set, as cron does', () => {
    // "the 1st, and every Monday"
    expect(cronMatches('0 0 1 * 1', at(5))).toBe(true) // Monday the 5th
    expect(cronMatches('0 0 1 * 1', at(1))).toBe(true) // Thursday the 1st
    expect(cronMatches('0 0 1 * 1', at(6))).toBe(false) // Tuesday the 6th
    // With only one restricted, the other is a wildcard.
    expect(cronMatches('0 0 * * 1', at(6))).toBe(false)
    expect(cronMatches('0 0 6 * *', at(6))).toBe(true)
  })

  it.each([
    '* * * *',
    '* * * * * *',
    '60 * * * *',
    '* 24 * * *',
    '* * 0 * *',
    '* * * 13 *',
    '* * * * 8',
    '*/0 * * * *',
    'MON * * * *',
    '1-x * * * *',
    '5-1 * * * *',
    '1/2/3 * * * *',
    ', * * * *',
  ])('rejects %j instead of never running', (expression) => {
    expect(() => cronMatches(expression, new Date())).toThrow(/Bad cron/)
  })

  it('rejects a bad schedule at register time', () => {
    const jobs = createJobs(createApp())
    expect(() =>
      jobs.register(defineJob('bad-cron', { schedule: '61 * * * *', run: () => {} })),
    ).toThrow(/Bad cron/)
    expect(() =>
      jobs.register(defineJob('bad-every', { schedule: { every: 'often' }, run: () => {} })),
    ).toThrow(/Bad interval/)
  })

  it('parses every interval unit', () => {
    expect(parseInterval('250ms')).toBe(250)
    expect(parseInterval('30s')).toBe(30_000)
    expect(parseInterval(' 1.5 h ')).toBe(5_400_000)
    expect(parseInterval('1d')).toBe(86_400_000)
    expect(() => parseInterval('-1s')).toThrow()
    expect(() => parseInterval('5 minutes')).toThrow()
  })
})

describe('worker', () => {
  it('times out a job that ignores its signal and retries it', async () => {
    const failed = vi.fn()
    const jobs = createJobs(createApp(), { pollInterval: 5, onFailed: failed })
    const signals: AbortSignal[] = []
    const hang = defineJob('hang', {
      timeout: 20,
      retries: 1,
      backoff: 1,
      run: (_p, ctx) => {
        signals.push(ctx.signal)
        return new Promise(() => {})
      },
    })
    jobs.register(hang).start()
    await jobs.dispatch(hang, undefined)
    await vi.waitFor(() => expect(failed).toHaveBeenCalledTimes(1), { timeout: 2000 })
    expect(failed.mock.calls[0]![1]).toBeInstanceOf(Error)
    expect(String(failed.mock.calls[0]![1])).toMatch(/timed out after 20ms/)
    expect(signals).toHaveLength(2)
    expect(signals.every((s) => s.aborted)).toBe(true)
    // stop() does not wait for the hung promises.
    await expect(jobs.stop()).resolves.toBeUndefined()
  })

  it('run() inline also times out', async () => {
    const jobs = createJobs(createApp())
    const hang = defineJob('hang-inline', {
      timeout: 10,
      retries: 0,
      run: () => new Promise(() => {}),
    })
    await expect(jobs.run(hang, undefined)).rejects.toThrow(/timed out/)
  })

  it('keeps concurrency to the configured limit', async () => {
    const jobs = createJobs(createApp(), { pollInterval: 2, concurrency: 2 })
    let now = 0
    let peak = 0
    let done = 0
    const job = defineJob('slow', {
      run: async () => {
        now++
        peak = Math.max(peak, now)
        await new Promise((r) => setTimeout(r, 15))
        now--
        done++
      },
    })
    jobs.register(job)
    for (let i = 0; i < 6; i++) await jobs.dispatch(job, undefined)
    jobs.start()
    await vi.waitFor(() => expect(done).toBe(6), { timeout: 3000 })
    expect(peak).toBe(2)
    await jobs.stop()
  })

  it('drops payloads that fail the schema without retrying', async () => {
    const driver = createMemoryJobsDriver()
    const failed = vi.fn()
    const jobs = createJobs(createApp(), { pollInterval: 5, driver, onFailed: failed })
    const run = vi.fn()
    const job = defineJob<string>('typed', { schema: stringSchema, retries: 3, backoff: 1, run })
    jobs.register(job)
    // As if another process (or an older deploy) queued a bad payload.
    await driver.push({ id: 'x', name: 'typed', payload: 42, attempt: 1, runAt: 0 })
    jobs.start()
    await vi.waitFor(() => expect(failed).toHaveBeenCalledTimes(1), { timeout: 2000 })
    expect(run).not.toHaveBeenCalled()
    expect(await driver.size()).toBe(0)
    await jobs.stop()
  })

  it('run() rejects a bad payload without retrying', async () => {
    const run = vi.fn()
    const jobs = createJobs(createApp())
    const job = defineJob<string>('typed-inline', {
      schema: stringSchema,
      retries: 3,
      backoff: 1000,
      run,
    })
    await expect(jobs.run(job, 1 as never)).rejects.toMatchObject({ status: 422 })
    expect(run).not.toHaveBeenCalled()
  })

  it('drops unknown jobs and keeps working', async () => {
    const driver = createMemoryJobsDriver()
    const jobs = createJobs(createApp(), { pollInterval: 5, driver })
    const seen: string[] = []
    const known = defineJob<string>('known', { run: (p) => void seen.push(p) })
    jobs.register(known)
    await driver.push({ id: 'g', name: 'ghost', payload: null, attempt: 1, runAt: 0 })
    await jobs.dispatch(known, 'after')
    jobs.start()
    await vi.waitFor(() => expect(seen).toEqual(['after']), { timeout: 2000 })
    expect(await driver.size()).toBe(0)
    await jobs.stop()
  })

  it('survives a driver that throws and resumes polling', async () => {
    const inner = createMemoryJobsDriver()
    let failures = 2
    const driver: JobsDriver = {
      ...inner,
      async pull(now, limit) {
        if (failures-- > 0) throw new Error('redis down')
        return inner.pull(now, limit)
      },
    }
    const jobs = createJobs(createApp(), { pollInterval: 5, driver })
    const seen: number[] = []
    const job = defineJob<number>('n', { run: (n) => void seen.push(n) })
    jobs.register(job)
    await jobs.dispatch(job, 1)
    jobs.start()
    await vi.waitFor(() => expect(seen).toEqual([1]), { timeout: 2000 })
    await jobs.stop()
  })

  it('runs scheduled jobs once per matching minute', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 0, 5, 9, 59, 50))
    const jobs = createJobs(createApp(), { pollInterval: 5 })
    let runs = 0
    jobs.register(defineJob('hourly', { schedule: '0 * * * *', run: () => void runs++ })).start()
    await new Promise((r) => setTimeout(r, 30))
    expect(runs).toBe(0)
    vi.setSystemTime(new Date(2026, 0, 5, 10, 0, 5))
    await vi.waitFor(() => expect(runs).toBe(1), { timeout: 2000 })
    await new Promise((r) => setTimeout(r, 40))
    expect(runs).toBe(1)
    await jobs.stop()
  })

  it('a scheduled job whose dispatch fails does not crash the worker', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      const jobs = createJobs(createApp(), { pollInterval: 5 })
      // A schema that rejects the empty payload a schedule sends.
      jobs
        .register(
          defineJob<string>('picky', {
            schema: stringSchema,
            schedule: { every: '10ms' },
            run: () => {},
          }),
        )
        .start()
      await new Promise((r) => setTimeout(r, 50))
      expect(jobs.running).toBe(true)
      await jobs.stop()
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })

  it('stop() waits for running jobs and start() is idempotent', async () => {
    const jobs = createJobs(createApp(), { pollInterval: 2 })
    let finished = false
    const job = defineJob('slow', {
      run: async () => {
        await new Promise((r) => setTimeout(r, 30))
        finished = true
      },
    })
    jobs.register(job)
    jobs.start()
    jobs.start()
    await jobs.dispatch(job, undefined)
    await vi.waitFor(() => expect(jobs.running).toBe(true))
    await new Promise((r) => setTimeout(r, 10))
    await jobs.stop()
    expect(finished).toBe(true)
  })

  it('dispatch at a fixed time and gives each job an id and attempt count', async () => {
    const driver = createMemoryJobsDriver()
    const jobs = createJobs(createApp(), { driver })
    const job = defineJob('later', { run: () => {} })
    const at = new Date(Date.now() + 60_000)
    const id = await jobs.dispatch(job, undefined, { at })
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(await driver.pull(Date.now(), 10)).toEqual([])
    const [queued] = await driver.pull(at.getTime(), 10)
    expect(queued).toMatchObject({ id, name: 'later', attempt: 1, runAt: at.getTime() })
    expect(jobs.jobs.has('later')).toBe(true)
  })

  it('memory driver pulls in runAt order, up to the limit', async () => {
    const driver = createMemoryJobsDriver()
    for (const [id, runAt] of [
      ['c', 3],
      ['a', 1],
      ['b', 2],
      ['d', 99],
    ] as const)
      await driver.push({ id, name: 'j', payload: null, attempt: 1, runAt })
    expect((await driver.pull(10, 2)).map((j) => j.id)).toEqual(['a', 'b'])
    expect((await driver.pull(10, 5)).map((j) => j.id)).toEqual(['c'])
    expect(await driver.size()).toBe(1)
    await driver.clear()
    expect(await driver.size()).toBe(0)
  })

  it('backs off exponentially between retries', async () => {
    const driver = createMemoryJobsDriver()
    const pushes: number[] = []
    const spy: JobsDriver = {
      ...driver,
      async push(job) {
        pushes.push(job.runAt - Date.now())
        return driver.push(job)
      },
    }
    const failed = vi.fn()
    const jobs = createJobs(createApp(), { pollInterval: 2, driver: spy, onFailed: failed })
    const job = defineJob('flaky', {
      retries: 3,
      backoff: 10,
      run: () => {
        throw new Error('x')
      },
    })
    jobs.register(job).start()
    await jobs.dispatch(job, undefined)
    await vi.waitFor(() => expect(failed).toHaveBeenCalled(), { timeout: 3000 })
    const waits = pushes.slice(1)
    expect(waits).toHaveLength(3)
    expect(waits[0]).toBeGreaterThanOrEqual(8)
    expect(waits[1]).toBeGreaterThanOrEqual(18)
    expect(waits[2]).toBeGreaterThanOrEqual(38)
    await jobs.stop()
  })
})
