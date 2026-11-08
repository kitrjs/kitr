import { inProduction } from '@kitr/kitr/app'
import {
  createCookieSession,
  createMemorySessionStore,
  createMemoryUserProvider,
  hashPassword,
} from '@kitr/auth/server'
import type { User } from '#app/abilities'
import { env } from '#app/env'

/** Signs the session cookie: at least 32 random characters (`openssl rand -base64 32`), in SESSION_SECRET. */
function sessionSecret() {
  if (env.SESSION_SECRET) return env.SESSION_SECRET
  if (inProduction()) throw new Error('SESSION_SECRET is not set: generate one with `openssl rand -base64 32`.')
  return 'development-only-secret-not-for-production'
}

/**
 * Where sessions live. In memory is fine for one process and is lost on restart. For several
 * instances, share them through Redis:
 *
 *   import { Redis } from 'ioredis'
 *   store: createRedisSessionStore(new Redis(process.env.REDIS_URL))
 */
export const sessions = createCookieSession({
  secret: sessionSecret(),
  store: createMemorySessionStore(),
})

/**
 * Where users live. Two demo accounts (password "password"), plus whoever signs up, in memory.
 * Implement `UserProvider` over your database (`kitr add db`) and swap it in.
 */
export const users = createMemoryUserProvider<User>({
  build: (input, id) => ({ id, email: input.email, role: 'member' }),
  seed: [
    {
      user: { id: 'admin', email: 'admin@example.com', role: 'admin' },
      passwordHash: await hashPassword('password'),
      emailVerified: true,
    },
    {
      user: { id: 'member', email: 'member@example.com', role: 'member' },
      passwordHash: await hashPassword('password'),
      emailVerified: true,
    },
  ],
})

/** What the controller, the middleware and `runWithSession` take. */
export const auth = { sessions, users }
