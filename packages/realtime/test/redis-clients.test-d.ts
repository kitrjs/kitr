import { Redis } from 'ioredis'
import { expectTypeOf, it } from 'vitest'
import { createRedisCacheDriver } from '../../cache/src'
import { createRedisJobsDriver } from '../../jobs/src'
import { createRedisRateLimitStore } from '../../shield/src'
import { createRedisRealtimeAdapter, type RedisPubSubClient } from '../src/adapter'

// Every Redis adapter takes an ioredis client as it is, with no cast.
it('accepts an ioredis client', () => {
  const redis = new Redis()
  expectTypeOf(redis).toExtend<RedisPubSubClient>()
  createRedisRealtimeAdapter(redis)
  createRedisCacheDriver(redis)
  createRedisJobsDriver(redis)
  createRedisRateLimitStore(redis)
})
