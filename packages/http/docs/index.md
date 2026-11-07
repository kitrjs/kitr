---
title: HTTP client
description: Call a REST API with login tokens added for you and errors in one shape.
order: 1
---

# HTTP client

If your app talks to a backend that already exists, such as a Laravel, Rails, Adonis or Go API, you need a client that adds the user's login token to every request, tries once to refresh it when it expires, and turns every kind of failure into one predictable error. `kitr/http` is that client.

It is [ky](https://github.com/sindresorhus/ky), re-exported, plus `createHttpClient` and two helpers, `httpQuery` and `httpMutation`, that turn endpoints into [query](/packages/query) contracts.

## When to use it

Use it when the API lives outside this app. When the API is part of this app, use [API](/packages/api) instead: its client is typed straight from your routes, with no hand-written types.

## Install

```sh
kitr add http
```

This adds [Query](/packages/query) if it isn't there, installs `@kitr/http` and `ky`, registers the provider, adds `VITE_API_URL` to your env schema and writes `config/http.ts`.

## Configure the base URL and tokens

```ts
// config/http.ts
import { defineConfig } from 'kitr/http'
import { env } from '#app/env'

export default defineConfig({
  baseUrl: env.VITE_API_URL,
})
```

With [Auth](/packages/auth), hand the client its token and refresh functions so you never handle tokens in components:

```ts
export default defineConfig({
  baseUrl: env.VITE_API_URL,
  getToken: () => auth.getToken(),
  refresh: () => auth.refresh(),
  onUnauthorized: () => router.navigate({ to: '/sign-in' }),
})
```

On a `401`, the client calls `refresh()` once. If it returns `true`, the request is retried with the new token; otherwise `onUnauthorized` runs.

## Turn endpoints into queries

```ts
// app/features/projects/queries.ts
import { createKeys } from 'kitr/app'
import { httpMutation, httpQuery } from 'kitr/http'
import { defineMutation, defineQuery } from 'kitr/query'
import { app } from '#app/app'

const http = app.container.use('http')
export const projectKeys = createKeys('projects')

export const projectsQuery = defineQuery(
  httpQuery<{ page: number }, Project[]>(http, {
    path: 'projects',
    key: ({ page }) => projectKeys.list({ page }),
    searchParams: ({ page }) => ({ page }),
  }),
)

export const createProject = defineMutation(
  httpMutation<{ name: string }, Project>(http, {
    path: 'projects',
    effects: { invalidate: [projectKeys.lists()] },
  }),
)
```

- `path` can be a function of the input: `path: (input) => \`projects/${input.id}\``.
- `method` defaults to `post` for mutations; set `'put'`, `'patch'` or `'delete'` as needed.
- `body` defaults to the input itself (except for `get` and `delete`); pass `body: (input) => ...` to reshape it.
- `schema` validates the response with any [Standard Schema](https://standardschema.dev) library (zod, valibot, arktype) and types the result from it.

`kitr make:queries projects` writes this file for you, with list, detail, create, update and delete.

## Errors in one shape

Every failure, whether a network error, a timeout, a `500` with an HTML page or a `422` with a JSON body, becomes a `KitrError`:

```ts
{ code: 'VALIDATION', status: 422, message: 'Invalid input', fieldErrors: { email: ['Already taken'] } }
```

If the server already responds in kitr's error shape, it is kept as-is. If it responds with `{ message }`, `{ error: { message } }` or an `errors` array of `{ field, message }` (the Adonis and VineJS shape), those are mapped. A `422` with `fieldErrors` shows up next to the right inputs in [Forms](/packages/forms) with no extra code.

## Using the client directly

`http` is a normal ky instance, so anything ky can do still works:

```ts
const file = await http.get('reports/latest.csv').blob()
```

## Next steps

- [API reference](/packages/http/api)
- [ky docs](https://github.com/sindresorhus/ky#readme)
