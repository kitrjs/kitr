---
title: API routes
description: Build JSON API routes with validation, and call them from the browser fully typed.
order: 1
---

# API routes

A mobile app that lists orders, a partner that posts invoices, a webhook from your payment provider: each needs JSON endpoints with clear inputs and clear errors. `@kitr/api` gives you a router, controllers, validation and middleware in the style of [AdonisJS](https://docs.adonisjs.com/guides/basics/routing), and a browser client that knows every route's inputs and outputs without generating code.

> [!SUMMARY]
> Build JSON API routes with validation, and call them from the browser fully typed. Add it with `kitr add server api` (or `kitr add api` if a server platform exists); the overview is at [/packages/api](/packages/api).

It runs on [h3](https://h3.dev) through [Server](/packages/server), inside a TanStack Start app or standalone. Validation takes any [Standard Schema](https://standardschema.dev) library, and `kitr api:sync` writes an [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0) document from the same routes. Routes run on the server; the typed client (`@kitr/api/client`) runs anywhere.

The examples build the Acme orders API at `app.acme.com/api`.

## When to use it

Use API routes for anything outside your own React UI: mobile apps, partners, webhooks, scripts, or whenever you want REST URLs and an OpenAPI document.

For functions only your own UI calls, use [Actions](/packages/actions): no URLs to design, and the same validation and error shape. Both can live in one app.

## Install

```sh
kitr add api
```

<details>
<summary>Everything kitr add changes</summary>

What `kitr add api` does:

- Adds the [Server](/packages/server) package first if it is missing, which also adds [Logger](/packages/logger).
- Installs `@kitr/api` and adds it to `packages` in `kitrrc.ts`. API routes register no provider.
- Writes `config/api.ts` (shown under Configure) and adds it to `config/index.ts`.
- Writes `server/routes.ts`, the server route table, with `api` from `@kitr/api/routes` in its extension list and one `GET /api/health` route. When another package created the table first, it only adds `api` to the list.
- Writes `server/controllers/health-controller.ts`, the controller that route calls.
- When `server/main.ts` exists and does not pass the table to `createServer()` yet, adds `import { routes } from './routes'` and the `routes` option.
- In a React project, writes `app/api/routes.gen.ts`, the route table with the `health` route, and `app/api/client.ts`, the typed client that registers it. Without the table every named call throws `Unknown route`.
- Adds an `api:sync` script (`kitr api:sync`) to `package.json`, which regenerates the route table and `openapi.json` from `server/routes.ts`.
- Adds a `kitr: api` section to `AGENTS.md`: where routes, controllers and validators go, when to use API routes instead of [actions](/packages/actions), and how the client gets its route table.

</details>

The generated routes file:

```ts
// server/routes.ts
import { defineRoutes } from '@kitr/kitr/app'
import api from '@kitr/api/routes'
import HealthController from '#server/controllers/health-controller'

/**
 * Endpoints and sockets of this app. `kitr add` keeps the extension list current; `createServer({ routes })`
 * in server/main.ts serves it.
 */
export const routes = defineRoutes([api], (root) =>
  root.group('/api', (r) =>
    r.get('/health', [HealthController, 'show'], { name: 'health' }),
    // r.resource('projects', () => import('#server/controllers/projects-controller'))
  ),
)

/** Pass to createApiClient<ServerRoutes>() on the client. */
export type ServerRoutes = typeof routes.$types
```

The `api` extension from `@kitr/api/routes` gives the table `.get`, `.post`, `.resource` and friends. [realtime](/packages/realtime) adds `.ws` and `.sse` to the same table.

The generated controller:

```ts
// server/controllers/health-controller.ts
import type { HttpContext } from '@kitr/api'

export default class HealthController {
  async show({ requestId }: HttpContext) {
    return { ok: true, requestId }
  }
}
```

API routes need a server platform; add one with `kitr add server api`. The `fullstack`, `server`, `saas`, `site` and `realtime` kits include API routes.

<details>
<summary>Removing it</summary>

`kitr remove api` removes `@kitr/api` from `package.json` and `kitrrc.ts`, the `api:sync` script, `config/api.ts` and the `AGENTS.md` section. It keeps `server/routes.ts`, your controllers and `app/api/client.ts`, and lists the files that still import `@kitr/api`.

</details>

## Configure

`kitr add api` writes:

```ts
// config/api.ts
import { defineConfig } from '@kitr/api'

export default defineConfig({
  prefix: '/api',
  openapi: { path: 'openapi.json', title: 'acme API', version: '0.1.0' },
})
```

| Option | Default | Description |
| --- | --- | --- |
| `prefix` | none | The path the web app forwards to the server, such as `'/api'`. `kitr api:sync` warns about routes outside it. |
| `openapi.path` | `'openapi.json'` | Where `kitr api:sync` writes the OpenAPI document. |
| `openapi.title` | `'<package name> API'` | `info.title` in the document. |
| `openapi.version` | `package.json` version | `info.version` in the document. |
| `openapi.description` | none | `info.description` in the document. |
| `client.path` | `'app/api/client.ts'` | The typed client's file. `kitr api:sync` writes `routes.gen.ts` next to it. |


## Build your first endpoint

A controller for orders. Each method receives the request context and returns the response body:

```ts
// server/controllers/orders-controller.ts
import type { HttpContext } from '@kitr/api'
import { KitrError } from '@kitr/kitr/app'

export interface Order {
  id: string
  customer: string
  total: number
  status: 'open' | 'paid'
}

const orders = new Map<string, Order>([
  ['ord_1042', { id: 'ord_1042', customer: 'Ada', total: 129, status: 'open' }],
])

export default class OrdersController {
  async index() {
    return [...orders.values()]
  }

  async show({ params }: HttpContext<{ id: string }>) {
    const order = orders.get(params.id)
    if (!order) throw KitrError.notFound('Order')
    return order
  }
}
```

Register it in the routes file:

```ts
// server/routes.ts
import { defineRoutes } from '@kitr/kitr/app'
import api from '@kitr/api/routes'
import HealthController from '#server/controllers/health-controller'
import OrdersController from '#server/controllers/orders-controller'

export const routes = defineRoutes([api], (router) =>
  router.group({ prefix: '/api' }, (r) =>
    r
      .get('/health', [HealthController, 'show'], { name: 'health' })
      .resource('orders', OrdersController),
  ),
)

export type ServerRoutes = typeof routes.$types
```

Start the server with `kitr dev api` (or `kitr dev` in a React app) and ask for an order:

```sh
curl http://localhost:3001/api/orders/ord_1042
```

```json
{ "id": "ord_1042", "customer": "Ada", "total": 129, "status": "open" }
```

`resource('orders', ...)` registered `GET /api/orders` and `GET /api/orders/:id` because the controller has `index` and `show`. An unknown id answers `404` with a `NOT_FOUND` error.

## Define routes

One method per HTTP verb, each taking a path, a handler and options, and chaining:

```ts
// server/routes.ts
import { defineRoutes } from '@kitr/kitr/app'
import api from '@kitr/api/routes'
import InvoicesController from '#server/controllers/invoices-controller'

export const routes = defineRoutes([api], (router) =>
  router
    .get('/api/invoices', [InvoicesController, 'index'], { name: 'invoices.index' })
    .post('/api/invoices', [InvoicesController, 'store'], { name: 'invoices.store' })
    .put('/api/invoices/:id', [InvoicesController, 'replace'], { name: 'invoices.replace' })
    .patch('/api/invoices/:id', [InvoicesController, 'update'], { name: 'invoices.update' })
    .delete('/api/invoices/:id', [InvoicesController, 'destroy'], { name: 'invoices.destroy' })
    .get('/api/ping', () => ({ pong: true }), { name: 'ping' }),
)

export type ServerRoutes = typeof routes.$types
```

A handler is either a `[Controller, 'method']` pair or a function that takes the context. TypeScript checks that the method exists on the controller.

| Route option | Description |
| --- | --- |
| `name` | The name the client calls (`api.invoices.index()`) and `router.url()` looks up. Dots make nested client properties. Without a name, the route is called `'GET /api/ping'`. |
| `validate` | Schemas for `params`, `query` and `body`. See "Validate input". |
| `middleware` | Middleware for this route only, after the group's. |
| `meta` | `summary`, `description`, `tags` and `deprecated`, copied into the OpenAPI document. |

Path parameters start with `:` and arrive as strings in `ctx.params`. A trailing `*` matches the rest of the path.

> [!WARNING] Name client routes
> Give every route you call from the client a `name`. Names stay stable when paths change and become the client's query keys. `router.any()` is not part of the typed client.

## Group routes

`router.group()` shares a prefix, middleware and a name prefix across routes:

```ts
// server/routes.ts
import { defineRoutes } from '@kitr/kitr/app'
import api from '@kitr/api/routes'
import OrdersController from '#server/controllers/orders-controller'
import TeamsController from '#server/controllers/teams-controller'
import { audit } from '#server/middleware/audit'

export const routes = defineRoutes([api], (router) =>
  router.group({ prefix: '/api' }, (r) =>
    r
      .resource('orders', OrdersController)
      .group({ prefix: '/admin', middleware: [audit], as: 'admin' }, (admin) =>
        admin.resource('teams', TeamsController),
      ),
  ),
)

export type ServerRoutes = typeof routes.$types
```

| Group option | Effect |
| --- | --- |
| `prefix` | Joined onto every path inside: `/api` + `/admin` + `/teams` is `/api/admin/teams`. |
| `middleware` | Runs before every route inside, outer groups first. |
| `as` | Prefixes every name inside: `teams.index` becomes `admin.teams.index`, called as `api.admin.teams.index()`. |

`group('/api', ...)` is short for `{ prefix: '/api' }`. `router.use(audit)` adds middleware to routes registered after the call.

## Create a resource

`resource(name, Controller)` registers the five REST routes for the methods the controller has, and names them `<name>.<action>`:

| Method | Path | Controller method | Route name | Client call |
| --- | --- | --- | --- | --- |
| GET | `/orders` | `index` | `orders.index` | `api.orders.index()` |
| POST | `/orders` | `store` | `orders.store` | `api.orders.store({ body })` |
| GET | `/orders/:id` | `show` | `orders.show` | `api.orders.show({ params: { id } })` |
| PATCH | `/orders/:id` | `update` | `orders.update` | `api.orders.update({ params, body })` |
| DELETE | `/orders/:id` | `destroy` | `orders.destroy` | `api.orders.destroy({ params })` |

Narrow it with options:

```ts
// server/routes.ts
import { defineRoutes } from '@kitr/kitr/app'
import api from '@kitr/api/routes'
import InvoicesController from '#server/controllers/invoices-controller'
import ProjectsController from '#server/controllers/projects-controller'
import { audit } from '#server/middleware/audit'

export const routes = defineRoutes([api], (router) =>
  router.group('/api', (r) =>
    r
      .resource('invoices', InvoicesController, { only: ['index', 'show'] })
      .resource('projects', ProjectsController, {
        except: ['destroy'],
        param: 'projectId',
        middleware: [audit],
      }),
  ),
)

export type ServerRoutes = typeof routes.$types
```

`param: 'projectId'` makes the paths `/api/projects/:projectId`, so the controller reads `params.projectId`.

## Load controllers lazily

Pass a function that imports the controller. It loads on the first request, which keeps start-up fast:

```ts
// server/routes.ts
import { defineRoutes } from '@kitr/kitr/app'
import api from '@kitr/api/routes'

export const routes = defineRoutes([api], (router) =>
  router.group('/api', (r) =>
    r
      .resource('orders', () => import('#server/controllers/orders-controller'))
      .get('/orders/:id/receipt', [() => import('#server/controllers/receipts-controller'), 'show'], {
        name: 'orders.receipt',
      }),
  ),
)

export type ServerRoutes = typeof routes.$types
```

A lazy controller can't be inspected, so `resource()` registers all five routes; a missing method answers `404`.

## Write a controller

A controller is a plain class with a default export; `kitr make:controller orders --resource` writes one. Type `HttpContext`'s three parameters for `params`, `query` and `body`:

```ts
// server/controllers/orders-controller.ts
import type { HttpContext } from '@kitr/api'
import { KitrError } from '@kitr/kitr/app'
import { z } from 'zod'

const createOrder = z.object({
  customer: z.string().min(2),
  total: z.number().positive(),
})
const updateOrder = createOrder.partial()

export interface Order {
  id: string
  customer: string
  total: number
  status: 'open' | 'paid'
}

const orders = new Map<string, Order>([
  ['ord_1042', { id: 'ord_1042', customer: 'Ada', total: 129, status: 'open' }],
])

export default class OrdersController {
  static validation = {
    store: { body: createOrder },
    update: { body: updateOrder },
  }

  async index({ query }: HttpContext) {
    const status = typeof query.status === 'string' ? query.status : undefined
    return [...orders.values()].filter((order) => !status || order.status === status)
  }

  async show({ params }: HttpContext<{ id: string }>) {
    const order = orders.get(params.id)
    if (!order) throw KitrError.notFound('Order')
    return order
  }

  async store({ body, response, logger }: HttpContext<{}, {}, z.infer<typeof createOrder>>) {
    const order: Order = { id: `ord_${1042 + orders.size}`, status: 'open', ...body }
    orders.set(order.id, order)
    logger.info('order created', { id: order.id })
    response.status(201)
    return order
  }

  async update({ params, body }: HttpContext<{ id: string }, {}, z.infer<typeof updateOrder>>) {
    const order = orders.get(params.id)
    if (!order) throw KitrError.notFound('Order')
    const updated = { ...order, ...body }
    orders.set(order.id, updated)
    return updated
  }

  async destroy({ params }: HttpContext<{ id: string }>) {
    orders.delete(params.id)
  }
}
```

The context carries everything about the request:

| Field | What it holds |
| --- | --- |
| `params` | Path parameters, validated when a `params` schema is set. |
| `query` | Query string values (`string` or `string[]`), validated when a `query` schema is set. |
| `body` | The parsed body on `POST`, `PUT` and `PATCH`, validated when a `body` schema is set. |
| `request` | Headers, URL, IP and the raw body. See "Read the request". |
| `response` | Status, headers, redirects and raw responses. See "Shape the response". |
| `locals` | Values set by middleware. [Auth](/packages/auth) sets `user` and `can`. |
| `logger` | The request's logger, which adds the request id. |
| `requestId` | The request id from [Server](/packages/server). |
| `app` | The request-scoped app: `app.container.use('db')`. |
| `event` | The underlying h3 event. |
| `validate(schema, source)` | Validates `body`, `query` or `params` on demand. |

A new controller instance is built per request from that request's container. List the bindings its constructor needs in `static inject`:

```ts
// server/controllers/projects_controller.ts
import type { Db } from '#server/db'

export default class ProjectsController {
  static inject = ['db'] as const
  constructor(private db: Db) {}

  async index() {
    return this.db.projects.all()
  }
}
```

## Validate input

Declare schemas per method in `static validation`. kitr validates before the method runs, and the typed client picks up the same types:

```ts
// server/controllers/orders-controller.ts
// ...
export default class OrdersController {
  static validation = {
    store: { body: createOrder },
    update: { body: updateOrder },
  }
  // ...
}
```

A request that fails gets `422` with every problem at once:

```sh
curl -X POST http://localhost:3001/api/orders \
  -H 'content-type: application/json' \
  -d '{"customer":"A","total":-1}'
```

```json
{
  "code": "VALIDATION",
  "message": "Validation failed",
  "status": 422,
  "fieldErrors": {
    "customer": ["Too small: expected string to have >=2 characters"],
    "total": ["Too small: expected number to be >0"]
  }
}
```

[Forms](/packages/forms) puts `fieldErrors` on the matching fields.

For function handlers, pass `validate` in the route options. `params` and `query` schemas also convert values, so `page` below is a number:

```ts
// server/routes.ts
import { defineRoutes } from '@kitr/kitr/app'
import api from '@kitr/api/routes'
import { z } from 'zod'

const invoicePage = z.object({ page: z.coerce.number().int().min(1).default(1) })

export const routes = defineRoutes([api], (router) =>
  router.get('/api/invoices', ({ query }) => ({ page: query.page }), {
    name: 'invoices.index',
    validate: { query: invoicePage },
  }),
)

export type ServerRoutes = typeof routes.$types
```

`?page=2` answers `{ "page": 2 }`; `?page=0` answers `422`.

When the shape depends on the request, call `ctx.validate()`; it throws the same `422`:

```ts
// server/controllers/invoices-controller.ts
import type { HttpContext } from '@kitr/api'
import { z } from 'zod'

const refund = z.object({ amount: z.number().positive(), reason: z.string() })

export default class InvoicesController {
  async refund(ctx: HttpContext<{ id: string }>) {
    const input = await ctx.validate(refund, 'body')
    return { invoice: ctx.params.id, refunded: input.amount }
  }
}
```

Route-option validators win over `static validation`. Without any, `body` is the raw parsed body on writes and `undefined` on reads.

## Read the request

`ctx.request` wraps the incoming request:

```ts
// server/controllers/webhooks-controller.ts
import type { HttpContext } from '@kitr/api'

export default class WebhooksController {
  async payment({ request, logger }: HttpContext) {
    const signature = request.header('x-acme-signature')
    const raw = await request.raw()
    logger.info('payment webhook', {
      ip: request.ip(),
      path: request.url.pathname,
      tags: request.qs().tag,
      signed: Boolean(signature),
    })
    return { received: true, type: (raw as { type?: string }).type }
  }
}
```

| Member | Returns |
| --- | --- |
| `method` | `'POST'` |
| `url` | A `URL` for the request. |
| `headers` | The `Headers` object. |
| `header(name)` | One header value, or `null`. |
| `ip()` | The client IP, or `undefined` when the runtime doesn't expose it. |
| `qs()` | Raw query values; repeated keys become arrays: `?tag=a&tag=b` gives `{ tag: ['a', 'b'] }`. |
| `raw()` | The body parsed by content type (JSON, form or text). Reading it twice returns the same value. |
| `native` | The web `Request`. |

Malformed JSON answers `400` `BAD_REQUEST`, not a `500`.

## Shape the response

Whatever the handler returns becomes the JSON body with status `200`. Use `ctx.response` to change that:

```ts
// server/controllers/orders-controller.ts
import type { HttpContext } from '@kitr/api'

export default class OrdersController {
  async store({ response }: HttpContext) {
    response.status(201).header('location', '/api/orders/ord_1043')
    return { id: 'ord_1043', customer: 'Grace', total: 480, status: 'open' }
  }

  async legacy({ response }: HttpContext) {
    return response.redirect('/api/orders', 301)
  }

  async export({ response }: HttpContext) {
    return response.json({ queued: true }, { status: 202, headers: { 'x-export-id': 'exp_7' } })
  }

  async archive({ response }: HttpContext) {
    return response.noContent()
  }
}
```

| Method | Effect |
| --- | --- |
| `status(code)` | Sets the status for the returned body. Chainable. |
| `header(name, value)` | Sets a response header. Chainable. |
| `redirect(location, status = 302)` | Returns a redirect response. |
| `json(data, init)` | Returns a JSON `Response` with your status and headers. |
| `noContent()` | Returns an empty `204`. |

Returning `undefined` or `null` answers `204` (or the status you set). You can also return any web `Response`, such as a file stream.

## Return errors

Throw a `KitrError` from `@kitr/kitr/app` to answer with an error. The status follows the code:

```ts
// server/controllers/invoices-controller.ts
import type { HttpContext } from '@kitr/api'
import { KitrError } from '@kitr/kitr/app'

export default class InvoicesController {
  async pay({ params }: HttpContext<{ id: string }>) {
    if (params.id === 'INV-1042') throw new KitrError('CONFLICT', 'Invoice INV-1042 is already paid')
    if (params.id.startsWith('draft')) throw KitrError.forbidden('Draft invoices cannot be paid')
    throw KitrError.notFound('Invoice')
  }
}
```

```json
{ "code": "CONFLICT", "message": "Invoice INV-1042 is already paid", "status": 409 }
```

> [!WARNING]
> Anything that is not a `KitrError` becomes `INTERNAL` (500); in production its message is replaced with `Internal server error`. [Server](/packages/server) logs it with the request id.

## Write middleware

Middleware takes the context and `next`. Call `next()` to continue the chain, or return without it to answer early:

```ts
// server/middleware/audit.ts
import { defineMiddleware } from '@kitr/api'

export const audit = defineMiddleware(async (ctx, next) => {
  const started = performance.now()
  const result = await next()
  ctx.logger.info('audited', {
    path: ctx.request.url.pathname,
    durationMs: Math.round(performance.now() - started),
  })
  return result
})
```

`kitr make:middleware audit` writes this skeleton in `server/middleware/audit.ts`. Attach middleware to a group, a resource or one route:

```ts
// server/routes.ts
import { defineRoutes } from '@kitr/kitr/app'
import api from '@kitr/api/routes'
import InvitesController from '#server/controllers/invites-controller'
import { audit } from '#server/middleware/audit'
import { requireTeam } from '#server/middleware/require-team'

export const routes = defineRoutes([api], (router) =>
  router.group({ prefix: '/api', middleware: [audit] }, (r) =>
    r.post('/teams/:teamId/invites', [InvitesController, 'store'], {
      name: 'invites.store',
      middleware: [requireTeam],
    }),
  ),
)

export type ServerRoutes = typeof routes.$types
```

Pass data to the handler through `ctx.locals`, and stop a request by throwing a `KitrError`:

```ts
// server/middleware/require-team.ts
import { defineMiddleware } from '@kitr/api'
import { KitrError } from '@kitr/kitr/app'

export const requireTeam = defineMiddleware(async (ctx, next) => {
  const teamId = ctx.request.header('x-acme-team')
  if (!teamId) throw new KitrError('BAD_REQUEST', 'Missing x-acme-team header')
  ctx.locals.teamId = teamId
  return next()
})
```

Middleware runs group first, then route, then the handler, and back out in reverse. Calling `next()` twice throws. `compose([a, b])` combines several into one.

## Allow cross-origin requests

`cors()` answers preflight requests and sets CORS headers for the origins you list; it takes the same options as `cors()` in [@kitr/shield](/packages/shield). The generated routes file leaves it out because the app and its API share an origin. Add it when another site calls the API:

```ts
// server/routes.ts
import { cors } from '@kitr/api'
import { defineRoutes } from '@kitr/kitr/app'
import api from '@kitr/api/routes'
import OrdersController from '#server/controllers/orders-controller'

export const routes = defineRoutes([api], (router) =>
  router.group(
    {
      prefix: '/api',
      middleware: [cors({ origin: ['https://app.acme.com', 'https://admin.acme.com'], credentials: true })],
    },
    (r) => api.resource('orders', OrdersController),
  ),
)

export type ServerRoutes = typeof routes.$types
```

| Option | Default | Description |
| --- | --- | --- |
| `origin` | none | Allowed origins: one, a list, a function, or `'*'` for a public API. Unset allows none. `'*'` with `credentials` throws. |
| `methods` | `GET, POST, PUT, PATCH, DELETE, OPTIONS` | `access-control-allow-methods` on preflight. |
| `headers` | `Content-Type, Authorization, X-CSRF-Token, X-Requested-With` | Request headers a cross-origin caller may send. |
| `credentials` | `false` | Sends `access-control-allow-credentials: true`, needed for cookies. |
| `maxAge` | `600` | Seconds a browser may cache the preflight. |

kitr registers the `OPTIONS` route for every route behind `cors()`.

> [!WARNING]
> `origin: '*'` with `credentials: true` throws: it would let any site make signed-in requests. With cookies, list your origins.

## Rate limit a route

`rateLimit()` counts requests per client IP in a window and answers `429` past the limit:

```ts
// server/routes.ts
import { rateLimit } from '@kitr/api'
import { defineRoutes } from '@kitr/kitr/app'
import api from '@kitr/api/routes'
import InvitesController from '#server/controllers/invites-controller'

export const routes = defineRoutes([api], (router) =>
  router.post('/api/invites', [InvitesController, 'store'], {
    name: 'invites.store',
    middleware: [
      rateLimit({ max: 5, windowMs: 60_000, key: (ctx) => ctx.request.header('x-acme-team') ?? 'anonymous' }),
    ],
  }),
)

export type ServerRoutes = typeof routes.$types
```

| Option | Default | Description |
| --- | --- | --- |
| `max` | `100` | Requests allowed per key per window. |
| `windowMs` | `60000` | Window length in milliseconds. |
| `key` | client IP | Function from the context to a bucket key, such as a team or user id. |
| `store` | memory | Where counters live. Any `RateLimitStore`; `createRedisRateLimitStore` from [Shield](/packages/shield) shares them between instances. |

Every response carries `ratelimit-limit`, `ratelimit-remaining` and `ratelimit-reset`; a `429` also carries `retry-after`.

> [!WARNING] Several instances
> Counters live in process memory, so behind a load balancer the real limit is `max` times the number of instances. Pass a shared store for one limit:

```ts
// server/security/invite_limit.ts
import { rateLimit } from '@kitr/api'
import { createRedisRateLimitStore } from '@kitr/shield'
import { Redis } from 'ioredis'

const store = createRedisRateLimitStore(new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379'), {
  prefix: 'acme-app:invites:',
})

/** Five invites per team per minute, counted across every instance. */
export const inviteLimit = rateLimit({
  max: 5,
  windowMs: 60_000,
  key: (ctx) => ctx.request.header('x-acme-team') ?? 'anonymous',
  store,
})
```

Use `inviteLimit` in the route's `middleware` list. The store needs [ioredis](https://github.com/redis/ioredis) (`pnpm add ioredis`).

## Require JSON bodies

`requireJson()` rejects `POST`, `PUT` and `PATCH` requests whose `content-type` is not `application/json`, with `400` and `Expected application/json`. Reads pass through:

```ts
// server/routes.ts
import { requireJson } from '@kitr/api'
import { defineRoutes } from '@kitr/kitr/app'
import api from '@kitr/api/routes'
import OrdersController from '#server/controllers/orders-controller'

export const routes = defineRoutes([api], (router) =>
  router.group({ prefix: '/api', middleware: [requireJson()] }, (r) =>
    r.resource('orders', OrdersController),
  ),
)

export type ServerRoutes = typeof routes.$types
```

## Call the API from the browser

In a React project, `kitr add api` writes the client and a route table that maps names such as `orders.show` to a method and path:

```ts
// app/api/client.ts
import { createApiClient, registerRoutes } from '@kitr/api/client'
import type { ServerRoutes } from '#server/routes'
import { routeTable } from './routes.gen'

/** Typed, no codegen: route names, params, bodies and outputs come from the router. */
export const api = createApiClient<ServerRoutes>({ baseUrl: typeof window === 'undefined' ? `http://localhost:${process.env.PORT ?? 3000}` : '' })
registerRoutes(api, [...routeTable])
```

Only the type is imported from `server/routes.ts`, so no server code reaches the browser. Regenerate the table whenever you add or rename a route:

```sh
kitr api:sync
```

> [!WARNING]
> Without a registered table, a named call throws `Unknown route "orders.show"`. On the server, register straight from the router with `registerRoutes(api, routes.toJSON())`.

Every call is checked against the route:

```ts
// app/lib/orders/load.ts
import { api } from '#app/api/client'

const orders = await api.orders.index()
// => [{ id: 'ord_1042', customer: 'Ada', total: 129, status: 'open' }]

const order = await api.orders.show({ params: { id: 'ord_1042' } })
// => { id: 'ord_1042', customer: 'Ada', total: 129, status: 'open' }

const created = await api.orders.store({ body: { customer: 'Grace', total: 480 } })
// => { id: 'ord_1043', status: 'open', customer: 'Grace', total: 480 }

await api.orders.store({ body: { customer: 'Grace' } })
// type error: property 'total' is missing
```

The input has up to three keys: `params` (required when the path has parameters), `query` and `body` (sent as JSON on everything but `GET` and `HEAD`). The return type is what the controller returns; a `204` resolves to `undefined`.

Each endpoint also exposes helpers:

```ts
// app/lib/orders/links.ts
import { api } from '#app/api/client'

api.orders.show.url({ params: { id: 'ord_1042' } })
// => '/api/orders/ord_1042'
api.orders.show.key({ params: { id: 'ord_1042' } })
// => ['api', 'orders.show', { id: 'ord_1042' }, {}]
api.orders.show.method
// => 'GET'
api.orders.show.path
// => '/api/orders/:id'
```

| Client option | Description |
| --- | --- |
| `baseUrl` | Prepended to every path. `''` in the browser calls the same origin. |
| `fetch` | Custom fetch: a test fake, or `server.fetch` for in-process calls. |
| `headers` | Function returning headers for every request; may be async. |
| `getToken` | Function returning a bearer token; sent as `authorization: Bearer <token>` when it returns one. |
| `credentials` | Passed to `fetch`: `'include'` sends cookies cross-origin. |

## Use endpoints with TanStack Query

Every endpoint produces [Query](/packages/query) contracts; `mutation()` takes cache effects:

```tsx
// app/components/orders/orders-page.tsx
import { mutationFrom, queryFrom, useMutation, useSuspenseQuery } from '@kitr/query'
import { api } from '#app/api/client'

const ordersQuery = queryFrom(api.orders.index.query())
const createOrder = mutationFrom(
  api.orders.store.mutation({ effects: { invalidate: [['api', 'orders.index']] } }),
)

export function OrdersPage() {
  const { data: orders } = useSuspenseQuery(ordersQuery.options({}))
  const create = useMutation(createOrder)
  return (
    <section>
      <ul>
        {orders.map((order) => (
          <li key={order.id}>
            {order.customer}: {order.total}
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => create.mutate({ body: { customer: 'Linus', total: 75 } })}>
        New order for Linus
      </button>
    </section>
  )
}
```

The query key is `['api', '<route name>', params, query]`, so `invalidate: [['api', 'orders.index']]` refetches every orders list. In a route loader, call `context.queryClient.ensureQueryData(ordersQuery.options({}))` so the server and client fetch once.

## Handle errors on the client

Failed calls reject with a `KitrError` that carries the server's code, status and field errors:

```ts
// app/lib/orders/create.ts
import { KitrError } from '@kitr/kitr/app'
import { api } from '#app/api/client'

try {
  await api.orders.store({ body: { customer: 'A', total: -1 } })
} catch (error) {
  if (error instanceof KitrError && error.code === 'VALIDATION') {
    console.log(error.fieldErrors)
    // => { customer: ['Too small: expected string to have >=2 characters'], total: ['Too small: expected number to be >0'] }
  }
}
```

| Response | Rejects with |
| --- | --- |
| A kitr error body | The same `code`, `message`, `status`, `fieldErrors` and `data`. |
| Another error body | A code from the status (`403` is `FORBIDDEN`, `502` is `INTERNAL`) and the body's `message` when it has one. |
| No response (offline, DNS, CORS) | `NETWORK`. |
| A missing path parameter | `BAD_REQUEST`, `Missing param "id" for orders.show`, before any request is sent. |

## Send auth tokens from the client

Give the client a token source and every request carries it:

```ts
// app/api/client.ts
import { createApiClient, registerRoutes } from '@kitr/api/client'
import type { ServerRoutes } from '#server/routes'
import { app } from '#app/app'
import { routeTable } from './routes.gen'

export const api = createApiClient<ServerRoutes>({
  baseUrl: 'https://app.acme.com',
  getToken: () => app.container.use('auth').getToken(),
  headers: () => ({ 'x-acme-team': 'team_7' }),
})
registerRoutes(api, [...routeTable])
```

`getToken` comes from [Auth](/packages/auth). For cookie sessions, pass `credentials: 'include'` instead. On the server, `authMiddleware` from `@kitr/auth/server` sets `ctx.locals.user`.

## Call routes in-process

On the server, or in tests, pass the server's `fetch` so calls skip the network:

```ts
// server/jobs/nightly-report.ts
import { createApiClient, registerRoutes } from '@kitr/api/client'
import { server } from '#server/main'
import { type ServerRoutes, routes } from '#server/routes'

const api = createApiClient<ServerRoutes>({ baseUrl: 'http://internal', fetch: (request) => server.fetch(request) })
registerRoutes(api, routes.toJSON())

export async function nightlyReport() {
  const orders = await api.orders.index()
  return { count: orders.length }
}
```

## Mount routes on a server

`createServer({ routes })` mounts the table, so endpoints and sockets go live together. `server/main.ts` does this for you:

```ts
// server/main.ts
import { createServer } from '@kitr/server'
import { routes } from './routes'
import { config } from '../config'
import rc from '../kitrrc'

export const server = createServer({ providers: rc.providers, config, routes })
```

`server.handles(request)` says whether a path belongs to the table. To mount a second table under a base path, use `mountRoutes(server, partnerRoutes, '/partners')`; for your own h3 app, call `toH3(routes, app)`.

## Build URLs for named routes

`routes.url()` builds a path from a route name, with encoded parameters and an optional query string:

```ts
// server/mail/order-link.ts
import { routes } from '#server/routes'

routes.url('orders.show', { id: 'ord_1042' }, { expand: 'customer' })
// => '/api/orders/ord_1042?expand=customer'
```

An unknown name throws `[@kitr/api] No route named "..."`, and a missing parameter throws `[@kitr/api] Missing param "id" for route "orders.show"`.

## Generate an OpenAPI document

```sh
kitr api:sync
```

`kitr api:sync` writes two files:

- `openapi.json` (or `openapi.path` from `config/api.ts`): an OpenAPI 3.1 document. Every route becomes an operation with its name as `operationId`, path parameters, query parameters and request body from the validators, and the `KitrError` schema for `422`.
- `app/api/routes.gen.ts` (or `server/routes.gen.ts` when there is no `app/api/` folder): the route table for `registerRoutes`.

Zod 4 and arktype schemas convert automatically; valibot needs `@valibot/to-json-schema`. Schemas that can't be converted are left out.

Describe operations with `meta`:

```ts
// server/routes.ts
import { defineRoutes } from '@kitr/kitr/app'
import api from '@kitr/api/routes'
import OrdersController from '#server/controllers/orders-controller'

export const routes = defineRoutes([api], (router) =>
  router.post('/api/orders/:id/refund', [OrdersController, 'refund'], {
    name: 'orders.refund',
    meta: { summary: 'Refund an order', tags: ['billing'], description: 'Refunds the full total to the card on file.' },
  }),
)

export type ServerRoutes = typeof routes.$types
```

Build the document in code with `toOpenApi()`, for example to serve it from a route:

```ts
// server/main.ts
import { toOpenApi } from '@kitr/api'
// ...
server.h3.get('/openapi.json', () =>
  toOpenApi(routes, {
    title: 'Acme API',
    version: '1.0.0',
    servers: [{ url: 'https://app.acme.com' }],
  }),
)
```

| `toOpenApi` option | Default | Description |
| --- | --- | --- |
| `title` | `'kitr API'` | `info.title`. |
| `version` | `'0.0.0'` | `info.version`. |
| `description` | none | `info.description`. |
| `servers` | none | The `servers` list. |
| `schemaToJson` | zod, valibot, arktype | Function from a Standard Schema to JSON Schema, for other libraries. |

Operations without `meta.tags` are tagged with the first part of the route name.

## Commands

| Command | What it does |
| --- | --- |
| `kitr make:controller <name>` | Writes `server/controllers/<name>_controller.ts` with one `handle` method. |
| `kitr make:controller <name> --resource` | Writes the controller with `index`, `show`, `store`, `update`, `destroy` and zod validators. |
| `kitr make:middleware <name>` | Writes `server/middleware/<name>.ts` with `defineMiddleware`. |
| `kitr make:validator <name>` | Writes `app/validators/<name>.ts`: a zod schema with `create` and `update` variants and its input type, to share between a form, an action and a controller. |
| `kitr api:sync` | Writes the OpenAPI document and the client route table. `--file` picks the routes file, `--out` the document path. |
| `kitr routes:list` | Prints every route: method, path and name. `--file` picks the routes file. |

`kitr make:controller orders --resource` writes:

```ts
// server/controllers/orders-controller.ts
import type { HttpContext } from '@kitr/api'
import { KitrError } from '@kitr/kitr/app'
import { z } from 'zod'

const createOrders = z.object({ name: z.string().min(2) })
const updateOrders = createOrders.partial()

export default class OrdersController {
  static validation = {
    store: { body: createOrders },
    update: { body: updateOrders },
  }

  async index({ query }: HttpContext) {
    return { items: [], page: Number(query.page ?? 1) }
  }

  async show({ params }: HttpContext<{ id: string }>) {
    throw KitrError.notFound('Orders ' + params.id)
  }

  async store({ body, response }: HttpContext<{}, {}, z.infer<typeof createOrders>>) {
    response.status(201)
    return { id: '1', ...body }
  }

  async update({ params, body }: HttpContext<{ id: string }, {}, z.infer<typeof updateOrders>>) {
    return { id: params.id, ...body }
  }

  async destroy({ params }: HttpContext<{ id: string }>) {
    void params
  }
}
```

`kitr make:middleware audit` writes:

```ts
// server/middleware/audit.ts
import { defineMiddleware } from '@kitr/api'

export const audit = defineMiddleware(async (ctx, next) => {
  // Before the handler
  const result = await next()
  // After the handler
  return result
})
```

`kitr make:validator order` writes:

```ts
// app/validators/order.ts
import { z } from 'zod'

/** Shared between the form, the action and the controller, so one schema decides what is valid. */
export const orderSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
})

export const createOrderSchema = orderSchema
export const updateOrderSchema = orderSchema.partial()

export type OrderInput = z.infer<typeof orderSchema>
```

`kitr routes:list` prints:

```text
  GET     /api/health                              health
  GET     /api/orders                              orders.index
  POST    /api/orders                              orders.store
  GET     /api/orders/:id                          orders.show
```

<details>
<summary>Routes file lookup and custom stubs</summary>

The commands look for `server/routes.ts`, then `app/api/routes.ts`, then `start/routes.ts`. Put a `stubs/controller.ts` in your project (or run `kitr eject stub controller`) to change what `make:controller` writes; `stubs/middleware.ts` and `stubs/validator.ts` work the same way. Every generator takes `--force` to overwrite.

</details>

## Errors

Errors reach the client as JSON, and the typed client turns them back into a `KitrError`.

| Code | When | What to do |
| --- | --- | --- |
| `VALIDATION` (422) | A `params`, `query` or `body` schema failed, or `ctx.validate()` failed. `fieldErrors` lists every problem. | Show `fieldErrors` on the form; [Forms](/packages/forms) does it for you. |
| `BAD_REQUEST` (400) | The body is malformed JSON, `requireJson()` saw another content type, or the client was missing a path parameter. | Send valid JSON with `content-type: application/json`. |
| `UNAUTHORIZED` (401) | `authMiddleware` found no valid token, or a handler threw it. | Sign in, or send the token with `getToken`. |
| `FORBIDDEN` (403) | A permission check failed. | Check the user's abilities. |
| `NOT_FOUND` (404) | No route matches, a controller method is missing, or a handler threw it. | Check the path with `kitr routes:list`. |
| `CONFLICT` (409) | A handler threw it, such as for a duplicate. | Show the message; it is meant for the user. |
| `RATE_LIMITED` (429) | `rateLimit()` saw too many requests. | Wait for `ratelimit-reset` seconds. |
| `INTERNAL` (500) | A handler threw something that is not a `KitrError`, or the client called an unregistered route name. | Read the server log line with the request id; run `kitr api:sync`. |
| `NETWORK` (0) | The client got no response. | Check the connection and CORS. |

## Testing

Use `createTestClient` from [Testing](/packages/testing), or the typed client pointed at `server.fetch`. No port is opened:

```ts
// test/orders.test.ts
import { createApiClient, registerRoutes } from '@kitr/api/client'
import { createTestClient } from '@kitr/testing'
import { describe, expect, it } from 'vitest'
import { server } from '#server/main'
import { type ServerRoutes, routes } from '#server/routes'

const api = createApiClient<ServerRoutes>({ baseUrl: 'http://test', fetch: (request) => server.fetch(request) })
registerRoutes(api, routes.toJSON())

describe('orders API', () => {
  it('lists and shows orders', async () => {
    const orders = await api.orders.index()
    expect(orders.map((order) => order.customer)).toContain('Ada')
    const order = await api.orders.show({ params: { id: 'ord_1042' } })
    expect(order).toMatchObject({ customer: 'Ada', total: 129 })
  })

  it('creates an order with 201', async () => {
    const res = await createTestClient(server).post('/api/orders', { customer: 'Grace', total: 480 })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ customer: 'Grace', total: 480, status: 'open' })
  })

  it('rejects an invalid order with field errors', async () => {
    await expect(api.orders.store({ body: { customer: 'A', total: -1 } })).rejects.toMatchObject({
      code: 'VALIDATION',
      status: 422,
      fieldErrors: { customer: expect.any(Array), total: expect.any(Array) },
    })
  })

  it('answers 404 for an unknown order', async () => {
    await expect(api.orders.show({ params: { id: 'ord_9999' } })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Order not found',
    })
  })
})
```

To test client code without a server, pass a fake `fetch` and assert on the requests it receives:

```ts
// test/order-client.test.ts
import { createApiClient, registerRoutes } from '@kitr/api/client'
import { expect, it, vi } from 'vitest'
import type { ServerRoutes } from '#server/routes'

it('sends the token and the JSON body', async () => {
  const fetch = vi.fn(async (_request: Request) => Response.json({ id: 'ord_1043' }, { status: 201 }))
  const api = createApiClient<ServerRoutes>({ baseUrl: 'https://app.acme.com', fetch, getToken: () => 'tok_ada' })
  registerRoutes(api, [{ name: 'orders.store', method: 'POST', path: '/api/orders' }])

  await api.orders.store({ body: { customer: 'Ada', total: 129 } })

  const request = fetch.mock.calls[0]![0]
  expect(request.url).toBe('https://app.acme.com/api/orders')
  expect(request.headers.get('authorization')).toBe('Bearer tok_ada')
  expect(await request.json()).toEqual({ customer: 'Ada', total: 129 })
})
```

To test one middleware, call it with a minimal context and a `next` function.

## Next steps

- [API reference](/packages/api/api): every export of `@kitr/api`.
- [Auth](/packages/auth): `authMiddleware` and permissions for these routes.
- [Build an API server without React](/guides/api-server): a standalone backend.
