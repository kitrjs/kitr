---
title: Shield
description: Turn on the security basics every API needs: CORS, CSRF protection, safe headers and rate limits.
order: 1
---

# Shield

Four middlewares an API should not ship without, configured in one file and attached with one line.

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
