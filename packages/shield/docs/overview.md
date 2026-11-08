---
title: Overview
description: Turn on the security basics every API needs: CORS, CSRF protection, safe headers and rate limits.
order: 0
---

# Shield

## What it is

`@kitr/shield` adds four middlewares to the [server](/packages/server): security headers, CORS, CSRF and rate limiting. `config/shield.ts` configures them; `shieldMiddlewares` hands them out one by one for routes with different rules.

Runs on the server only. It does not know who the user is: that is [auth](/packages/auth).

## Install

```sh
kitr add shield
```

Adds `@kitr/shield`, its provider, `config/shield.ts` and `shield(server)` in `server/main.ts`. Adds [server](/packages/server) first if missing. [Every change](/packages/shield/guide#install).

## Quick start

Nothing to write. Start the server and ask for anything:

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

Your own front end never sees that error: [http](/packages/http) sends the CSRF token for you. Tune limits and origins in `config/shield.ts`. Next in the guide: [Protect your API](/packages/shield/guide#protect-your-api).

## Built on

kitr adds the defaults, the order, the config file and the per-route overrides.

## Problems it solves

- **Missing security headers.** [Set security headers](/packages/shield/guide#set-security-headers).
- **A front end on another origin.** [Allow a separate front end](/packages/shield/guide#allow-a-separate-front-end).
- **Forms posted by other sites.** [Protect cookie sessions from CSRF](/packages/shield/guide#protect-cookie-sessions-from-csrf).
- **Webhooks blocked by your own CSRF check.** [Accept webhooks](/packages/shield/guide#accept-webhooks).
- **Brute force on sign-in.** [Rate limit requests](/packages/shield/guide#rate-limit-requests).
- **Limits keyed on the proxy.** [Run behind a proxy](/packages/shield/guide#run-behind-a-proxy).

## Further reading

- [Guide](/packages/shield/guide).
- [API reference](/packages/shield/api).
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/).
- [h3 middleware](https://h3.dev/guide/basics/middleware).
- [Server](/packages/server), [HTTP](/packages/http) and [Auth](/packages/auth).
