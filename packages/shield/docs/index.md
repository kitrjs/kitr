---
title: Shield
description: Turn on the security basics every API needs: CORS, CSRF protection, safe headers and rate limits.
order: 1
---

# Shield

An API on the open internet needs the same four protections every time: headers that tell browsers to be strict, CORS for the origins you trust, CSRF protection for cookie sessions, and a rate limit so one client can't flood you. They're easy to get subtly wrong. `kitr/shield` configures all four in one file and attaches them with one line, with defaults that are safe without any changes.

## Install

```sh
kitr add shield
```

The recipe writes `config/shield.ts` and adds `shield(server)` to `server/main.ts`.

```ts
// config/shield.ts
import { defineConfig } from 'kitr/shield'

export default defineConfig({
  headers: { frameOptions: 'DENY' },
  cors: { origin: ['https://app.example.com'], credentials: true },
  csrf: { ignore: ['/api/webhooks'] },
  rateLimit: { windowMs: 60_000, max: 100 },
})
```

`false` turns any of the four off. Without a `cors` entry no CORS headers are sent, which is right for a same-origin app.

## What each one does

- **headers**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, a strict `Content-Security-Policy` and, in production, HSTS.
- **cors**: answers preflights and sets the allow headers for the origins you list, a predicate, or `'*'`.
- **csrf**: a double-submit cookie. The server sets a readable `kitr-csrf` cookie; every POST, PUT, PATCH and DELETE must echo it in `X-CSRF-Token`. `kitr/http` does that for you.
- **rateLimit**: a fixed window per client IP (or your `key`) with `RateLimit-*` headers and a 429. Pass a `store` backed by Redis when you run more than one server.

Each middleware is also exported on its own: `securityHeaders()`, `cors()`, `csrf()`, `rateLimit()`.

## Rate limits in production

| Option | Default | Description |
| --- | --- | --- |
| `windowMs` | `60000` | Window length in milliseconds. |
| `max` | `100` | Requests per client per window. |
| `key(event)` | the client IP | What a client is: an IP, a user id, an API key. |
| `trustProxy` | `false` | Read the IP from `X-Forwarded-For`. Turn it on only behind a proxy you control that overwrites the header, or anyone can dodge the limit by sending a new value. |
| `store` | this process | Where counters live. |
| `ignore` | none | Path prefixes that are never limited, such as `/api/health`. |

The default store counts in memory, so each server instance has its own limit. With several instances, give them a shared store. It needs a single method:

```ts
import { defineConfig, type RateLimitStore } from 'kitr/shield'

const redisStore: RateLimitStore = {
  async hit(key, windowMs) {
    const count = await redis.incr(`rl:${key}`)
    if (count === 1) await redis.pexpire(`rl:${key}`, windowMs)
    const ttl = await redis.pttl(`rl:${key}`)
    return { count, resetAt: Date.now() + ttl }
  },
}

export default defineConfig({ rateLimit: { max: 300, store: redisStore } })
```

A tighter limit on one route, like sign-in, is the standalone middleware on that route:

```ts
import { rateLimit } from 'kitr/shield'

api.post('/sign-in', [SessionsController, 'store'], {
  middleware: [rateLimit({ max: 5, windowMs: 15 * 60_000 })],
})
```

## Content Security Policy

The default policy only allows scripts, styles, images and connections from your own origin. If you load a script from elsewhere, like an analytics tag, add its origin:

```ts
import { DEFAULT_CSP, defineConfig } from 'kitr/shield'

export default defineConfig({
  headers: {
    contentSecurityPolicy: DEFAULT_CSP.replace("script-src 'self'", "script-src 'self' https://plausible.io"),
  },
})
```

`contentSecurityPolicy: false` turns the header off, which is sometimes needed while you work out the right policy.

## Tests

The four middlewares run on the server's `fetch`, so [testing](/packages/testing)'s request client sees them:

```ts
const res = await createTestClient(server).post('/api/projects', { name: 'Alpha' })
expect(res.status).toBe(403) // no CSRF token
```
