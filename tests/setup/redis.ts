import { Command, Redis } from 'ioredis'
import RedisMock from 'ioredis-mock'

/**
 * A Redis client for the adapter tests: a real server when `REDIS_URL` is set (CI runs one),
 * otherwise ioredis-mock, whose instances share one in-process store and pub/sub bus.
 */
export function createTestRedis(): Redis {
  const url = process.env.REDIS_URL
  if (url) return new Redis(url, { maxRetriesPerRequest: 1 })
  giveMockRepliesAContext()
  return new RedisMock() as unknown as Redis
}

/** A key prefix no other test uses, so suites can share one Redis. */
export const uniquePrefix = (name: string) =>
  `kitr-test:${name}:${Math.random().toString(36).slice(2, 10)}:`

type ReplyTransformer = (result: unknown, context?: unknown) => unknown
let replyContextPatched = false

/**
 * ioredis 6 reply transformers (`zrangebyscore` and the other sorted-set commands among them)
 * take a second argument, the connection's protocol, and read it unguarded. ioredis-mock 8 runs
 * ioredis's transformers on its replies with the reply alone, so every such command throws. The
 * mock answers like a default RESP2 connection, so that is the context it gets. ioredis 5
 * transformers take one argument and ignore the extra one; a real client always passes its own.
 */
function giveMockRepliesAContext() {
  if (replyContextPatched) return
  replyContextPatched = true
  const { reply } = (
    Command as unknown as { _transformer: { reply: Record<string, ReplyTransformer> } }
  )._transformer
  for (const [commandName, transform] of Object.entries(reply))
    reply[commandName] = (result, context = { commandName, protocol: 2, replyMapping: 'legacy' }) =>
      transform(result, context)
}
