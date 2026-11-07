---
title: Server
description: Run a Node server that starts, logs and shuts down cleanly.
order: 1
---

# Server

Anything that has to run somewhere other than the browser, such as [API routes](/packages/api), [server actions](/packages/actions), [sockets](/packages/realtime) or a [database](/packages/db), needs a server underneath. `kitr/server` is that server: it starts your providers in order, gives every request an id and a logger, turns errors into clean JSON, and waits for in-flight requests before shutting down.

It is built on [h3](https://h3.dev) and runs on Node, Bun and Deno. It never imports React, so a pure backend built with kitr ships none.

## Two ways to run

**Inside a React app.** With TanStack Start, the server is a `fetch` handler that Start calls for `/api/*`. You don't start it yourself: the Vite dev server runs it in development and `kitr serve` runs the production build.

**As a standalone backend.** With `kitr new --kit server`, `server.ts` calls `server.listen()` and the process is the whole app.

## Install

```sh
kitr add server
```

This adds [Logger](/packages/logger) if it isn't there, installs `@kitr/server` and `h3`, and writes `config/server.ts`. In a React app it also switches the app to TanStack Start and writes `app/api/server.ts`; in a pure backend it writes `server.ts`.

## The server file

```ts
// server.ts (pure backend)
import { createServer } from 'kitr/server'
import { mountRoutes } from 'kitr/api'
import rc from './kitrrc'
import { config } from './config'
import { routes } from './start/routes'

export const server = createServer({ providers: rc.providers, config })
mountRoutes(server, routes)

if (import.meta.main ?? process.argv[1]?.endsWith('server.ts')) {
  server.listen()
}
```

`server.listen()` boots every provider in `kitrrc.ts` (`register`, then `boot`, then `ready`), starts listening and logs the URL. On `SIGINT` or `SIGTERM` it stops accepting requests, waits up to `shutdownTimeout` seconds, runs each provider's `shutdown` (closing database pools, flushing logs) and exits.

## Inside any runtime

`server.fetch` is a standard `(Request) => Promise<Response>` handler, so the same server runs anywhere that speaks fetch: TanStack Start, Nitro, Cloudflare Workers, Bun or Deno.

```ts
export default { fetch: server.fetch }
```

Providers boot lazily on the first request.

## Per-request context

Every request gets an id (from the `x-request-id` header, or a new one) and a child logger that includes it. Read them, and the request's own container, from anywhere on the server without passing them down:

```ts
import { useRequest, useRequestApp } from 'kitr/server'

export async function chargeCard(amount: number) {
  const { logger, requestId } = useRequest()
  const payments = useRequestApp().container.use('payments')
  logger.info({ amount }, 'charging')
  return payments.charge(amount, { idempotencyKey: requestId })
}
```

The response echoes the id in the same header, so a support ticket with the id leads straight to the logs.

## Errors

Anything thrown in a handler becomes JSON in kitr's error shape, with the right status:

```json
{ "code": "NOT_FOUND", "status": 404, "message": "Project not found" }
```

In production, `500` responses hide their message and data so internals don't leak.

## Configuration

```ts
// config/server.ts
import { defineConfig } from 'kitr/server'

export default defineConfig({
  port: Number(process.env.PORT ?? 3000),
})
```

| Option | Default | Description |
| --- | --- | --- |
| `port` | `3000` | Port for `listen()`. |
| `host` | `'0.0.0.0'` | Interface to bind. |
| `healthPath` | `'/healthz'` | Returns `{ ok: true }` for load balancers. `false` turns it off. |
| `bodyLimit` | 1 MiB | Largest request body in bytes. |
| `trustProxy` | `false` | Trust `X-Forwarded-*` headers from a proxy in front. |
| `requestIdHeader` | `'x-request-id'` | Header carrying the request id. |
| `shutdownTimeout` | `10` | Seconds to wait for in-flight requests on shutdown. |
| `websocket` | | Enables WebSocket upgrades. Set for you by [Sockets](/packages/realtime). |

## Next steps

- [API reference](/packages/server/api)
- [API routes](/packages/api), which mount onto this server
