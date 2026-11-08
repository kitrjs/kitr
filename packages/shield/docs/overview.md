---
title: Overview
description: Turn on the security basics every API needs: CORS, CSRF protection, safe headers and rate limits.
order: 0
---

# Shield

Every API that a browser can reach gets the same unwanted visitors: other sites that try to post forms as your signed-in users, pages that frame yours to trick clicks, scripts that hammer the sign-in route. The defences are well known and each is a middleware. The mistakes are well known too: CORS for every origin with cookies on, a CSP that breaks the app, a rate limit keyed on the proxy's IP.

`@kitr/shield` turns on the four defences from one config file, in the right order, and refuses settings that would open a hole.

## What it is

`@kitr/shield` adds four middlewares to the [server](/packages/server): `securityHeaders` (Content-Security-Policy, frame options, HSTS and friends), `cors` for a separate front end, `csrf` for cookie sessions, and `rateLimit` per client. `config/shield.ts` configures all four; `shieldMiddlewares` gives them to you one by one when a route needs different rules, such as a webhook that must accept cross-site POSTs.

It runs on the server only, in front of every route. It does not know who the user is: sign-in, sessions and permissions are [auth](/packages/auth)'s job.

## Install

```sh
kitr add shield
```

This installs `@kitr/shield`, registers the provider in `kitrrc.ts`, writes `config/shield.ts` and adds `shield(server)` to `server/main.ts` straight after `createServer()`, so the shield sees every request first. It adds [server](/packages/server) first when the project does not have it. The guide's [Install](/packages/shield/guide#install) section lists every change.

## Quick start

There is nothing to write. Start the server and ask it for anything:

```sh
curl -i http://localhost:3001/api/health
```

```http
HTTP/1.1 200 OK
content-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
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

{"code":"FORBIDDEN","message":"CSRF token missing or invalid","status":403}
```

Your own front end never sees that error: [http](/packages/http) reads the `kitr-csrf` cookie and sends it back as `x-csrf-token` on every request that is not `GET`, `HEAD` or `OPTIONS`. Tune the limits and origins in `config/shield.ts`. The guide continues from here: [Protect your API](/packages/shield/guide#protect-your-api).

## Built on

Each defence is a plain [h3](https://h3.dev/guide/basics/middleware) middleware with no dependencies of its own. The headers follow the [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/); the CSRF protection uses the double-submit cookie pattern the [http](/packages/http) client sends for you; the rate limiter uses a `RateLimitStore` with a memory implementation built in.

kitr adds the defaults, the order the middlewares run in, the config file, the refusals for unsafe combinations, and the per-route overrides.

## Problems it solves

- **Missing security headers.** A safe default set on every response, with a CSP you can tighten. See [Set security headers](/packages/shield/guide#set-security-headers).
- **A front end on another origin.** CORS for the origins you list, with credentials only when it is safe. See [Allow a separate front end](/packages/shield/guide#allow-a-separate-front-end).
- **Forms posted by other sites.** CSRF tokens for cookie sessions, checked on every unsafe method. See [Protect cookie sessions from CSRF](/packages/shield/guide#protect-cookie-sessions-from-csrf).
- **Webhooks blocked by your own CSRF check.** Exempt the webhook route and verify its signature instead. See [Accept webhooks](/packages/shield/guide#accept-webhooks).
- **Brute force on sign-in.** A global rate limit, and a tighter one on the routes that need it. See [Rate limit requests](/packages/shield/guide#rate-limit-requests) and [Limit one route more tightly](/packages/shield/guide#limit-one-route-more-tightly).
- **Limits keyed on the proxy.** Trust the proxy's forwarded address. See [Run behind a proxy](/packages/shield/guide#run-behind-a-proxy).

## Further reading

- [Guide](/packages/shield/guide): install, configure and every task.
- [API reference](/packages/shield/api): every export with its signature.
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/): what each header defends against.
- [h3 middleware](https://h3.dev/guide/basics/middleware): how the middlewares attach.
- [Server](/packages/server), [HTTP](/packages/http) and [Auth](/packages/auth): the server, the client that sends the CSRF token, and who the user is.
