import { createApp } from '@kitr/core'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { createTestRedis, uniquePrefix } from '../../../tests/setup/redis'
import { createJobs, createRedisJobsDriver, defineJob } from '../src'

describe('Redis jobs driver', () => {
  const clients = [createTestRedis(), createTestRedis()]
  afterAll(async () => {
    for (const c of clients) await c.quit()
  })

  it('runs each queued job once across two workers', async () => {
    const prefix = uniquePrefix('jobs')
    const ran: string[] = []
    const sendInvoice = defineJob<{ invoice: string }>('send-invoice', {
      run: async ({ invoice }) => {
        ran.push(invoice)
        await new Promise((r) => setTimeout(r, 5))
      },
    })
    const workers = clients.map((redis) =>
      createJobs(createApp(), {
        jobs: [sendInvoice],
        driver: createRedisJobsDriver(redis, { prefix }),
        pollInterval: 10,
      }),
    )
    for (let i = 1; i <= 20; i++) await workers[0]!.dispatch(sendInvoice, { invoice: `inv_${i}` })
    for (const w of workers) w.start()
    await vi.waitFor(() => expect(ran).toHaveLength(20), { timeout: 5000 })
    await new Promise((r) => setTimeout(r, 50))
    for (const w of workers) await w.stop()
    expect(new Set(ran).size).toBe(20)
    expect(ran).toHaveLength(20)
    expect(await workers[1]!.driver.size()).toBe(0)
  })

  it('retries a failed job under the same id', async () => {
    const prefix = uniquePrefix('jobs')
    const attempts: number[] = []
    const flaky = defineJob('flaky', {
      retries: 2,
      backoff: 1,
      run: (_payload, { attempt }) => {
        attempts.push(attempt)
        if (attempt < 3) throw new Error('not yet')
      },
    })
    const jobs = createJobs(createApp(), {
      jobs: [flaky],
      driver: createRedisJobsDriver(clients[0]!, { prefix }),
      pollInterval: 5,
    })
    await jobs.dispatch(flaky, undefined)
    jobs.start()
    await vi.waitFor(() => expect(attempts).toEqual([1, 2, 3]), { timeout: 5000 })
    await jobs.stop()
  })

  it('gives a job back to the queue when its worker never acks it', async () => {
    const prefix = uniquePrefix('jobs')
    const driver = createRedisJobsDriver(clients[0]!, { prefix, visibilityTimeout: 30 })
    const other = createRedisJobsDriver(clients[1]!, { prefix, visibilityTimeout: 30 })
    await driver.push({ id: 'j1', name: 'report', payload: null, attempt: 1, runAt: Date.now() })
    expect(await driver.pull(Date.now(), 5)).toHaveLength(1)
    // Reserved: nobody else sees it while the first worker still might finish.
    expect(await other.pull(Date.now(), 5)).toHaveLength(0)
    await new Promise((r) => setTimeout(r, 50))
    const again = await other.pull(Date.now(), 5)
    expect(again.map((j) => j.id)).toEqual(['j1'])
    await other.ack!(again[0]!)
    expect(await other.pull(Date.now() + 1000, 5)).toHaveLength(0)
  })

  it('queues an interval job once per interval however many workers poll', async () => {
    const prefix = uniquePrefix('jobs')
    let runs = 0
    const sweep = defineJob('sweep', { schedule: { every: '200ms' }, run: () => void runs++ })
    const workers = clients.map((redis) =>
      createJobs(createApp(), {
        jobs: [sweep],
        driver: createRedisJobsDriver(redis, { prefix }),
        pollInterval: 10,
      }),
    )
    for (const w of workers) w.start()
    await new Promise((r) => setTimeout(r, 1000))
    for (const w of workers) await w.stop()
    // Five or six 200ms slots in a second; memory workers would have queued twice that.
    expect(runs).toBeGreaterThanOrEqual(4)
    expect(runs).toBeLessThanOrEqual(6)
  })

  it('claim gives a lock to one caller only', async () => {
    const prefix = uniquePrefix('jobs')
    const [a, b] = clients.map((redis) => createRedisJobsDriver(redis, { prefix }))
    const results = await Promise.all([
      a!.claim!('cron:digest:1', 1000),
      b!.claim!('cron:digest:1', 1000),
    ])
    expect(results.filter(Boolean)).toHaveLength(1)
  })
})
