---
title: API routes
description: Build JSON API routes with validation, and call them from the browser fully typed.
order: 1
---

# API routes

When your app needs its own backend, such as saving projects, sending invites or charging cards, you write API routes. `kitr/api` gives you a router, controllers and validation in the style of [AdonisJS](https://adonisjs.com), and a client for the browser that knows every route's inputs and outputs **without generating any code**.

It runs on [h3](https://h3.dev) through [Server](/packages/server), inside a TanStack Start app or as a standalone backend with no React at all.

## Install

```sh
kitr add api
```

This adds [Server](/packages/server) if it isn't there, installs `@kitr/api`, and writes:

- `config/api.ts`
- the routes file: `app/api/routes.ts` in a React app, `start/routes.ts` in a pure backend
- a `HealthController` as a first example

## Routes

```ts
// app/api/routes.ts
import { cors, defineRoutes } from 'kitr/api'
import ProjectsController from '#app/controllers/projects_controller'

export const routes = defineRoutes((router) =>
  router.group({ prefix: '/api', middleware: [cors()] }, (api) =>
    api
      .resource('projects', ProjectsController)
      .get('/me', ({ locals }) => locals.user, { name: 'me' }),
  ),
)

export type AppRoutes = typeof routes.$types
```

`resource('projects', Controller)` creates the five standard routes for whichever methods the controller has:

| Method | Path | Controller method | Client call |
| --- | --- | --- | --- |
| GET | `/api/projects` | `index` | `api.projects.index()` |
| POST | `/api/projects` | `store` | `api.projects.store({ body })` |
| GET | `/api/projects/:id` | `show` | `api.projects.show({ params: { id } })` |
| PATCH | `/api/projects/:id` | `update` | `api.projects.update({ params, body })` |
| DELETE | `/api/projects/:id` | `destroy` | `api.projects.destroy({ params })` |

Single routes take a path, a handler and options: `get`, `post`, `put`, `patch` and `delete`. The handler is a function or a `[Controller, 'method']` pair. Give a route a `name` to call it from the client.

## Controllers

A controller is a plain class. Each method receives the request context and returns the response body:

```ts
// app/controllers/projects_controller.ts
import type { HttpContext } from 'kitr/api'
import { KitrError } from 'kitr/app'
import { z } from 'zod'

const createProject = z.object({ name: z.string().min(2) })

export default class ProjectsController {
  static validation = { store: { body: createProject } }

  async index({ query }: HttpContext) {
    return db.projects.list({ page: Number(query.page ?? 1) })
  }

  async show({ params }: HttpContext<{ id: string }>) {
    const project = await db.projects.find(params.id)
    if (!project) throw KitrError.notFound('Project')
    return project
  }

  async store({ body, response }: HttpContext<{}, {}, z.infer<typeof createProject>>) {
    response.status(201)
    return db.projects.create(body)
  }
}
```

`kitr make:controller projects --resource` writes this skeleton.

- **Validation.** `static validation` maps a method to schemas for its `body`, `query` or `params`; single routes take `{ validate: { body } }` in their options. Any [Standard Schema](https://standardschema.dev) works. A failure responds `422` with `fieldErrors`, which [Forms](/packages/forms) shows on the right fields.
- **Errors.** Throw `KitrError.notFound()`, `.forbidden()`, `.unauthorized()` or `.validation({...})`. Anything else becomes a `500`; in production its message is replaced with "Internal server error" so internals don't leak.
- **Context.** `ctx` has `params`, `query`, `body`, `request`, `response`, `locals` (set by middleware), `logger`, `requestId` and `app`.

## The typed client

```ts
// app/api/client.ts
import { createApiClient } from 'kitr/api/client'
import type { AppRoutes } from './routes'

export const api = createApiClient<AppRoutes>({ baseUrl: '/' })
```

Only the type is imported, so no server code reaches the browser. Every call is checked:

```ts
const project = await api.projects.show({ params: { id: '1' } }) // Project
await api.projects.store({ body: { name: 'Apollo' } })            // body is type-checked
```

Each endpoint also produces [query](/packages/query) contracts, with keys derived from the route name and input:

```tsx
const { data } = useSuspenseQuery(defineQuery(api.projects.index.query()).options({}))

const create = useKitrMutation(
  defineMutation(api.projects.store.mutation({ effects: { invalidate: [['api', 'projects.index']] } })),
)
```

## Middleware

```ts
import { defineMiddleware, rateLimit, requireJson } from 'kitr/api'

const audit = defineMiddleware(async (ctx, next) => {
  ctx.logger.info('request', { path: ctx.request.url.pathname })
  return next()
})

router.group({ prefix: '/api', middleware: [audit, requireJson()] }, (api) =>
  api.post('/invites', [InvitesController, 'store'], { middleware: [rateLimit({ max: 5 })] }),
)
```

Built in: `cors()`, `rateLimit()`, `requireJson()` and `compose()`. Authentication comes from `authMiddleware` in [Auth](/packages/auth).

## OpenAPI

```sh
kitr api:sync
```

Writes an OpenAPI 3.1 document from your routes, with validators converted to JSON Schema (zod 4 automatically). Use it for API docs, Postman or clients in other languages. `toOpenApi(routes)` does the same in code.

## Next steps

- [API reference](/packages/api/api)
- [Server](/packages/server): ports, health checks and shutdown
