---
title: Build an API server without React
description: A JSON API with controllers, validation, a database, auth, realtime events, OpenAPI and a typed client, and no React anywhere.
packages: server, api, db, logger, realtime, auth, testing
platforms: server
time: 45 min
---

# Build an API server without React

Not every project has a UI. A billing service, a webhook receiver, the backend for an iPhone app: these are HTTP servers with routes, a database and tests, and nothing to render. kitr builds them from the same packages a full-stack app uses, minus everything that touches the browser. `kitr doctor` keeps it that way.

You will build `acme-billing`, Acme's invoices API: REST routes for invoices with validation, a Postgres table behind them, bearer-token auth, an event pushed over WebSocket when an invoice is paid, an OpenAPI document for partners, and a typed client the frontend team imports without generating code.

## Before you start

You need [Node.js](https://nodejs.org) 22 or newer (or Bun or Deno; see "Pick a runtime" below), the kitr CLI (`npm install -g kitr`) and a Postgres database for the database step. This starts one with Docker:

```sh
docker run -d --name acme-billing-db -e POSTGRES_PASSWORD=acme -e POSTGRES_DB=billing -p 5432:5432 postgres:17
```

## Create the project

```sh
kitr new acme-billing --kit server
cd acme-billing
```

The `server` kit is a backend whose dependency graph has no React, no TanStack and no Vite. It installs [Server](/packages/server), [API routes](/packages/api), [Logger](/packages/logger), [DB](/packages/db), [Realtime](/packages/realtime) and [Testing](/packages/testing):

```
acme-billing/
├── server/
│   ├── main.ts             # createServer({ routes }) + listen()
│   ├── routes.ts           # defineRoutes([api, realtime], ...): endpoints and sockets
│   └── controllers/        # one class per resource
├── app/
│   ├── channels/           # defineChannel(...): shared with any client
│   └── env.ts              # validated environment variables
├── config/                 # api, db, logger, realtime, server; index.ts lists them
├── test/                   # createTestClient(server)
└── kitrrc.ts               # platforms: { api: server() }
```

Run it:

```sh
cp .env.example .env
npm run dev
```

`npm run dev` runs `kitr dev`, which starts the `api` platform with `tsx watch server/main.ts` on port 3001. The kit wrote one route:

```sh
curl http://localhost:3001/api/health
```

```json
{ "ok": true, "requestId": "3106a213-994f-4363-b099-eb8c19dc7299" }
```

Every response carries an `x-request-id` header, and every log line for that request carries the same id.

## Add a resource

A controller is a plain class; each method takes the request context and returns the response body. Let the CLI write the five REST methods:

```sh
kitr make:controller invoices --resource
```

Replace the generated body with Acme's invoices. They live in memory for now; the next section moves them to Postgres:

```ts
// server/controllers/invoices-controller.ts
import type { HttpContext } from '@kitr/api'
import { KitrError } from 'kitr/app'
import { z } from 'zod'

export const createInvoice = z.object({
  customerEmail: z.email(),
  amountCents: z.number().int().positive(),
})

export interface Invoice {
  id: string
  customerEmail: string
  amountCents: number
  status: 'open' | 'paid'
}

const invoices = new Map<string, Invoice>()

export default class InvoicesController {
  static validation = {
    store: { body: createInvoice },
  }

  async index() {
    return [...invoices.values()]
  }

  async show({ params }: HttpContext<{ id: string }>) {
    const invoice = invoices.get(params.id)
    if (!invoice) throw KitrError.notFound('Invoice')
    return invoice
  }

  async store({ body, response, logger }: HttpContext<{}, {}, z.infer<typeof createInvoice>>) {
    const invoice: Invoice = { id: `inv_${2041 + invoices.size}`, status: 'open', ...body }
    invoices.set(invoice.id, invoice)
    logger.info('invoice created', { id: invoice.id })
    response.status(201)
    return invoice
  }
}
```

Register it. `resource()` adds a route for each REST method the controller has, named `invoices.<method>`:

```ts
// server/routes.ts
import { defineRoutes } from 'kitr/app'
import api from '@kitr/api/routes'
import realtime from '@kitr/realtime/routes'
import HealthController from '#server/controllers/health-controller'
import InvoicesController from '#server/controllers/invoices-controller'

export const routes = defineRoutes([api, realtime], (router) =>
  router.group('/api', (r) =>
    r
      .get('/health', [HealthController, 'show'], { name: 'health' })
      .resource('invoices', InvoicesController),
  ),
)

export type ServerRoutes = typeof routes.$types
```

```sh
kitr routes:list
```

```text
  GET     /api/health                              health
  GET     /api/invoices                            invoices.index
  POST    /api/invoices                            invoices.store
  GET     /api/invoices/:id                        invoices.show
```

Create one, then send a bad one:

```sh
curl -X POST http://localhost:3001/api/invoices \
  -H 'content-type: application/json' \
  -d '{"customerEmail":"grace@acme.com","amountCents":12000}'
# => {"id":"inv_2041","status":"open","customerEmail":"grace@acme.com","amountCents":12000}

curl -X POST http://localhost:3001/api/invoices \
  -H 'content-type: application/json' \
  -d '{"customerEmail":"grace","amountCents":-5}'
```

```json
{
  "code": "VALIDATION",
  "message": "Validation failed",
  "status": 422,
  "fieldErrors": {
    "customerEmail": ["Invalid email address"],
    "amountCents": ["Too small: expected number to be >0"]
  }
}
```

`static validation` ran the schema before `store`, and the body inside `store` is already typed and parsed. Every error the server sends has this one shape, whether it is a validation failure, a `KitrError.notFound()` you threw, or a crash (which becomes `500 Internal server error`, logged with its stack). Clients handle one shape.

Don't keep request data on `this`: kitr creates one instance of each controller and reuses it for every request.

## Store invoices in Postgres

The kit registered the [DB](/packages/db) provider and wrote `config/db.ts` with nothing connected yet. Bring your ORM; this guide uses [Drizzle](https://orm.drizzle.team):

```sh
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit
```

```ts
// server/db/schema.ts
import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const invoices = pgTable('invoices', {
  id: text('id').primaryKey(),
  customerEmail: text('customer_email').notNull(),
  amountCents: integer('amount_cents').notNull(),
  status: text('status', { enum: ['open', 'paid'] }).notNull().default('open'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

```ts
// config/db.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import { defineDb } from '@kitr/db'
import postgres from 'postgres'
import * as schema from '#server/db/schema'

const createDb = () => drizzle(postgres(process.env.DATABASE_URL!), { schema })

export type AppDb = ReturnType<typeof createDb>

export default defineDb({
  connect: () => createDb(),
  disconnect: (db) => db.$client.end(),
})
```

Set `DATABASE_URL=postgres://postgres:acme@localhost:5432/billing` in `.env`, then create the table with `drizzle-kit` (the [DB guide](/packages/db#run-migrations) shows `drizzle.config.ts` and the scripts). In the controller, `ctx.app` is the app for this request; `useDb` returns the pooled client:

```ts
// server/controllers/invoices-controller.ts
import { desc, eq } from 'drizzle-orm'
import type { HttpContext } from '@kitr/api'
import { KitrError } from 'kitr/app'
import { useDb } from '@kitr/db'
import { z } from 'zod'
import type { AppDb } from '#config/db'
import { invoices } from '#server/db/schema'

export const createInvoice = z.object({
  customerEmail: z.email(),
  amountCents: z.number().int().positive(),
})

export default class InvoicesController {
  static validation = {
    store: { body: createInvoice },
  }

  async index({ app }: HttpContext) {
    return useDb<AppDb>(app).select().from(invoices).orderBy(desc(invoices.createdAt))
  }

  async show({ app, params }: HttpContext<{ id: string }>) {
    const [invoice] = await useDb<AppDb>(app).select().from(invoices).where(eq(invoices.id, params.id))
    if (!invoice) throw KitrError.notFound('Invoice')
    return invoice
  }

  async store({ app, body, response }: HttpContext<{}, {}, z.infer<typeof createInvoice>>) {
    const [invoice] = await useDb<AppDb>(app)
      .insert(invoices)
      .values({ id: `inv_${crypto.randomUUID().slice(0, 8)}`, ...body })
      .returning()
    response.status(201)
    return invoice
  }
}
```

The provider connects once during boot, before the first request, and closes the pool on `SIGINT` or `SIGTERM` after in-flight requests finish. If Postgres is down at start-up, the server refuses to start and logs the driver's error, rather than failing on the first request.

## Require a token

`authMiddleware` from `@kitr/auth/server` reads `Authorization: Bearer <token>`, looks the user up with your function and puts them on `ctx.locals`. In a project without React, install the package yourself (`kitr add auth` skips client packages here):

```sh
pnpm add @kitr/auth
```

```ts
// server/auth.ts
import { authMiddleware } from '@kitr/auth/server'

export interface ApiUser {
  id: string
  email: string
  role: 'admin' | 'member'
}

const tokens = new Map<string, ApiUser>([
  ['tok_ada', { id: 'u_ada', email: 'ada@acme.com', role: 'admin' }],
])

/** Swap the Map for your token table or a JWT verify. */
export const auth = authMiddleware<ApiUser>({ verify: async (token) => tokens.get(token) ?? null })
```

Put it on the group, so every invoice route needs a user:

```ts
// server/routes.ts
import { defineRoutes } from 'kitr/app'
import api from '@kitr/api/routes'
import realtime from '@kitr/realtime/routes'
import { auth } from '#server/auth'
import HealthController from '#server/controllers/health-controller'
import InvoicesController from '#server/controllers/invoices-controller'

export const routes = defineRoutes([api, realtime], (router) =>
  router.group('/api', (r) =>
    r
      .get('/health', [HealthController, 'show'], { name: 'health' })
      .group({ middleware: [auth] }, (secured) => secured.resource('invoices', InvoicesController)),
  ),
)

export type ServerRoutes = typeof routes.$types
```

Without a token, `GET /api/invoices` answers `401` with `{ "code": "UNAUTHORIZED", "message": "Authentication required", "status": 401 }`. Inside a controller, `requireUser<ApiUser>(ctx)` returns the typed user. [Add sign-in, end to end](/guides/authentication) covers permissions with `can()` and cookie sessions.

## Allow the frontend to call it

When the API and the web app live on different origins (`api.acme.com` and `app.acme.com`), the browser asks first. `cors()` answers:

```ts
// server/routes.ts
import { cors, rateLimit } from '@kitr/api'
import { defineRoutes } from 'kitr/app'
import api from '@kitr/api/routes'
import realtime from '@kitr/realtime/routes'
import { auth } from '#server/auth'
import HealthController from '#server/controllers/health-controller'
import InvoicesController from '#server/controllers/invoices-controller'

export const routes = defineRoutes([api, realtime], (router) =>
  router.group(
    { prefix: '/api', middleware: [cors({ origin: ['https://app.acme.com'] }), rateLimit({ max: 300 })] },
    (r) =>
      r
        .get('/health', [HealthController, 'show'], { name: 'health' })
        .group({ middleware: [auth] }, (secured) => secured.resource('invoices', InvoicesController)),
  ),
)

export type ServerRoutes = typeof routes.$types
```

`rateLimit({ max: 300 })` answers `429` past 300 requests a minute per IP. Its counters live in this process's memory: with several instances, use [Shield](/packages/shield)'s limiter with a shared store.

## Push an event when an invoice is paid

A dashboard showing invoices should not poll. [Realtime](/packages/realtime) channels are defined once, in a file any client can import, and the server emits to everyone subscribed:

```ts
// app/channels/invoices.ts
import { defineChannel } from '@kitr/realtime'
import { z } from 'zod'

export const invoicesChannel = defineChannel({
  name: 'invoices',
  events: {
    paid: {
      schema: z.object({ id: z.string(), amountCents: z.number() }),
      effects: (invoice) => ({ invalidate: [['api', 'invoices.index']] }),
    },
  },
})
```

The socket is a route on the same table, from the `realtime` extension. `createServer({ routes })` serves it and binds the socket server as `realtime` in the container:

```ts
// server/routes.ts
// ...
import realtime from '@kitr/realtime/routes'
import { invoicesChannel } from '#app/channels/invoices'

export const routes = defineRoutes([api, realtime], (router) =>
  router.group('/api', (r) =>
    r
      // ...health and invoices as before
      .ws('/ws', { channels: [invoicesChannel] }),
  ),
)
```

Add a `pay` route and emit from it. `app` is on every `HttpContext`, so the controller reaches the socket server through the container:

```ts
// server/controllers/invoices-controller.ts
// ...
import { invoicesChannel } from '#app/channels/invoices'

export default class InvoicesController {
  // ...index, show, store as before

  async pay({ app, params }: HttpContext<{ id: string }>) {
    const [invoice] = await useDb<AppDb>(app)
      .update(invoices)
      .set({ status: 'paid' })
      .where(eq(invoices.id, params.id))
      .returning()
    if (!invoice) throw KitrError.notFound('Invoice')
    app.container.use('realtime').use(invoicesChannel, {}).emit('paid', { id: invoice.id, amountCents: invoice.amountCents })
    return invoice
  }
}
```

```ts
// server/routes.ts
// ...
        .group({ middleware: [auth] }, (secured) =>
          secured
            .resource('invoices', InvoicesController)
            .post('/invoices/:id/pay', [InvoicesController, 'pay'], { name: 'invoices.pay' }),
        ),
// ...
```

The `.ws('/ws', ...)` link above serves the WebSocket on the same port as the API. A kitr frontend subscribes with `useChannel`, and its `effects` refetch the invoice list; any other client can speak the protocol described in the [Realtime guide](/packages/realtime).

## Publish OpenAPI and a typed client

Partners want an OpenAPI document. Your own frontend wants types without a code generator:

```sh
kitr api:sync
# 5 routes → openapi.json, server/routes.gen.ts
```

`openapi.json` describes every named route, with request bodies and parameters converted from the zod schemas. `server/routes.gen.ts` is a plain table of names, methods and paths.

A kitr frontend in another project imports only the `ServerRoutes` type and the table. Share them through a workspace package (see [Run kitr in a monorepo](/guides/monorepo)) or publish them as a small types package. On the frontend:

```ts
// app/api/billing.ts
import { createApiClient, registerRoutes } from '@kitr/api/client'
import type { ServerRoutes } from '@acme/billing-api'
import { routeTable } from '@acme/billing-api/routes'

export const billing = createApiClient<ServerRoutes>({
  baseUrl: 'https://api.acme.com',
  getToken: async () => localStorage.getItem('acme:token'),
})
registerRoutes(billing, [...routeTable])

const invoice = await billing.invoices.show({ params: { id: 'inv_2041' } })
// => { id: 'inv_2041', customerEmail: 'grace@acme.com', amountCents: 12000, status: 'open', ... }
```

`billing.invoices.store({ body: { customerEmail: 'grace@acme.com' } })` is a type error, because `amountCents` is required. A failed call rejects with a `KitrError` carrying the server's `code` and `fieldErrors`. `billing.invoices.index.query()` and `.mutation({ effects })` plug straight into [Query](/packages/query).

## Pick a runtime

The same `server/main.ts` runs on four runtimes. Switch with one command:

| Runtime | Switch | `kitr dev api` runs |
| --- | --- | --- |
| Node | `kitr config api runtime node` (the default) | `tsx watch server/main.ts` |
| Bun | `kitr config api runtime bun` | `bun --watch server/main.ts` |
| Deno | `kitr config api runtime deno` | `deno run --watch -A server/main.ts` |
| Cloudflare Workers | `kitr add server edge --runtime workers` | `wrangler dev` |

`server/main.ts` exports the server as its default export, which is the fetch handler Workers and Deno Deploy call. Change the port with `kitr config api port 8080`, or for one run with `KITR_API_PORT=8080 kitr dev`.

## Test it

The server is a fetch handler, so tests call it without opening a port and run in parallel:

```ts
// test/invoices.test.ts
import { createTestClient } from '@kitr/testing'
import { describe, expect, it } from 'vitest'
import { server } from '#server/main'

const client = createTestClient(server, { headers: { authorization: 'Bearer tok_ada' } })

describe('invoices', () => {
  it('rejects a request without a token', async () => {
    const res = await createTestClient(server).get('/api/invoices')
    expect(res.status).toBe(401)
  })

  it('validates a new invoice', async () => {
    const res = await client.post('/api/invoices', { customerEmail: 'grace', amountCents: -5 })
    expect(res.status).toBe(422)
    expect(res.body).toMatchObject({ code: 'VALIDATION' })
  })
})
```

```sh
npm test
```

The first request boots the app with every provider in `kitrrc.ts`, database included. For tests that should not touch Postgres, bind a fake client as the [DB guide](/packages/db#testing) shows.

## Keep React out

```sh
kitr doctor
```

Among its other checks, `kitr doctor` fails when a server-only project starts importing React, a router or Vite, for example after someone runs `kitr add forms`. Client-only packages refuse to install here in the first place. Run it in CI next to `npm test`.

## Next steps

- [Deploy to production](/guides/deploy): Docker, Node hosts, Bun, and Cloudflare Workers.
- [API routes](/packages/api): lazy controllers, middleware, rate limits, raw responses and every client option.
- [Server](/packages/server): request-scoped services, health checks, graceful shutdown and tracing.
- [Mail](/packages/mail): email the invoice to the customer when it is created.
- [Run kitr in a monorepo](/guides/monorepo): share `ServerRoutes` with the frontend through a workspace package.
