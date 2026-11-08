import { silentLogger } from '@kitr/logger'
import { createServer } from '@kitr/server'
import { afterAll, describe, expect, it } from 'vitest'
import { createTestRedis, uniquePrefix } from '../../../tests/setup/redis'
import { createRedisRateLimitStore, rateLimit } from '../src'

describe('Redis rate-limit store', () => {
  const clients = [createTestRedis(), createTestRedis()]
  afterAll(async () => {
    for (const c of clients) await c.quit()
  })

  it('shares one limit between two instances', async () => {
    const prefix = uniquePrefix('rl')
    const [a, b] = clients.map((redis) => {
      const server = createServer({ logger: silentLogger, server: { healthPath: false } })
      server.use(
        rateLimit({
          max: 3,
          key: () => 'ada',
          store: createRedisRateLimitStore(redis, { prefix }),
        }),
      )
      server.h3.get('/ping', () => 'pong')
      return server
    }) as [ReturnType<typeof createServer>, ReturnType<typeof createServer>]
    const statuses: number[] = []
    for (const server of [a, b, a, b]) {
      const res = await server.fetch(new Request('http://x/ping'))
      statuses.push(res.status)
    }
    // Three requests fit the limit whichever instance served them; the fourth is refused.
    expect(statuses).toEqual([200, 200, 200, 429])
  })

  it('opens a new window after the old one expires', async () => {
    const store = createRedisRateLimitStore(clients[0]!, { prefix: uniquePrefix('rl') })
    expect((await store.hit('grace', 50)).count).toBe(1)
    const second = await store.hit('grace', 50)
    expect(second.count).toBe(2)
    expect(second.resetAt).toBeGreaterThan(Date.now())
    await new Promise((r) => setTimeout(r, 80))
    expect((await store.hit('grace', 50)).count).toBe(1)
  })
})
