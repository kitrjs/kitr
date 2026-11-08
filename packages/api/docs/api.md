---
title: API
description: Every export of @kitr/api and @kitr/api/client.
order: 2
---

# API

## defineRoutes

```ts
const routes = defineRoutes((router) => router.get(...).group(...))
type AppRoutes = typeof routes.$types
```

### Router methods

| Method | Description |
| --- | --- |
| `get / post / put / patch / delete(path, handler, options?)` | Add a route. `handler` is `(ctx) => body` or `[Controller, 'method']`. |
| `resource(name, Controller)` | `index`, `store`, `show`, `update`, `destroy` under `/<name>`. |
| `group({ prefix?, middleware?, as? }, (router) => router)` | Share a prefix, middleware and name prefix. |
| `toJSON()` | Route names, methods and paths, for `registerRoutes`. |

### Route options

| Option | Description |
| --- | --- |
| `name` | Used by the client (`api.projects.show`) and `router.url()`. |
| `validate` | `{ params?, query?, body? }` Standard Schemas. |
| `middleware` | Extra middleware for this route. |
| `meta` | `summary`, `description`, `tags`, `deprecated`, emitted into OpenAPI. |

## HttpContext

```ts
interface HttpContext<Params, Query, Body> {
  params: Params
  query: Query
  body: Body
  request: KitrRequest   // method, url, header(name)
  response: KitrResponse // status(code), header(name, value)
  locals: Record<string, unknown>
  logger: Logger
  requestId: string
  app: KitrApp
  validate(schema, source?: 'body' | 'query' | 'params'): Promise<Output>
}
```

## Middleware

```ts
defineMiddleware(async (ctx, next) => { ...; return next() })
cors({ origin?, methods?, headers?, credentials?, maxAge? })
rateLimit({ max?, windowMs?, key? })
requireJson()
compose([a, b, c])
```

## Mounting

```ts
mountRoutes(server: KitrServer, routes: Router, base = '/'): KitrServer
toH3(routes, app, { h3? }): H3
```

## toOpenApi

```ts
toOpenApi(routes, { title?, version?, description?, servers?, schemaToJson? }): Promise<OpenAPIDocument>
```

## Configuration

```ts
// config/api.ts
defineConfig({
  prefix?: string,
  openapi?: { path?: string; title?: string; version?: string; description?: string },
  client?: { path?: string },
})
```

Read by `kitr api:sync`.

## @kitr/api/client

```ts
createApiClient<AppRoutes>({
  baseUrl: string,
  fetch?: (request: Request) => Promise<Response>, // e.g. server.fetch in tests
  headers?: () => HeadersInit | Promise<HeadersInit>,
  getToken?: () => string | null | Promise<...>,
  credentials?: RequestCredentials,
})
```

Each endpoint is callable and has:

| Member | Description |
| --- | --- |
| `(input?)` | Call it. Input is `{ params?, query?, body? }`, typed per route. |
| `.query()` | A query contract for `queryFrom`. |
| `.mutation({ effects? })` | A mutation contract for `mutationFrom`. |
| `.key(input?)` | The cache key: `['api', routeName, params, query]`. |
| `.url(input?)` | The full URL. |
| `.method`, `.path` | From the route. |

Errors reject with a `KitrError`.
