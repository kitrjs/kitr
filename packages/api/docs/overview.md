---
title: Overview
description: Build JSON API routes with validation, and call them from the browser fully typed.
order: 0
---

# API routes

## What it is

`@kitr/api` is the HTTP API of a kitr app: routes in a table, controllers, schema validation and plain objects as responses. The typed client reads the same table, and `kitr api:sync` writes an OpenAPI document from it.

Routes run on the server; the client runs anywhere. For functions only your own components call, [actions](/packages/actions) are shorter.

## Install

```sh
kitr add api
```

Adds `@kitr/api`, `config/api.ts`, `server/routes.ts` with a health route, and the typed client in `app/api/client.ts`. Adds [server](/packages/server) first if missing. [Every change](/packages/api/guide#install).

## Quick start

Write a controller. Each method receives the request context and returns the response body:

```ts
// server/controllers/orders_controller.ts
import type { HttpContext } from '@kitr/api'
import { KitrError } from 'kitr/app'

const orders = new Map([['ord_1042', { id: 'ord_1042', customer: 'Ada', total: 129, status: 'open' }]])

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

Register it as a resource:

```ts
// server/routes.ts
import { defineRoutes } from 'kitr/app'
import api from '@kitr/api/routes'
import OrdersController from '#server/controllers/orders_controller'

export const routes = defineRoutes([api], (router) =>
  router.group({ prefix: '/api' }, (r) => r.resource('orders', OrdersController)),
)

export type ServerRoutes = typeof routes.$types
```

Start it with `kitr dev api` and ask for an order:

```sh
curl http://localhost:3001/api/orders/ord_1042
# => { "id": "ord_1042", "customer": "Ada", "total": 129, "status": "open" }
```

`resource` registered `GET /api/orders` and `GET /api/orders/:id` from the controller's methods. An unknown id answers `404` with `{ "code": "NOT_FOUND" }`. Next in the guide: [Build your first endpoint](/packages/api/guide#build-your-first-endpoint).

## Built on

| Layer | Built on | What kitr adds |
| --- | --- | --- |
| HTTP | [h3](https://h3.dev), through [server](/packages/server). | Route groups, resources, lazy controllers, named routes and the middleware order. |
| Validation | Any [Standard Schema](https://standardschema.dev) library: zod, valibot, arktype. | Validated `params`, `query` and `body` on the request, and errors in kitr's one shape. |
| Client | `fetch` | A client typed from the route table, with `KitrError` on failure and TanStack Query helpers. |
| Documentation | [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0) | `kitr api:sync`, which writes the document from the routes and their schemas. |

kitr adds the route table, controllers, validation, the error shape, the typed client and the OpenAPI export.

## Problems it solves

- **Routes, handlers and types kept in three places.** [Define routes](/packages/api/guide#define-routes).
- **Untrusted input in controllers.** [Validate input](/packages/api/guide#validate-input).
- **Errors that look different on every endpoint.** [Return errors](/packages/api/guide#return-errors).
- **A client that drifts from the server.** [Call the API from the browser](/packages/api/guide#call-the-api-from-the-browser).
- **Cross-origin front ends, abusive clients and non-JSON bodies.** [Write middleware](/packages/api/guide#write-middleware).
- **Documentation nobody updates.** [Generate an OpenAPI document](/packages/api/guide#generate-an-openapi-document).
- **Testing through a real port.** [Call routes in-process](/packages/api/guide#call-routes-in-process).

## Further reading

- [Guide](/packages/api/guide).
- [API reference](/packages/api/api).
- [h3 documentation](https://h3.dev).
- [Standard Schema](https://standardschema.dev).
- [OpenAPI 3.1 specification](https://spec.openapis.org/oas/v3.1.0).
- [Server](/packages/server), [Auth](/packages/auth) and [Query](/packages/query).
- [Build an API server without React](/guides/api-server).
