import { Redis } from 'ioredis'
import RedisMock from 'ioredis-mock'

/**
 * A Redis client for the adapter tests: a real server when `REDIS_URL` is set (CI runs one),
 * otherwise ioredis-mock, whose instances share one in-process store and pub/sub bus.
 */
export function createTestRedis(): Redis {
  const url = process.env.REDIS_URL
  if (url) return new Redis(url, { maxRetriesPerRequest: 1 })
  return new RedisMock() as unknown as Redis
}

/** A key prefix no other test uses, so suites can share one Redis. */
export const uniquePrefix = (name: string) =>
  `kitr-test:${name}:${Math.random().toString(36).slice(2, 10)}:`
