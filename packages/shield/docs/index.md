---
title: Shield
description: "Turn on the security basics every API needs: CORS, CSRF protection, safe headers and rate limits."
order: 1
---

# Shield

Other sites post forms as your signed-in users, pages frame yours to trick clicks, scripts hammer the sign-in route. `@kitr/shield` turns on the four defences every API needs from one config file: safe response headers, CORS for a separate front end, CSRF protection for cookie sessions, and a rate limit per client.

> [!SUMMARY]
> Security headers, CORS, CSRF protection and rate limits for your server, from one config file. Add it with `kitr add shield`; the overview is at [/packages/shield](/packages/shield).

Each defence is a plain [h3](https://h3.dev/guide/basics/middleware) middleware. kitr adds the defaults, the order they run in, and refusals for settings that would open a hole, such as CORS for every origin with cookies. The shield runs on the server only and does not know who the user is: sign-in and permissions are [auth](/packages/auth)'s job.

The examples follow Acme's API at `api.acme.com`, used by the dashboard at `app.acme.com`, with cookie sessions and Stripe webhooks at `/webhooks/stripe`.

## Install

```sh
kitr add shield
```

<details>
<summary>Everything kitr add changes</summary>

- Adds the [server](/packages/server) package first if the project does not have it (and [logger](/packages/logger), which the server needs).
- Adds `@kitr/shield` to `dependencies` and installs it. Pass `--no-install` to skip the install.
- Adds the provider to `providers` and `'@kitr/shield'` to `packages` in `kitrrc.ts`. The provider checks `config/shield.ts` at boot.
- Writes `config/shield.ts` (see [Configure](#configure)).
- Edits `server/main.ts`, when it exists and does not already call `shield(server`: imports `shield` and calls `shield(server)` straight after `createServer()`.
- Adds a `## kitr: shield` section to `AGENTS.md`.

It adds no env variables or scripts and asks no questions. No kit includes the shield.

`kitr remove shield` undoes all of it except the edit to `server/main.ts`: delete the `shield` import and the `shield(server)` line yourself.

</details>

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

If the project has no `server/main.ts` yet, add those two lines once the server platform has written it (`kitr add server api`).

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

Each key takes its middleware's options, or `false` to turn it off. Headers, rate limiting and CSRF are on when their key is missing; CORS is off unless you set it. The table lists what each option defaults to when left out.

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
| `NODE_ENV` | `production` turns on HSTS and a `Secure` CSRF cookie. A production build does too. |

Config files are TypeScript, so values can vary per environment. Tests often turn the rate limit off, because every test request comes from the same client:

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
content-security-policy: default-src 'self'; script-src 'self' 'nonce-Zr3x0u6Gm1l8dQe0c8Z0Nw=='; style-src 'self' 'nonce-Zr3x0u6Gm1l8dQe0c8Z0Nw=='; style-src-attr 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
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

Your own front end doesn't see that error: [@kitr/http](/packages/http) sends the `kitr-csrf` cookie back as `x-csrf-token` on every write.

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

Set a header to `false` to leave it out, for example when a proxy already sends it. `X-Content-Type-Options` can't be turned off.

## Tighten the Content-Security-Policy

`DEFAULT_CSP` allows scripts, styles, fonts and images from your own origin only. Inline tags run only with the request's nonce, a random value made for each response, so the page's own inline scripts run and injected ones do not. `{nonce}` stands for that value:

```ts
// server/security/csp.ts
import { DEFAULT_CSP } from '@kitr/shield'

console.log(DEFAULT_CSP)
// => default-src 'self'; script-src 'self' 'nonce-{nonce}'; style-src 'self' 'nonce-{nonce}';
//    style-src-attr 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:;
//    connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```

`style-src-attr 'unsafe-inline'` covers `style="..."` attributes only, which cannot run script. Outside production, styles also allow `'unsafe-inline'`, because Vite's dev server injects `<style>` tags without a nonce.

### Pages get the nonce

The nonce lives in the request context of `@kitr/server`, so pages must be rendered inside the server's middleware. A new React app's `app/server.ts` does that:

```ts
// app/server.ts
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { server } from '#server/main'

export default createServerEntry({
  fetch(request, options) {
    return server.fetch(request, {
      pages: (request) => {
        return handler.fetch(request, options)
      },
    })
  },
})
```

Paths the server has routes for are answered there; every other path goes to `pages`, with the shield's headers on the response.

The nonce then reaches every inline tag without more code:

- `createKitrRouter` sets `router.options.ssr.nonce` for TanStack Start's scripts.
- `<ThemeScript />` from `@kitr/theme` puts it on its script and style.
- Your own inline tags call `useCspNonce()`, which returns `undefined` in the browser and outside a request:

```tsx
// app/components/analytics-snippet.tsx
import { useCspNonce } from '@kitr/shield'

export function AnalyticsSnippet() {
  const nonce = useCspNonce()
  return (
    <script
      nonce={nonce}
      suppressHydrationWarning
      // biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed snippet, no user input
      dangerouslySetInnerHTML={{ __html: "window.dataLayer = window.dataLayer || []" }}
    />
  )
}
```

`suppressHydrationWarning` says the browser's missing nonce is expected: browsers hide a nonce once they accept it. Code that has the h3 event instead of React uses `getCspNonce(event)`.

### Write the whole policy

When a page loads something from another origin, write the whole policy and put `{nonce}` where inline tags should be allowed. Acme loads Stripe.js, avatars from `cdn.acme.com` and calls the API from the dashboard:

```ts
// config/shield.ts
import { defineConfig } from '@kitr/shield'

const csp = [
  "default-src 'self'",
  "script-src 'self' 'nonce-{nonce}' https://js.stripe.com",
  "style-src 'self' 'nonce-{nonce}'",
  "style-src-attr 'unsafe-inline'",
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

A blocked resource shows up in the browser console, naming the directive that refused it. See [MDN's CSP reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy) for every directive.

> [!WARNING]
> Don't fix a blocked resource with `default-src *`. Add the one origin that needs it to the one directive that names it.

### Trust the scripts your scripts load

Acme's tag manager loads more scripts at run time from changing hosts. `strictDynamic` adds `'strict-dynamic'` to the default `script-src`: a script with the nonce is trusted, and so is every script it adds. Supporting browsers then ignore `'self'` and host lists, so only the nonce matters.

```ts
// config/shield.ts
import { defineConfig } from '@kitr/shield'

export default defineConfig({
  headers: { strictDynamic: true },
})
```

### Allow every inline script

A third-party widget that writes its own `<script>` or `<style>` tags cannot carry a nonce. If you cannot replace it, `unsafeInline: true` allows `'unsafe-inline'` for scripts and styles and sends no nonce.

```ts
// config/shield.ts
import { defineConfig } from '@kitr/shield'

export default defineConfig({
  headers: { unsafeInline: true },
})
```

> [!WARNING] Unsafe inline
> With `'unsafe-inline'` in `script-src`, any markup that reaches the page, such as unescaped user content, runs script as your site. Prefer a widget that accepts a nonce, or load it in an iframe from its own origin with `frame-src`.

## Turn on HSTS in production

HSTS tells browsers to use HTTPS for your domain and its subdomains for the next `max-age` seconds. The shield sends it only in production, with a max-age of one year. To roll it out carefully, start short and raise it once every subdomain serves HTTPS:

```ts
// config/shield.ts
import { defineConfig } from '@kitr/shield'

export default defineConfig({
  headers: { hsts: process.env.NODE_ENV === 'production' ? 300 : false },
})
```

> [!WARNING] Subdomains
> HSTS includes `includeSubDomains`. Once a browser has seen it, every subdomain of `acme.com` must serve HTTPS until the max-age runs out, or it becomes unreachable for those visitors.

## Allow a separate front end

Browsers refuse to let a page read responses from another origin unless the API allows it with CORS. For the dashboard at `app.acme.com` calling `api.acme.com`, list its origin:

```ts
// config/shield.ts
import { defineConfig } from '@kitr/shield'

export default defineConfig({
  cors: { origin: ['https://app.acme.com'], credentials: true },
})
```

`origin` takes `'*'`, one origin, a list or a function `(origin) => boolean`. The `cors()` that `@kitr/api` exports for route groups takes the same options and follows the same rules.

A request from `https://app.acme.com` gets `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials: true` and `Vary: Origin`. Its preflight (`OPTIONS`) gets `204` before any route, rate limit or CSRF check runs. Any other origin gets no CORS headers, so the browser blocks the read.

Listed origins match exactly, so `https://app.acme.com.evil.com` and `http://app.acme.com` are refused. To allow preview deploys on subdomains, pass a function:

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

> [!WARNING] Anchor the pattern
> Don't write `origin.endsWith('acme.com')`: `https://evilacme.com` ends with it too. Anchor the pattern and include the dot.

For a public, read-only API with no cookies, `origin: '*'` answers everyone. Combined with `credentials: true` it would let any website send requests with your users' cookies, so the shield refuses it and the provider stops the app at boot:

```text
Error: [@kitr/shield] cors.origin "*" cannot be combined with credentials; list the origins instead.
```

Projects scaffolded from a kit put `cors()` from [@kitr/api](/packages/api) on the `/api` route group. Once the shield handles CORS, remove that middleware from `server/routes.ts`.

## Protect cookie sessions from CSRF

CSRF is another site making the browser post to your API with your user's cookies. The shield sets a random token in a readable `kitr-csrf` cookie, and every `POST`, `PUT`, `PATCH` and `DELETE` must send the same value in the `x-csrf-token` header. Another site can make the browser send the cookie but cannot read it, so it cannot write the header.

The cookie is `Path=/`, `SameSite=Lax`, plus `Secure` in production. It is not `HttpOnly`, because your own page has to read it.

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

<details>
<summary>Renaming the token, and front ends on another host</summary>

`csrf.cookie` and `csrf.header` rename the cookie and header, but @kitr/http always uses `kitr-csrf` and `x-csrf-token`, so renaming either means sending the token yourself.

The cookie has no `Domain` attribute, so only pages on the API's own host can read it. When the front end lives on another host, serve the API under the front end's host (`app.acme.com/api` through a proxy, or the web platform's `/api/*` route), or authenticate that front end with a bearer token.

</details>

An API that authenticates every request with an `Authorization` header and never with cookies, such as one used only by a mobile app, is not exposed to CSRF, so `csrf: false` is safe:

```ts
// config/shield.ts
import { defineConfig } from '@kitr/shield'

export default defineConfig({
  csrf: false, // bearer tokens only: no cookie for another site to ride on
})
```

> [!WARNING] Cookie sessions
> Turn CSRF off only when no route accepts a cookie session. One cookie-authenticated `POST` behind `csrf: false` is open to every site your users visit.

## Accept webhooks

Stripe, GitHub and other services post from their servers with no cookie and no CSRF header. Exempt their paths with `csrf.ignore`, and keep them out of the rate limit, which would count every webhook from one provider as one client:

```ts
// config/shield.ts
import { defineConfig } from '@kitr/shield'

export default defineConfig({
  csrf: { ignore: ['/webhooks'] },
  rateLimit: { max: 300, windowMs: 60_000, ignore: ['/webhooks', '/healthz'] },
})
```

`ignore` matches path prefixes on a segment boundary: `/webhooks` covers `/webhooks/stripe`, not `/webhooksfake`.

> [!WARNING] Verify the sender
> An exempt route must check the request itself, for example by verifying Stripe's signature header.

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

<details>
<summary>How the window works</summary>

The window is fixed: it starts with a client's first request and resets `windowMs` later, so a client can send up to `2 × max` requests across a boundary. Rate limiting runs before CSRF, so forged posts are cut off before any token is compared. Preflights are answered by CORS first and never count.

</details>

## Limit one route more tightly

The config sets one limit for the whole server. For a stricter limit on one route, such as sign-in, wrap `rateLimit()` in a middleware for that path and add it after the shield:

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

The sixth attempt from one IP within 15 minutes gets `429`, with headers describing the tighter limit.

## Share rate limits between instances

The default store counts in each process, so a client spread across three instances gets three times `max`, and a restart resets every counter. `createRedisRateLimitStore` keeps counters in [Redis](https://redis.io) so every instance counts against one limit. It takes an [ioredis](https://github.com/redis/ioredis) client:

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

Each window is one Redis key under `prefix` (default `kitr:rl:`) that expires on its own. When a client's 301st request of the minute reaches instance C after 300 went to A and B, C answers `429`.

Behind a load balancer, set `trustProxy` too (see [Run behind a proxy](#run-behind-a-proxy)). The same store works for the per-route `rateLimit()` above and for `rateLimit()` from [@kitr/api](/packages/api).

## Run behind a proxy

By default the rate limit keys on the TCP connection's address. Behind a load balancer or CDN that is the proxy's address, so every visitor shares one counter. Turn on `trustProxy` to read the client from the first `X-Forwarded-For` entry:

```ts
// config/shield.ts
import { defineConfig } from '@kitr/shield'

export default defineConfig({
  rateLimit: { max: 300, windowMs: 60_000, trustProxy: true },
})
```

A request with neither a header nor a connection address is counted under `anonymous`.

> [!WARNING] Trust only your proxy
> Set `trustProxy: true` only when every request passes through a proxy you control that overwrites `X-Forwarded-For`. Otherwise a client can send a new value each time and is never limited.

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

The shield runs before auth middleware, so the signed-in user is not known when `key` runs: key on something in the request itself.

> [!WARNING] Key on what clients cannot change
> A client that can invent a new key per request gets a fresh counter every time.

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

Keep this order when attaching by hand: CORS answers preflights before the rate limit and CSRF see them, and the rate limit runs before CSRF.

## Errors

| Code | When | What to do |
| --- | --- | --- |
| `FORBIDDEN` (403) | A `POST`, `PUT`, `PATCH` or `DELETE` without a CSRF header, or with one that differs from the `kitr-csrf` cookie. Message `CSRF token missing or invalid`. | Send the request with [@kitr/http](/packages/http), or read the cookie and send `x-csrf-token`. Add webhook paths to `csrf.ignore`. |
| `RATE_LIMITED` (429) | A client sent more than `max` requests in the window. Message `Too many requests`. | Wait `Retry-After` seconds. On your side, raise `max`, add `ignore` paths, or set `trustProxy` behind a proxy. |
| Boot error | `cors.origin` is `'*'` and `cors.credentials` is `true`. | List the origins instead of `'*'`. |

Both runtime errors are `KitrError` responses with the body `{ code, message, status }`. The 429 still carries the CORS headers, so the front end can read it.

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

`webhooks/stripe` is exempt from CSRF but still counted by this rate limit, because the test config does not list it in `rateLimit.ignore`.

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

The default memory store counts per process; `createRedisRateLimitStore` shares counters through Redis. Any other shared store is one method. This one uses a [Cloudflare Workers KV](https://developers.cloudflare.com/kv/) namespace, which suits Workers without Redis. KV is eventually consistent, so the limit is approximate across locations:

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

Windows line up on the clock (`Math.floor(now / windowMs)`), so every key resets at the same moment. See [`RateLimitStore`](/packages/shield/api#ratelimitstore) in the API reference.

## Next steps

- [API reference](/packages/shield/api): every export with its signature.
- [HTTP](/packages/http): the client that sends the CSRF token for you.
- [Run on more than one instance](/guides/scale-out): shared rate limits, cache, queue and sockets.
