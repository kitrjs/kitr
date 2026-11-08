---
title: Server
description: Run a Node server that starts, logs and shuts down cleanly.
order: 1
---

# Server

API routes, webhooks from a payment provider, a realtime channel for order updates: anything that runs outside the browser needs a server underneath. `@kitr/server` is that server. It boots your providers in order, gives every request an id and a logger, turns thrown errors into clean JSON, and waits for in-flight requests before it shuts down.

> [!SUMMARY]
> The API server: it boots your providers, logs each request and shuts down cleanly. Add it with `kitr add server api`; the overview is at [/packages/server](/packages/server).

It is built on [h3](https://h3.dev) and served by [srvx](https://srvx.h3.dev), so the same server runs on Node, Bun, Deno and Cloudflare Workers, standalone or inside TanStack Start. It runs on the server only and is also a platform: `server()` in `kitrrc.ts` tells `kitr dev`, `kitr build` and `kitr start` how to run it.

For routes and controllers add [API routes](/packages/api); for functions your React UI calls, use [Actions](/packages/actions).

The examples on this page build the Acme order service at `app.acme.com`: a server that answers `/api/orders`, logs each request with its id, and closes its database pool on shutdown.

## Install

Add the server as a platform named `api`:

```sh
kitr add server api
```

`server` is the platform type and `api` the name you address it by (`kitr dev api`); without a name, `kitr add server` uses `api`.

<details>
<summary>Everything kitr add changes</summary>

What `kitr add server api` does:

- Adds [Logger](/packages/logger) first if it is missing, because the server requires it: installs `@kitr/logger`, registers its provider and writes `config/logger.ts`.
- Installs `@kitr/server`, `h3` and `srvx`, plus `tsx` as a dev dependency on the `node` runtime or `wrangler` on `workers`.
- Adds `@kitr/server` to `packages` in `kitrrc.ts` and writes `api: server()` into `platforms`, with the `server` import.
- Writes `config/server.ts` (shown under Configure) and adds it to `config/index.ts`.
- Adds `LOG_LEVEL=info` under a `# Server` comment to `.env.example`, and to `.env` when that file exists.
- Adds `dev`, `build` and `start` scripts to `package.json` (`kitr dev`, `kitr build`, `kitr start`) when they are missing.
- Writes `server/main.ts`, the server entry (shown in the first example).
- With API routes installed, writes `server/routes.ts` if it is missing and mounts it in `server/main.ts`.
- Writes `server/routes.ts` with an empty route table when no package created one yet, and passes it to `createServer({ routes })`, so `kitr add api` and `kitr add realtime` only extend the table.
- In a React project with a web platform, writes `app/server.ts`, TanStack Start's server entry, which hands requests for the table's paths to the same server inside the Start process.
- On the `workers` runtime, writes `platforms/api/wrangler.toml`.
- Adds a `kitr: server` section and a `kitr: platform api` section to `AGENTS.md`.

</details>

Platform options are flags on the same command:

```sh
kitr add server api --runtime bun --port 4000
```

| Flag | Default | Effect |
| --- | --- | --- |
| `--runtime` | `node` | `node`, `bun`, `deno` or `workers`. |
| `--port` | `3001` | Port for `kitr dev api` and `kitr start api`. |
| `--host` | | Interface to bind. |
| `--entry` | `server/main.ts` | The entry file the platform runs. |
| `--no-scaffold` | | Register the platform without writing files. |

<details>
<summary>What kitr remove does</summary>

The `fullstack`, `server`, `saas`, `site` and `realtime` kits already include a server platform named `api`. `kitr platforms remove api` takes the platform out of `kitrrc.ts`; `kitr remove server` reverses the package steps: it removes `@kitr/server`, `h3` and `srvx` from `package.json` and `kitrrc.ts`, deletes `config/server.ts` and drops the `AGENTS.md` section. It leaves `server/main.ts`, `server/routes.ts` and `app/server.ts` in place, because you have likely edited them, and lists the files that still import `@kitr/server`.

</details>

## Configure

`kitr add server api` writes this file:

```ts
// config/server.ts
import { defineConfig } from '@kitr/server'

export default defineConfig({
  healthPath: '/healthz',
  bodyLimit: 1024 * 1024,
})
```



| Option | Default | Description |
| --- | --- | --- |
| `port` | `3000` | Port `listen()` uses when you call it without one. The scaffolded `server/main.ts` always passes a port, so the platform's `port` wins. |
| `host` | `'0.0.0.0'` | Interface `listen()` binds when you call it without one. |
| `healthPath` | `'/healthz'` | Path of a route that answers `{ ok: true }` for load balancers. `false` removes the route. |
| `bodyLimit` | `1048576` (1 MiB) | Largest request body in bytes. Larger requests get a `413`. |
| `bodyLimits` | `{}` | Limits per path: `{ '/api/uploads': 10 * 1024 * 1024 }`. |
| `trustProxy` | `false` | How many proxies sit in front of the server, so `ctx.request.ip()` is the real client: `true` for one load balancer, or a number. |
| `requestIdHeader` | `'x-request-id'` | Header the request id is read from and echoed in. |
| `shutdownTimeout` | `10` | Seconds to wait for in-flight requests after `SIGINT` or `SIGTERM` before the process exits with code `1`. |
| `websocket` | `false` | Accept WebSocket upgrades through `crossws`. [Realtime](/packages/realtime) sets it for you. |

Options passed in code override `config/server.ts`:

```ts
// server/main.ts
import { loadRc } from '@kitr/kitr/app'
import { createServer } from '@kitr/server'
import { config } from '../config'
import rc from '../kitrrc'

export const server = createServer({
  ...loadRc(rc, config),
  server: { shutdownTimeout: 30, requestIdHeader: 'x-acme-trace' },
})
```

| Variable | Used for |
| --- | --- |
| `LOG_LEVEL` | The server logger's level (`debug`, `info`, `warn`, `error`) when no logger provider is bound. `config/logger.ts` reads it too. |
| `PORT` | The port `server/main.ts` listens on. `kitr dev` and `kitr start` set it from the platform options. |
| `HOST` | The interface `server/main.ts` binds. `kitr dev` sets `localhost`, `kitr start` sets `0.0.0.0`. |
| `NODE_ENV` | `production` hides the details of `5xx` errors. A production build does too. |

### Platform options

The platform lives in `kitrrc.ts`; its options decide how the CLI runs the entry.

```ts
// kitrrc.ts
import { defineKitrConfig } from '@kitr/kitr/app'
import { server } from '@kitr/server'

export default defineKitrConfig({
  packages: ['@kitr/logger', '@kitr/server', '@kitr/api'],
  providers: [() => import('@kitr/logger')],
  platforms: {
    api: server({ runtime: 'node', port: 3001 }),
  },
})
```

| Option | Default | Description |
| --- | --- | --- |
| `runtime` | `'node'` | `node` (tsx in dev, `node --import tsx` in production), `bun`, `deno`, or `workers` (Cloudflare, through `wrangler`). |
| `port` | `3001` | Port for `kitr dev` and `kitr start`, passed to the entry as `PORT`. Must be between 0 and 65535. |
| `host` | | Interface to bind, passed as `HOST`. Defaults to `localhost` in dev and `0.0.0.0` in production. |
| `entry` | `'server/main.ts'` | The file the platform runs: `createServer({...})` plus routes and realtime. |

Change an option without opening the file, or override it for one run (the environment form is `KITR_<NAME>_<OPTION>`):

```sh
kitr config api port 4000
kitr config api runtime bun
KITR_API_PORT=4000 kitr dev api
kitr dev api --port 4000
```



## Start your first server

`kitr add server api` writes the entry, which creates the server from your providers and config and listens when run directly:

```ts
// server/main.ts
import { createServer } from '@kitr/server'
import { config } from '../config'
import rc from '../kitrrc'

/** The kitr server: providers from kitrrc.ts, config from config/. What `kitr dev api` runs, what the web platform's /api route delegates to, what tests call. */
export const server = createServer({ providers: rc.providers, config })

/** Fetch handler for runtimes that call it (Cloudflare Workers, Deno Deploy). */
export default server

const isMain = (import.meta as { main?: boolean }).main ?? process.argv[1]?.endsWith("main.ts")
if (isMain) {
  server.listen({
    port: Number(process.env.PORT) || 3001,
    host: process.env.HOST,
  })
}
```

Add a route on the underlying h3 app, below `createServer`:

```ts
// server/main.ts
// ...
export const server = createServer({ providers: rc.providers, config })

server.h3.get('/api/orders/latest', () => ({ id: 'ord_1042', customer: 'Ada', total: 129 }))
// ...
```

Start it:

```sh
kitr dev api
```

The log shows `listening on http://localhost:3001`. Ask for the order:

```sh
curl -i http://localhost:3001/api/orders/latest
```

```http
HTTP/1.1 200 OK
content-type: application/json;charset=UTF-8
x-request-id: 3106a213-994f-4363-b099-eb8c19dc7299

{"id":"ord_1042","customer":"Ada","total":129}
```

The returned object became JSON, and the response carries a fresh request id. For more than a couple of routes, use [API routes](/packages/api).

## Run the server in development and production

`kitr dev api`, `kitr build api` and `kitr start api` run the entry with the platform's runtime. With no name they run every platform in `kitrrc.ts`.

| Runtime | `kitr dev api` | `kitr build api` | `kitr start api` |
| --- | --- | --- | --- |
| `node` | `tsx watch server/main.ts` | `tsc --noEmit -p tsconfig.json` | `node --import tsx server/main.ts` |
| `bun` | `bun --watch server/main.ts` | `tsc --noEmit -p tsconfig.json` | `bun server/main.ts` |
| `deno` | `deno run --watch -A server/main.ts` | `tsc --noEmit -p tsconfig.json` | `deno run -A server/main.ts` |
| `workers` | `wrangler dev --port 3001` in `platforms/api/` | `wrangler deploy --dry-run --outdir dist/api` | `wrangler dev` in `platforms/api/` |

On Node, Bun and Deno the build step typechecks; the server runs from source. `kitr start` binds `0.0.0.0` unless you set `host`.

```sh
kitr build api
kitr start api --port 8080
```

## Choose a runtime

Every runtime runs the same `server/main.ts`. Only the platform option changes.

### Node

The default. `kitr add server api` installs `tsx` as a dev dependency to run TypeScript directly.

```ts
// kitrrc.ts
// ...
  platforms: { api: server({ runtime: 'node' }) },
```

### Bun

```sh
kitr config api runtime bun
```

Bun runs TypeScript itself, so nothing extra is installed.

### Deno

```sh
kitr config api runtime deno
```

The platform runs Deno with `-A`; see [Deno's permissions guide](https://docs.deno.com/runtime/fundamentals/security/) to narrow that in production.

### Cloudflare Workers

```sh
kitr add server edge --runtime workers
```

The platform installs `wrangler` and writes `platforms/edge/wrangler.toml`:

```toml
# platforms/edge/wrangler.toml
name = "acme-edge"
main = "../../server/main.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]
```

Workers call the default export's `fetch`, which `server/main.ts` already exports. `kitr build edge` bundles into `dist/edge`; deploy with `wrangler deploy` from `platforms/edge` (see the [Wrangler docs](https://developers.cloudflare.com/workers/wrangler/)).

## Serve the API inside TanStack Start

In a React project with a web platform, the server platform also writes Start's server entry. Paths the kitr server has routes for (endpoints, sockets, the health check) go to the same `server` object; everything else renders a page:

```ts
// app/server.ts
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { server } from '#server/main'

/** Every request goes through the kitr server's middleware (request context, shield's headers and CSP nonce); paths it has routes for (endpoints, sockets, /healthz) are answered there, pages are rendered by Start inside it. */
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

`server.fetch(request, { pages })` answers API routes itself and hands every other path to `pages`, Start's handler. The `ssr` web platform therefore serves `/api/orders` with no second process; `kitr dev api` runs the server on its own port.

## Call the server from any fetch runtime

`server.fetch` is a standard `(request: Request) => Promise<Response>` handler. Anything that speaks fetch can call it:

```ts
// server/worker.ts
import { server } from '#server/main'

export default { fetch: (request: Request) => server.fetch(request) }
```

```ts
// scripts/check-order.ts
import { server } from '#server/main'

const response = await server.fetch(new Request('http://app.acme.com/api/orders/latest'))
console.log(response.status, await response.json())
// => 200 { id: 'ord_1042', customer: 'Ada', total: 129 }
```

The first `fetch()` boots the providers once and, outside tests, runs each provider's `ready` hook, as `listen()` does.

## Add routes and middleware

`server.h3` is the [h3 app](https://h3.dev/guide/basics/routing). Register routes on it directly when you don't need controllers:

```ts
// server/main.ts
// ...
server.h3.get('/api/invoices/:id', (event) => {
  const id = event.context.params?.id
  return { id, status: 'paid' }
})
```

`server.use()` adds h3 middleware that runs for every request. Return nothing to continue; return a value or a `Response` to answer early:

```ts
// server/main.ts
// ...
server.use((event) => {
  event.res.headers.set('x-powered-by', 'acme')
})
```

`server.mount()` puts another h3 app, or any object with a `fetch` method, under a base path:

```ts
// server/main.ts
import { H3 } from 'h3'
// ...
const billing = new H3().get('/invoices', () => [{ id: 'INV-1042', total: 129 }])

server.mount('/billing', billing)
server.mount('/legacy', { fetch: (request) => fetch(`https://legacy.acme.com${new URL(request.url).pathname}`) })
```

`GET /billing/invoices` now answers from the billing app. `mount` and `use` return the server, so you can chain them.

## Read the current request anywhere

Every request runs inside a context that any function can read with `useRequest()`:

```ts
// server/services/payments.ts
import { useRequest } from '@kitr/server'

export async function chargeOrder(orderId: string, amount: number) {
  const { logger, requestId } = useRequest()
  logger.info('charging order', { orderId, amount })
  return { orderId, amount, idempotencyKey: requestId }
}
```

| Field | What it holds |
| --- | --- |
| `event` | The h3 event for this request. |
| `app` | A fork of the server app: same providers and config, its own container instances. |
| `requestId` | The id from the `x-request-id` header, or a new UUID. |
| `logger` | A child logger that adds `requestId` to every line. |
| `startedAt` | `performance.now()` when the request arrived. |
| `locals` | A free-form object for middleware. [Auth](/packages/auth) puts `user` here. |

Outside a request `useRequest()` throws; in code that runs both inside and outside requests, such as a job, use `tryUseRequest()`, which returns `undefined`:

```ts
// server/services/audit.ts
import { tryUseRequest } from '@kitr/server'

export function auditLabel() {
  return tryUseRequest()?.requestId ?? 'background'
}
```

## Use request-scoped services

Each request gets its own fork of the app container, so a per-request service such as a database transaction never leaks into another request. Read it with `useRequestApp()`:

```ts
// server/services/orders.ts
import { useRequestApp } from '@kitr/server'

export async function findOrder(id: string) {
  const db = useRequestApp().container.use('db')
  return db.orders.find(id)
}
```

Outside a request `useRequestApp()` throws unless you pass the server's app as a fallback, for code that also runs in jobs:

```ts
// server/services/orders.ts
import { useRequestApp } from '@kitr/server'
import { server } from '#server/main'

export function ordersDb() {
  return useRequestApp(server.app).container.use('db')
}
```

> [!WARNING]
> Don't import services that hold per-user state from module scope into handlers; take them from `useRequestApp()`.

## Log with the request id

The server's logger comes from the [Logger](/packages/logger) provider, or a built-in `kitr` logger without one. Each request gets a child logger that adds `requestId`:

```ts
// server/main.ts
// ...
server.h3.post('/api/orders', async (event) => {
  const { logger } = useRequest()
  const order = await event.req.json()
  logger.info('order received', { customer: order.customer })
  return { id: 'ord_1043', ...order }
})
```

The server logs `listening on ...` at `info`, one line per request at `debug` (`POST /api/orders` with `status`, `ip` and `durationMs`) and every `5xx` at `error` with the request id. Set `LOG_LEVEL=debug` in `.env` to see request lines.

## Trace a request across services

The server reads the request id from the `x-request-id` header, or makes a UUID, and echoes it on the response, so a support ticket that quotes it leads to the matching log lines.

```sh
curl -i -H 'x-request-id: ticket-8812' http://localhost:3001/api/orders/latest
```

```http
HTTP/1.1 200 OK
x-request-id: ticket-8812
```

Pass the id on when you call another Acme service, so both logs share it:

```ts
// server/services/invoices.ts
import { useRequest } from '@kitr/server'

export async function fetchInvoice(id: string) {
  const { requestId } = useRequest()
  const response = await fetch(`https://billing.acme.com/invoices/${id}`, {
    headers: { 'x-request-id': requestId },
  })
  return response.json()
}
```

Set `requestIdHeader` if your proxy uses another header name.

## Return errors as JSON

Anything thrown in a handler becomes JSON in kitr's error shape with the matching status. Throw a [`KitrError`](/packages/server/api) to choose the code:

```ts
// server/main.ts
import { KitrError } from '@kitr/kitr/app'
// ...
server.h3.post('/api/invoices/:id/pay', () => {
  throw new KitrError('CONFLICT', 'Invoice INV-1042 is already paid')
})
```

```http
HTTP/1.1 409 Conflict
content-type: application/json; charset=utf-8

{"code":"CONFLICT","message":"Invoice INV-1042 is already paid","status":409}
```

`KitrError.notFound('Order')`, `.unauthorized()`, `.forbidden()` and `.validation({ email: ['Required'] })` cover the common cases. A missing route answers in the same shape:

```json
{ "code": "NOT_FOUND", "message": "Cannot find any route matching [GET] http://localhost:3001/api/nope", "status": 404 }
```

A plain `Error` becomes `INTERNAL` with status `500`; its message comes through in development but not in production:

```json
{ "code": "INTERNAL", "message": "Internal server error", "status": 500 }
```

> [!WARNING]
> Only a production app (`kitr build`, or `NODE_ENV=production`) hides `5xx` messages. A staging server started in development mode sends internal errors, such as database errors, to the client.

`4xx` messages show in every mode, so write them for the user. In custom middleware or a mounted handler, build the same response with `errorToResponse()`:

```ts
// server/main.ts
import { KitrError } from '@kitr/kitr/app'
import { errorToResponse } from '@kitr/server'
// ...
server.use((event) => {
  if (event.url.pathname.startsWith('/api/admin') && !event.req.headers.get('authorization'))
    return errorToResponse(KitrError.unauthorized(), event)
})
```

`normaliseServerError()` turns any error into a `KitrError` without building a response.

## Limit request bodies

`bodyLimit` caps request bodies in bytes. A request that declares a larger `content-length` is rejected before it is read:

```ts
// config/server.ts
import { defineConfig } from '@kitr/server'

export default defineConfig({
  healthPath: '/healthz',
  bodyLimit: 10 * 1024 * 1024, // 10 MiB for invoice PDFs
})
```

```json
{ "code": "PAYLOAD_TOO_LARGE", "message": "Request body is larger than 10485760 bytes", "status": 413 }
```

To raise the limit for part of the API, set `bodyLimits` by path prefix; the longest matching prefix wins and other paths keep `bodyLimit`:

```ts
// config/server.ts
import { defineConfig } from '@kitr/server'

export default defineConfig({
  healthPath: '/healthz',
  bodyLimit: 1024 * 1024,
  bodyLimits: {
    '/api/invoices/import': 20 * 1024 * 1024, // Grace's monthly CSV import
    '/api/invoices': 5 * 1024 * 1024,
  },
})
```

Chunked uploads without a `content-length` are counted as they stream and get a `413`. For large files use [Uploads](/packages/uploads), which streams to storage with its own limits.

## Check health from a load balancer

The server answers `GET /healthz` with `{ "ok": true }` once it is up; point your load balancer at it. Move it or turn it off in `config/server.ts`:

```ts
// config/server.ts
import { defineConfig } from '@kitr/server'

export default defineConfig({
  healthPath: '/up', // or false to remove it
  bodyLimit: 1024 * 1024,
})
```

It only says the process is serving; add your own route to check the database.

## Run code on start and shutdown

Providers in `kitrrc.ts` run `register` and `boot` before the first request, `ready` once the server serves, and `shutdown` when it stops. Put the work in a provider, not in `server/main.ts`:

```ts
// app/providers/orders-db-provider.ts
import { defineProvider } from '@kitr/kitr/app'
import { createPool } from '#server/db/pool'

export default defineProvider({
  name: 'orders-db',
  register(app) {
    app.container.singleton('ordersDb', () => createPool(process.env.DATABASE_URL))
  },
  ready(app) {
    app.container.use('logger').info('orders database ready')
  },
  async shutdown(app) {
    await app.container.use('ordersDb').end()
  },
})
```

```ts
// kitrrc.ts
// ...
  providers: [() => import('@kitr/logger'), () => import('#app/providers/orders-db-provider')],
```

`kitr make:provider orders-db` writes the provider skeleton and lists it in `kitrrc.ts`. Each step happens once:

| Call | Runs |
| --- | --- |
| `server.boot()` | `register` and `boot` of every provider. `listen()` and the first `fetch()` call it for you. |
| `server.listen()` | `boot()`, then starts listening, then `ready`. |
| `server.fetch()` | `boot()`, then `ready` once, except when the app environment is `test`. |
| `server.close()` | `shutdown` of every provider. |

## Shut down without dropping requests

On `SIGINT` or `SIGTERM`, a server started with `listen()`:

1. Logs `SIGTERM received, shutting down`.
2. Stops accepting connections and ends open WebSocket connections.
3. Waits for in-flight requests to finish.
4. Runs every provider's `shutdown` (closing database pools, flushing logs).
5. Exits with code `0`.

Past `shutdownTimeout` seconds the process exits with code `1`. Raise it when requests run long, such as invoice exports:

```ts
// config/server.ts
import { defineConfig } from '@kitr/server'

export default defineConfig({
  healthPath: '/healthz',
  bodyLimit: 1024 * 1024,
  shutdownTimeout: 30,
})
```

> [!WARNING]
> Keep the timeout below your orchestrator's grace period (30 seconds by default on Kubernetes), or the process is killed first.

`listen()` returns a `close()` function that does steps 2 to 4 without exiting, for tests and scripts:

```ts
// scripts/smoke.ts
import { server } from '#server/main'

const { url, close } = await server.listen({ port: 0, host: '127.0.0.1' })
const response = await fetch(`${url}/healthz`)
console.log(await response.json())
// => { ok: true }
await close()
```

Port `0` picks a free port; `url` tells you which one.

## Accept WebSocket connections

Set `websocket: true` to accept WebSocket upgrades through [crossws](https://crossws.h3.dev); [Realtime](/packages/realtime) sets it for you.

```ts
// server/main.ts
// ...
export const server = createServer({ providers: rc.providers, config, server: { websocket: true } })
```

Without `crossws`, `listen()` throws; `kitr add realtime` installs it.

## Commands

The server platform answers these commands:

| Command | What it does |
| --- | --- |
| `kitr add server <name>` | Add a server platform and write `server/main.ts`. |
| `kitr dev <name>` | Runs the entry in watch mode for the runtime (see the table under "Run the server in development and production"). |
| `kitr build <name>` | Typechecks on Node, Bun and Deno; bundles into `dist/<name>` on Workers. |
| `kitr start <name>` | Runs the production server. `kitr serve` does the same. |
| `kitr config <name> [option] [value]` | Reads or sets a platform option in `kitrrc.ts`. `--unset` removes one. |
| `kitr platforms` | Lists platforms and their options. |
| `kitr platforms scaffold <name>` | Rewrites the platform's files (`server/main.ts`, `app/server.ts`, `wrangler.toml`; `server/routes.ts` only when missing). |
| `kitr platforms remove <name>` | Takes the platform out of `kitrrc.ts`. |



`kitr doctor` reports an error when:

- The entry file (`server/main.ts`) is missing. Fix: `kitr platforms scaffold api`.
- `h3` or `srvx` is not installed.
- `tsx` is not installed on the `node` runtime.
- `wrangler` is not installed on the `workers` runtime.
- The project has a server platform but no `server/main.ts`.

## Errors

| Code | When | What to do |
| --- | --- | --- |
| `NOT_FOUND` (404) | No route matches the method and path. | Check the path and method; with API routes, run `kitr routes:list`. |
| `PAYLOAD_TOO_LARGE` (413) | The body is larger than `bodyLimit`. | Raise `bodyLimit` or send large files through [Uploads](/packages/uploads). |
| `INTERNAL` (500) | A handler threw something that is not a `KitrError`. | Read the `error` log line with the request id; throw a `KitrError` for expected failures. |
| any `KitrError` code | A handler threw a `KitrError`. | The status follows the code: `VALIDATION` 422, `UNAUTHORIZED` 401, `FORBIDDEN` 403, `CONFLICT` 409, `RATE_LIMITED` 429. |

These are thrown as plain errors, not JSON responses:

| Message | When | What to do |
| --- | --- | --- |
| `[@kitr/server] useRequest() called outside a request.` | `useRequest()` ran in a job, script or module scope. | Use `tryUseRequest()`, or move the call into the handler. |
| `[@kitr/server] useRequestApp() called outside a request and no fallback given.` | Same, for `useRequestApp()`. | Pass a fallback: `useRequestApp(server.app)`. |
| `[@kitr/server] websocket: true needs the crossws package.` | `websocket: true` without `crossws`. | `kitr add realtime`. |

## Testing

Tests call `server.fetch()` with a `Request`; no port is opened. Import the server from `server/main.ts` and use `createTestClient` from [Testing](/packages/testing):

```ts
// test/orders.test.ts
import { createTestClient } from '@kitr/testing'
import { expect, it } from 'vitest'
import { server } from '#server/main'

it('returns the latest order', async () => {
  const client = createTestClient(server)
  const res = await client.get<{ id: string; customer: string }>('/api/orders/latest')
  expect(res.status).toBe(200)
  expect(res.body).toEqual({ id: 'ord_1042', customer: 'Ada', total: 129 })
  expect(res.headers.get('x-request-id')).toBeTruthy()
})
```

To test in isolation, build a server in the test, with `silentLogger` and `server` options for config:

```ts
// test/server.test.ts
import { KitrError } from '@kitr/kitr/app'
import { silentLogger } from '@kitr/logger'
import { createServer, useRequest } from '@kitr/server'
import { createTestClient } from '@kitr/testing'
import { describe, expect, it } from 'vitest'

function buildServer() {
  const server = createServer({ logger: silentLogger, server: { bodyLimit: 1024 } })
  server.h3.get('/api/orders/:id', (event) => {
    const id = event.context.params?.id
    if (id !== 'ord_1042') throw KitrError.notFound('Order')
    return { id, requestId: useRequest().requestId }
  })
  server.h3.post('/api/orders', async (event) => ({ received: (await event.req.text()).length }))
  return server
}

describe('order service', () => {
  it('answers with the order and echoes the request id', async () => {
    const client = createTestClient(buildServer(), { headers: { 'x-request-id': 'ticket-8812' } })
    const res = await client.get<{ id: string; requestId: string }>('/api/orders/ord_1042')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ id: 'ord_1042', requestId: 'ticket-8812' })
    expect(res.headers.get('x-request-id')).toBe('ticket-8812')
  })

  it('returns a kitr error for a missing order', async () => {
    const res = await createTestClient(buildServer()).get('/api/orders/ord_9999')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ code: 'NOT_FOUND', message: 'Order not found', status: 404 })
  })

  it('rejects bodies over the limit', async () => {
    const res = await createTestClient(buildServer()).post('/api/orders', { note: 'x'.repeat(2048) })
    expect(res.status).toBe(413)
    expect(res.body).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' })
  })

  it('answers the health check', async () => {
    const res = await createTestClient(buildServer()).get('/healthz')
    expect(res.body).toEqual({ ok: true })
  })
})
```

Under Vitest `fetch()` boots providers but skips their `ready` hooks, so job workers stay off. To test lifecycle hooks, call `server.listen({ port: 0 })` and `close()` as shown under "Shut down without dropping requests".

## Next steps

- [API reference](/packages/server/api): `createServer`, options and request helpers.
- [API routes](/packages/api): routes, controllers and a typed client on this server.
- [Build an API server without React](/guides/api-server): from an empty folder to deployment.
