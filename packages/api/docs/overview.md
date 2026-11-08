---
title: Overview
description: Build JSON API routes with validation, and call them from the browser fully typed.
order: 0
---

# API routes

A mobile app that lists orders, a partner that posts invoices, a webhook from your payment provider: each needs JSON endpoints with clear inputs and clear errors. Most teams end up with a router, a validation layer, a hand-written client and an OpenAPI document that drifts from all three.

`@kitr/api` gives you the router, the controllers, the validation and the client from one route table, and writes the OpenAPI document from it too.

## What it is

`@kitr/api` is the HTTP API half of a kitr app. You add endpoints to the route table in `app/routes.ts`, write controllers for them, validate input with a schema and return plain objects. The typed client in `@kitr/api/client` reads the same route table, so the browser knows every route's inputs and outputs without a code generation step, and `kitr api:sync` writes an OpenAPI 3.1 document from it.

Routes and controllers run on the server. The client runs in the browser, on the server and in tests. Use it when something other than your own React app calls your backend: a mobile app, a partner, a webhook. For functions only your React components call, [actions](/packages/actions) are shorter.

## Built on

| Layer | Built on | What kitr adds |
| --- | --- | --- |
| HTTP | [h3](https://h3.dev), through [server](/packages/server). | Route groups, resources, lazy controllers, named routes and the middleware order. |
| Validation | Any [Standard Schema](https://standardschema.dev) library: zod, valibot, arktype. | Validated `params`, `query` and `body` on the request, and errors in kitr's one shape. |
| Client | `fetch` | A client typed from the route table, with `KitrError` on failure and TanStack Query helpers. |
| Documentation | [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0) | `kitr api:sync`, which writes the document from the routes and their schemas. |

The routing style follows [AdonisJS](https://docs.adonisjs.com/guides/basics/routing): groups, resources and controllers rather than one handler per file.

## Problems it solves

- **Routes, handlers and types kept in three places.** The route table is the single source: the server mounts it, the client is typed from it, and the OpenAPI document is generated from it. See [Define routes](/packages/api/guide#define-routes).
- **Untrusted input in controllers.** Every route declares its schema, and the controller receives validated, typed data or the request ends with a 422 the client understands. See [Validate input](/packages/api/guide#validate-input).
- **Errors that look different on every endpoint.** Thrown errors become JSON in one shape, with a code, a message and field errors. See [Return errors](/packages/api/guide#return-errors).
- **A client that drifts from the server.** `@kitr/api/client` reads the route types, so a renamed field is a compile error in the browser. See [Call the API from the browser](/packages/api/guide#call-the-api-from-the-browser).
- **Cross-origin front ends, abusive clients and non-JSON bodies.** Middleware covers CORS, rate limits and content type per route or group. See [Write middleware](/packages/api/guide#write-middleware).
- **Documentation nobody updates.** `kitr api:sync` writes the OpenAPI document on demand or in CI. See [Generate an OpenAPI document](/packages/api/guide#generate-an-openapi-document).
- **Testing through a real port.** Routes can be called in-process, so tests send requests without starting a server. See [Call routes in-process](/packages/api/guide#call-routes-in-process).

## Further reading

- [Guide](/packages/api/guide): install, configure, the first endpoint and every task.
- [API reference](/packages/api/api): every export with its signature.
- [h3 documentation](https://h3.dev): the request and response primitives under every controller.
- [Standard Schema](https://standardschema.dev): the validation libraries you can use.
- [OpenAPI 3.1 specification](https://spec.openapis.org/oas/v3.1.0): what `kitr api:sync` writes.
- [Server](/packages/server), [Auth](/packages/auth) and [Query](/packages/query): the runtime, the middleware and the client contracts around it.
- [Build an API server without React](/guides/api-server).
