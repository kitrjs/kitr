---
title: Shield
description: "Turn on the security basics every API needs: CORS, CSRF protection, safe headers and rate limits."
order: 1
---

# Shield

Every API that a browser can reach gets the same unwanted visitors: other sites that try to post forms as your signed-in users, pages that frame yours to trick clicks, scripts that hammer the sign-in route. `@kitr/shield` turns on the four defences every API needs, from one config file: safe response headers, CORS for a separate front end, CSRF protection for cookie sessions, and a rate limit per client.

Each defence is a plain [h3](https://h3.dev/guide/basics/middleware) middleware with no dependencies of its own. kitr adds the defaults, the order they run in, a config file, and refusals for settings that would open a hole, such as CORS for every origin with cookies.

It runs on the server only, in front of every route of the [kitr server](/packages/server). It does not know who the user is: sign-in, sessions and permissions are [auth](/packages/auth)'s job.

The examples on this page follow Acme's API at `api.acme.com`, used by the dashboard at `app.acme.com`. People sign in with a cookie session, and Stripe posts payment webhooks to `/webhooks/stripe`.

## Install

```sh
kitr add shield
```

What `kitr add` does:

- Adds the [server](/packages/server) package first if the project does not have it yet (and [logger](/packages/logger), which the server needs).
- Adds `@kitr/shield` to `dependencies` in `package.json` and installs it. Pass `--no-install` to skip the install.
- Adds `() => import('@kitr/shield/provider')` to `providers` and `'@kitr/shield'` to `packages` in `kitrrc.ts`. The provider checks `config/shield.ts` at boot.
- Writes `config/shield.ts` (see [Configure](#configure)).
- Edits `server/main.ts`, when it exists and does not already call `shield(server`: imports `shield` from `@kitr/shield` and calls `shield(server)` straight after `createServer()`, so the shield sees every request first.
- Adds a `## kitr: shield` section to `AGENTS.md`: `shield(server)` applies `config/shield.ts`, rate-limited requests get 429 with `RateLimit-*` headers, CSRF failures get 403, and agents tune the config instead of adding helmet or cors by hand.

It adds no env variables, no scripts and asks no questions. No kit includes the shield, so every project adds it with this command.

After `kitr add shield`, the top of `server/main.ts` reads:

```ts
// server/main.ts
import { createServer } from '@kitr/server'
import { shield } from '@kitr/shield'
import { mountRoutes } from '@kitr/api'
import { config } from '../config'
import rc from '../kitrrc'
import { routes } from './routes'

export const server = createServer({ providers: rc.providers, config })
// Security headers, CORS, rate limit and CSRF from config/shield.ts.
shield(server)
mountRoutes(server, routes)
// ...
```

If the project has no `server/main.ts` yet, add those two lines yourself once the server platform has written it (`kitr add server api`).

`kitr remove shield` takes the provider and the package out of `kitrrc.ts`, deletes `config/shield.ts`, removes the dependency and the `AGENTS.md` section. It leaves `server/main.ts` alone, so delete the `shield` import and the `shield(server)` line yourself.

## Configure

`kitr add shield` writes this file:

```ts
// config/shield.ts
import { defineConfig } from '@kitr/shield'

export default defineConfig({
  headers: {}, // sensible security headers; set contentSecurityPolicy to tighten
  cors: false, // { origin: ['https://app.example.com'], credentials: true } for a separate front end
  rateLimit: { max: 300, windowMs: 60_000 }, // per IP per minute
  csrf: {}, // double-submit cookie; @kitr/http sends the token on every non-GET request
})
```

Each key takes its middleware's options, or `false` to turn it off. Headers, rate limiting and CSRF are on when their key is missing; CORS is off unless you set it. The defaults below are the ones the middleware uses when an option is left out. The generated file sets `rateLimit.max` to 300.

| Option | Default | Description |
| --- | --- | --- |
| `headers` | `{}` (on) | Security headers on every response. `false` turns them all off. |
| `headers.contentSecurityPolicy` | `DEFAULT_CSP` | `Content-Security-Policy` value, or `false` to leave it out. |
| `headers.hsts` | one year in production, `false` otherwise | `Strict-Transport-Security` max-age in seconds, or `false`. Always adds `includeSubDomains`. |
| `headers.frameOptions` | `'DENY'` | `X-Frame-Options`: `'DENY'`, `'SAMEORIGIN'` or `false`. |
| `headers.referrerPolicy` | `'strict-origin-when-cross-origin'` | `Referrer-Policy`, or `false`. |
| `headers.permissionsPolicy` | `'camera=(), microphone=(), geolocation=()'` | `Permissions-Policy`, or `false`. |
| `cors` | `false` (off) | CORS for a front end on another origin. |
| `cors.origin` | none: no CORS headers | `'*'`, a list of exact origins, or `(origin) => boolean`. |
| `cors.methods` | `GET, POST, PUT, PATCH, DELETE, OPTIONS` | Methods a preflight allows. |
| `cors.headers` | `Content-Type, Authorization, X-CSRF-Token, X-Requested-With` | Request headers a preflight allows. |
| `cors.credentials` | `false` | Let the browser send cookies. Refused with `origin: '*'`. |
| `cors.maxAge` | `600` | Seconds a browser may cache a preflight answer. |
| `rateLimit` | `{}` (on) | Fixed-window limit per client. `false` turns it off. |
| `rateLimit.windowMs` | `60000` | Window length in milliseconds. |
| `rateLimit.max` | `100` | Requests per key per window. |
| `rateLimit.key` | client IP | `(event) => string`: what counts as one client. |
| `rateLimit.trustProxy` | `false` | Read the client IP from the first `X-Forwarded-For` entry. |
| `rateLimit.store` | memory | Where counters live. Any `RateLimitStore`; `createRedisRateLimitStore(redis)` shares them between instances. |
| `rateLimit.ignore` | none | Path prefixes that are never limited. |
| `csrf` | `{}` (on) | Double-submit cookie CSRF. `false` turns it off. |
| `csrf.cookie` | `'kitr-csrf'` | Cookie that carries the token. |
| `csrf.header` | `'x-csrf-token'` | Header the client echoes the token in. |
| `csrf.methods` | `POST, PUT, PATCH, DELETE` | Methods that need a token. |
| `csrf.ignore` | none | Path prefixes that never need a token. |
| `csrf.secure` | `true` in production | Add `Secure` to the cookie. |

The shield reads one env variable:

| Variable | Used for |
| --- | --- |
| `NODE_ENV` | `production` turns on HSTS and the `Secure` flag on the CSRF cookie. The app's mode (`kitr build`, Vite's production mode) does the same, so hosts that never set `NODE_ENV` are covered. |

Config files are TypeScript, so you can vary values per environment. Tests often turn the rate limit off, because every test request comes from the same client:

```ts
// config/shield.ts
import { defineConfig } from '@kitr/shield'

export default defineConfig({
  headers: {},
  cors: { origin: ['https://app.acme.com'], credentials: true },
  rateLimit: process.env.NODE_ENV === 'test' ? false : { max: 300, windowMs: 60_000 },
  csrf: { ignore: ['/webhooks'] },
})
```

## Protect your API

After `kitr add shield`, start the server and ask it for anything:

```sh
curl -i http://localhost:3001/api/health
```

The response now carries the shield's headers:

```http
HTTP/1.1 200 OK
content-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
permissions-policy: camera=(), microphone=(), geolocation=()
ratelimit-limit: 300
ratelimit-remaining: 299
ratelimit-reset: 60
referrer-policy: strict-origin-when-cross-origin
set-cookie: kitr-csrf=ed33bfe66a21a75f218cbf44dd6d230f0f9087dbed1c8fc0; Path=/; SameSite=Lax
x-content-type-options: nosniff
x-frame-options: DENY
```

A `POST` without the CSRF token is refused:

```sh
curl -i -X POST http://localhost:3001/api/projects
```

```http
HTTP/1.1 403 Forbidden
content-type: application/json; charset=utf-8

{"code":"FORBIDDEN","message":"CSRF token missing or invalid","status":403}
```

Your own front end doesn't see that error: [@kitr/http](/packages/http) reads the `kitr-csrf` cookie and sends it back as `x-csrf-token` on every request that is not `GET`, `HEAD` or `OPTIONS`.

## Set security headers

`securityHeaders()` sets six headers on every response, error pages included:

| Header | Default value | Stops |
| --- | --- | --- |
| `X-Content-Type-Options` | `nosniff` | Browsers guessing a file is script. Always on. |
| `X-Frame-Options` | `DENY` | Other sites framing your pages (clickjacking). |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Full URLs leaking to other sites. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Pages using devices they don't need. |
| `Content-Security-Policy` | `DEFAULT_CSP` | Scripts, styles and frames from other origins. |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` in production | Plain-HTTP visits after the first HTTPS one. |

Change one header and the rest keep their defaults. Acme's dashboard needs its own page to frame the invoice preview, and the help widget needs the microphone:

```ts
// config/shield.ts
import { defineConfig } from '@kitr/shield'

export default defineConfig({
  headers: {
    frameOptions: 'SAMEORIGIN',
    permissionsPolicy: 'camera=(), microphone=(self), geolocation=()',
  },
})
```

Set a header to `false` to leave it out, for example when a proxy in front of the server already sends it. `X-Content-Type-Options: nosniff` can't be turned off.

## Tighten the Content-Security-Policy

`DEFAULT_CSP` allows scripts, styles, fonts and images from your own origin only, plus inline scripts and styles, which server-rendered React needs. Connections may go to your origin and to any WebSocket. Nothing may frame the page. The full value:

```ts
// server/security/csp.ts
import { DEFAULT_CSP } from '@kitr/shield'

console.log(DEFAULT_CSP)
// => default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
//    img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:;
//    frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```

When a page loads something from another origin, write the whole policy. Acme loads Stripe.js, avatars from `cdn.acme.com` and calls the API from the dashboard:

```ts
// config/shield.ts
import { defineConfig } from '@kitr/shield'

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://cdn.acme.com",
  "font-src 'self' data:",
  "connect-src 'self' https://api.acme.com wss://api.acme.com",
  'frame-src https://js.stripe.com',
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

export default defineConfig({
  headers: { contentSecurityPolicy: csp },
})
```

A resource the policy blocks shows up as an error in the browser console, naming the directive that refused it. See [MDN's CSP reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy) for every directive.

Don't fix a blocked resource with `default-src *`. Add the one origin that needs it to the one directive that names it.

## Turn on HSTS in production

HSTS tells browsers to use HTTPS for your domain, and its subdomains, for the next `max-age` seconds. The shield sends it only in production (the app's mode, or `NODE_ENV=production`), with a max-age of one year. To roll it out carefully, start short and raise it once every subdomain serves HTTPS:

```ts
// config/shield.ts
import { defineConfig } from '@kitr/shield'

export default defineConfig({
  headers: { hsts: process.env.NODE_ENV === 'production' ? 300 : false },
})
```

> **Warning**
> HSTS includes `includeSubDomains`. Once a browser has seen it, every subdomain of `acme.com` must serve HTTPS until the max-age runs out. A subdomain that only speaks HTTP becomes unreachable for those visitors.

## Allow a separate front end

Browsers refuse to let a page on one origin read responses from another unless the API says so with CORS. When the dashboard at `app.acme.com` calls the API at `api.acme.com`, list the dashboard's origin:

```ts
// config/shield.ts
import { defineConfig } from '@kitr/shield'

export default defineConfig({
  cors: { origin: ['https://app.acme.com'], credentials: true },
})
```

A request from `https://app.acme.com` now gets `Access-Control-Allow-Origin: https://app.acme.com`, `Access-Control-Allow-Credentials: true` and `Vary: Origin`. A preflight (`OPTIONS`) from it gets `204 No Content` with the allowed methods, headers and max-age, before any route, rate limit or CSRF check runs. A request from any other origin gets no CORS headers, so the browser blocks the read.

Origins in the list match exactly. `https://app.acme.com.evil.com`, `http://app.acme.com` and `https://app.acme.co` are all refused. To allow preview deploys on subdomains, pass a function:

```ts
// config/shield.ts
import { defineConfig } from '@kitr/shield'

export default defineConfig({
  cors: {
    origin: (origin) => origin === 'https://app.acme.com' || /^https:\/\/[a-z0-9-]+\.preview\.acme\.com$/.test(origin),
    credentials: true,
  },
})
```

Don't write `origin.endsWith('acme.com')`: `https://evilacme.com` ends with it too. Anchor the pattern and include the dot.

For a public, read-only API with no cookies, `origin: '*'` answers `Access-Control-Allow-Origin: *` to everyone. Combining `'*'` with `credentials: true` would let any website send requests with your users' cookies, so the shield refuses it. `cors()` throws when it is created, and the provider stops the app at boot:

```text
Error: [@kitr/shield] cors.origin "*" cannot be combined with credentials; list the origins instead.
```

Projects scaffolded from a kit put `cors()` from [@kitr/api](/packages/api) on the `/api` route group. Once the shield handles CORS, remove that middleware from `server/routes.ts`, so one place decides which origins may call the API.

## Protect cookie sessions from CSRF

CSRF is another site making the browser post to your API with your user's cookies attached. The shield uses the double-submit cookie pattern: it sets a random token in a readable `kitr-csrf` cookie, and every `POST`, `PUT`, `PATCH` and `DELETE` must send the same value back in the `x-csrf-token` header. Another site can make the browser send the cookie, but it cannot read it, so it cannot write the header.

The cookie is set on the first response that finds none: 48 hex characters, `Path=/`, `SameSite=Lax`, plus `Secure` in production. It is not `HttpOnly`, because your own page has to read it.

With [@kitr/http](/packages/http), you do nothing. With plain `fetch`, read the cookie and send it:

```ts
// app/lib/post_json.ts
function csrfToken(): string | undefined {
  const match = document.cookie.match(/(?:^|;\s*)kitr-csrf=([^;]+)/)
  return match ? decodeURIComponent(match[1]!) : undefined
}

export async function postJson(path: string, body: unknown) {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken() ?? '' },
    body: JSON.stringify(body),
  })
  return response.json()
}

// await postJson('/api/projects', { name: 'Billing v2' })
// => { id: '7', name: 'Billing v2' }
```

A missing header, a header that differs from the cookie, or a header with no cookie all get `403` with code `FORBIDDEN`.

You can rename the cookie and header with `csrf.cookie` and `csrf.header`. @kitr/http always reads `kitr-csrf` and sends `x-csrf-token`, so renaming either means sending the token yourself.

The cookie has no `Domain` attribute, so only pages on the API's own host can read it. When the front end lives on another host, as `app.acme.com` does for `api.acme.com`, serve the API under the front end's host (`app.acme.com/api` through a proxy, or the web platform's `/api/*` route), or authenticate that front end with a bearer token instead of a cookie.

An API that authenticates every request with an `Authorization` header and never with cookies, such as one used only by Acme's mobile app, is not exposed to CSRF. There, `csrf: false` is safe:

```ts
// config/shield.ts
import { defineConfig } from '@kitr/shield'

export default defineConfig({
  csrf: false, // bearer tokens only: no cookie for another site to ride on
})
```

> **Warning**
> Turn CSRF off only when no route accepts a cookie session. One cookie-authenticated `POST` behind `csrf: false` is open to every site your users visit.

## Accept webhooks

Stripe, GitHub and other services post to your API from their servers. They have no cookie and send no CSRF header. Exempt their paths with `csrf.ignore`, and keep them out of the rate limit, which would count every webhook from one provider as one client:

```ts
// config/shield.ts
import { defineConfig } from '@kitr/shield'

export default defineConfig({
  csrf: { ignore: ['/webhooks'] },
  rateLimit: { max: 300, windowMs: 60_000, ignore: ['/webhooks', '/healthz'] },
})
```

`ignore` matches path prefixes on a segment boundary: `/webhooks` covers `/webhooks` and `/webhooks/stripe`, but not `/webhooksfake`. An exempt route must check the request itself, for example by verifying Stripe's signature header, because nothing else now stands in front of it.

## Rate limit requests

The rate limit counts requests per client in fixed windows. The generated config allows 300 requests per IP per minute. Every response says where the client stands:

| Header | Value |
| --- | --- |
| `RateLimit-Limit` | `max` |
| `RateLimit-Remaining` | Requests left in this window |
| `RateLimit-Reset` | Seconds until the window resets |
| `Retry-After` | Seconds to wait; only on a 429 |

The request after the last allowed one gets `429`:

```http
HTTP/1.1 429 Too Many Requests
ratelimit-limit: 300
ratelimit-remaining: 0
ratelimit-reset: 41
retry-after: 41

{"code":"RATE_LIMITED","message":"Too many requests","status":429}
```

The window is fixed: it starts with a client's first request and resets `windowMs` later, whatever happened in between. A client can therefore send up to `2 × max` requests across a window boundary. For a global limit that is fine.

Rate limiting runs before CSRF, so a flood of forged posts is cut off by the counter before any token is compared. Preflights are answered by CORS before the rate limit, so they never count.

## Limit one route more tightly

The config sets one limit for the whole server. For a stricter limit on one route, such as sign-in, wrap `rateLimit()` in a middleware that only applies on that path and add it after the shield:

```ts
// server/security/sign_in_limit.ts
import { rateLimit } from '@kitr/shield'
import type { Middleware } from 'h3'

const limiter = rateLimit({ max: 5, windowMs: 15 * 60_000 })

/** Five sign-in attempts per IP per 15 minutes, on top of the global limit. */
export const signInLimit: Middleware = (event, next) =>
  new URL(event.req.url).pathname === '/api/auth/sign-in' ? limiter(event, next) : next()
```

```ts
// server/main.ts
import { createServer } from '@kitr/server'
import { shield } from '@kitr/shield'
import { config } from '../config'
import rc from '../kitrrc'
import { signInLimit } from './security/sign_in_limit'

export const server = createServer({ providers: rc.providers, config })
// Security headers, CORS, rate limit and CSRF from config/shield.ts.
shield(server)
server.use(signInLimit)
// ...
```

The sixth attempt from one IP within 15 minutes gets `429`. The headers on that response describe the tighter limit, because it runs last.

## Share rate limits between instances

The default store counts in each process. With three instances behind a load balancer, a client spread across them gets three times `max`, and a restart resets every counter. On the server, `createRedisRateLimitStore` keeps the counters in [Redis](https://redis.io) so every instance counts against one limit. Install a Redis client. The store takes an [ioredis](https://github.com/redis/ioredis) client:

```sh
pnpm add ioredis
```

```ts
// config/shield.ts
import { createRedisRateLimitStore, defineConfig } from '@kitr/shield'
import { Redis } from 'ioredis'

export default defineConfig({
  headers: {},
  cors: { origin: ['https://app.acme.com'], credentials: true },
  rateLimit: {
    max: 300,
    windowMs: 60_000,
    trustProxy: true,
    store: createRedisRateLimitStore(new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379'), {
      prefix: 'acme-app:rl:',
    }),
  },
  csrf: { ignore: ['/webhooks'] },
})
```

Add the connection string to `.env`:

```sh
REDIS_URL=redis://localhost:6379
```

Each window is one Redis key under `prefix` (default `kitr:rl:`). The first request in a window creates it with `SET ... PX windowMs NX`, so it expires on its own and a crash between commands never leaves a counter that lives forever; each request after that is one `INCR`. When Linus's 301st request of the minute reaches instance C after 300 went to A and B, C answers `429` with the same `RateLimit-*` headers.

Behind a load balancer, set `trustProxy` too (see [Run behind a proxy](#run-behind-a-proxy)): otherwise every request appears to come from the balancer and all visitors share one counter. The same store works for the per-route `rateLimit()` in [Limit one route more tightly](#limit-one-route-more-tightly) and for `rateLimit()` from [@kitr/api](/packages/api).

## Run behind a proxy

By default the rate limit keys on the address of the TCP connection. Behind a load balancer or CDN, that is the proxy's address, so every visitor shares one counter and the whole site is limited together. Turn on `trustProxy` to read the client from `X-Forwarded-For`:

```ts
// config/shield.ts
import { defineConfig } from '@kitr/shield'

export default defineConfig({
  rateLimit: { max: 300, windowMs: 60_000, trustProxy: true },
})
```

The shield then uses the first entry of `X-Forwarded-For`. A request with neither a header nor a connection address is counted under `anonymous`.

> **Warning**
> Only set `trustProxy: true` when every request passes through a proxy you control that overwrites `X-Forwarded-For`. Without one, a client can send a new value with each request and is never limited.

## Key the limit on something else

`rateLimit.key` decides what counts as one client. It gets the [h3 event](https://h3.dev/guide/api/h3event) and returns a string. Acme's partner API is called from a few servers that each send an `x-acme-partner` id; limit per partner, falling back to the IP:

```ts
// config/shield.ts
import { defineConfig } from '@kitr/shield'

export default defineConfig({
  rateLimit: {
    max: 1000,
    windowMs: 60_000,
    key: (event) =>
      event.req.headers.get('x-acme-partner') ?? (event.req as { ip?: string }).ip ?? 'anonymous',
  },
})
```

The shield runs before your routes and before auth middleware, so the signed-in user is not known yet when `key` runs. Key on something in the request itself.

Only key on a header that a client cannot change at will, or that you verify elsewhere. A client that can invent a new key per request gets a fresh counter every time.

## Use the middlewares one by one

`shield(server)` reads `config/shield.ts` and adds the middlewares in a fixed order: headers, CORS, rate limit, CSRF. Pass a config as the second argument to skip the file:

```ts
// server/main.ts
import { createServer } from '@kitr/server'
import { shield } from '@kitr/shield'

export const server = createServer()
shield(server, { cors: { origin: ['https://app.acme.com'] }, csrf: false })
```

`shieldMiddlewares(config)` returns the same list without attaching it, for any server with a `use()` method. Each middleware is also exported on its own:

```ts
// server/main.ts
import { createServer } from '@kitr/server'
import { cors, csrf, rateLimit, securityHeaders } from '@kitr/shield'

export const server = createServer()
server.use(securityHeaders({ frameOptions: 'SAMEORIGIN' }))
server.use(cors({ origin: ['https://app.acme.com'], credentials: true }))
server.use(rateLimit({ max: 300 }))
server.use(csrf({ ignore: ['/webhooks'] }))
```

| Export | Returns | Description |
| --- | --- | --- |
| `shield(server, config?)` | the server | Attach every middleware the config asks for. |
| `shieldMiddlewares(config)` | `Middleware[]` | The same list, unattached. `{}` gives headers, rate limit and CSRF. |
| `securityHeaders(options)` | `Middleware` | Security headers. |
| `cors(options)` | `Middleware` | CORS and preflights. |
| `rateLimit(options)` | `Middleware` | Fixed-window limit. |
| `csrf(options)` | `Middleware` | Double-submit cookie CSRF. |
| `createMemoryRateLimitStore()` | `RateLimitStore` | The default in-process counter store. |

Keep the order when you attach them by hand: CORS must answer preflights before the rate limit and CSRF see them, and the rate limit must run before CSRF.

## Errors

| Code | When | What to do |
| --- | --- | --- |
| `FORBIDDEN` (403) | A `POST`, `PUT`, `PATCH` or `DELETE` without a CSRF header, or with one that differs from the `kitr-csrf` cookie. Message `CSRF token missing or invalid`. | Send the request with [@kitr/http](/packages/http), or read the cookie and send `x-csrf-token`. Add webhook paths to `csrf.ignore`. |
| `RATE_LIMITED` (429) | A client sent more than `max` requests in the window. Message `Too many requests`. | Wait `Retry-After` seconds. On your side, raise `max`, add `ignore` paths, or set `trustProxy` behind a proxy. |
| Boot error | `cors.origin` is `'*'` and `cors.credentials` is `true`. | List the origins instead of `'*'`. |

Both runtime errors are `KitrError` responses, so the body is `{ code, message, status }` and @kitr/http throws them as `KitrError` on the client. The 429 still carries the CORS headers, so the front end can read it and show a message.

## Testing

Build a small server in the test, attach the shield with an explicit config, and call `server.fetch()`. This needs no network and no port:

```ts
// server/security/shield.test.ts
import { silentLogger } from '@kitr/logger'
import { createServer } from '@kitr/server'
import { shield } from '@kitr/shield'
import { describe, expect, it } from 'vitest'

function acmeServer() {
  const server = createServer({ logger: silentLogger })
  shield(server, {
    cors: { origin: ['https://app.acme.com'], credentials: true },
    rateLimit: { max: 2, windowMs: 60_000, key: () => 'ada' },
    csrf: { ignore: ['/webhooks'] },
  })
  server.h3.get('/api/projects', () => [{ id: '1', name: 'Billing v2' }])
  server.h3.post('/api/projects', () => ({ id: '2' }))
  server.h3.post('/webhooks/stripe', () => ({ received: true }))
  return server
}

describe('shield', () => {
  it('sets security headers and answers the dashboard origin', async () => {
    const res = await acmeServer().fetch(
      new Request('http://api.acme.com/api/projects', { headers: { origin: 'https://app.acme.com' } }),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.acme.com')
  })

  it('refuses a POST without the CSRF token and accepts one with it', async () => {
    const server = acmeServer()
    const denied = await server.fetch(new Request('http://api.acme.com/api/projects', { method: 'POST' }))
    expect(denied.status).toBe(403)
    expect(await denied.json()).toMatchObject({ code: 'FORBIDDEN' })

    const token = 'a'.repeat(48)
    const allowed = await server.fetch(
      new Request('http://api.acme.com/api/projects', {
        method: 'POST',
        headers: { cookie: `kitr-csrf=${token}`, 'x-csrf-token': token },
      }),
    )
    expect(allowed.status).toBe(200)
  })

  it('lets webhooks through without a token and limits the third request', async () => {
    const server = acmeServer()
    const hook = await server.fetch(new Request('http://api.acme.com/webhooks/stripe', { method: 'POST' }))
    expect(hook.status).toBe(200)
    const second = await server.fetch(new Request('http://api.acme.com/api/projects'))
    expect(second.headers.get('ratelimit-remaining')).toBe('0')
    const limited = await server.fetch(new Request('http://api.acme.com/api/projects'))
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBeTruthy()
  })
})
```

`webhooks/stripe` is exempt from CSRF but still counted by this test's rate limit, because the test config does not list it in `rateLimit.ignore`.

To test your real app, import `server` from `#server/main` and use `createTestClient` from [testing](/packages/testing). The real config applies, so set `rateLimit: false` for `NODE_ENV=test` (see [Configure](#configure)), and send the CSRF cookie and header on writes:

```ts
// test/projects.test.ts
import { createTestClient } from '@kitr/testing'
import { expect, it } from 'vitest'
import { server } from '#server/main'

const token = 'b'.repeat(48)
const client = createTestClient(server, {
  headers: { cookie: `kitr-csrf=${token}`, 'x-csrf-token': token },
})

it('creates a project through the shield', async () => {
  const res = await client.post<{ id: string }>('/api/projects', { name: 'Billing v2' })
  expect(res.status).toBe(201)
})
```

## Extend

The rate limit stores its counters through a `RateLimitStore`: one method that increments a key and returns the count and when its window resets.

```ts
interface RateLimitStore {
  /** Increment and return the count and when the window resets (ms epoch). */
  hit(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>
}
```

The default memory store counts per process; `createRedisRateLimitStore` shares counters through Redis (see [Share rate limits between instances](#share-rate-limits-between-instances)). Any other shared store is one method. This one keeps counters in a [Cloudflare Workers KV](https://developers.cloudflare.com/kv/) namespace, which suits a Workers deployment without Redis. KV is eventually consistent, so the limit is approximate across locations:

```ts
// server/security/kv_rate_limit_store.ts
import type { RateLimitStore } from '@kitr/shield'

interface KvNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options: { expirationTtl: number }): Promise<void>
}

export function createKvRateLimitStore(kv: KvNamespace, prefix = 'acme-app:rl:'): RateLimitStore {
  return {
    async hit(key, windowMs) {
      const now = Date.now()
      const window = Math.floor(now / windowMs)
      const name = `${prefix}${key}:${window}`
      const count = Number((await kv.get(name)) ?? 0) + 1
      // KV expires keys after at least 60 seconds.
      await kv.put(name, String(count), { expirationTtl: Math.max(60, Math.ceil(windowMs / 1000)) })
      return { count, resetAt: (window + 1) * windowMs }
    },
  }
}
```

Register it in the config:

```ts
// config/shield.ts
import { defineConfig } from '@kitr/shield'
import { createKvRateLimitStore } from '#server/security/kv_rate_limit_store'
import { env } from 'cloudflare:workers'

export default defineConfig({
  rateLimit: { max: 300, windowMs: 60_000, store: createKvRateLimitStore(env.RATE_LIMITS) },
})
```

Windows here line up on the clock (`Math.floor(now / windowMs)`), so every key resets at the same moment. See [`RateLimitStore`](/packages/shield/api#ratelimitstore) in the API reference.

## Next steps

- [API reference](/packages/shield/api): every export with its signature.
- [Server](/packages/server): the h3 server the shield attaches to.
- [HTTP](/packages/http): the client that sends the CSRF token for you.
- [Auth](/packages/auth): sessions, sign-in and permissions.
- [Run on more than one instance](/guides/scale-out): shared rate limits, cache, queue and sockets.
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/): what each header defends against.
