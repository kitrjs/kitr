---
title: HTTP client
description: Call a REST API with login tokens added for you and errors in one shape.
order: 1
---

# HTTP client

If your app talks to a backend that already exists, such as a Laravel, Rails, Adonis or Go API, you need a client that adds the user's login token to every request, tries once to refresh it when it expires, and turns every kind of failure into one predictable error. `@kitr/http` is that client.

It is [ky](https://github.com/sindresorhus/ky#readme), re-exported, plus `createHttpClient`, which adds the token, refresh, CSRF and error handling, and two helpers, `httpQuery` and `httpMutation`, that turn endpoints into [Query](/packages/query) contracts. The app gets one client, bound in the container as `http`.

It runs in the browser, and on the server when a page renders. When the API is part of this app, use [API](/packages/api) instead: its client is typed straight from your routes.

This guide follows Acme's order screen at `app.acme.com` talking to an API at `api.acme.com`.

## When to use it

Use `@kitr/http` when the API lives outside this app: a separate backend, a vendor's REST API, a service another team owns. You describe each endpoint once with `httpQuery` or `httpMutation`, and components read it through queries like any other source.

Use [API](/packages/api) when you write the endpoints in this app's `server/` folder, because its client gets the routes, inputs and outputs from your code with no hand-written types. Use [Actions](/packages/actions) for a server function you call from a form or button without designing a URL.

## Install

```sh
kitr add http
```

What `kitr add` does:

- Adds [Query](/packages/query) first if the project does not have it, because `http` requires it.
- Installs `@kitr/http` and `ky`.
- Adds `'@kitr/http'` to `packages` and `() => import('@kitr/http/provider')` to `providers` in `kitrrc.ts`.
- Adds `VITE_API_URL: e.url({ default: 'http://localhost:3333' })` to the `public` block of `createEnv` in `app/env.ts`.
- Adds `VITE_API_URL=http://localhost:3333` to `.env.example`, and to `.env` when that file exists.
- Writes `config/http.ts` (shown under [Configure](#configure)).
- Adds a `## kitr: http` section to `AGENTS.md`: the client is `app.container.use('http')`, endpoints are wrapped with `httpQuery`/`httpMutation`, and errors are already `KitrError`.

`kitr add http` asks no questions. The `app`, `fullstack`, `saas`, `desktop` and `mobile` kits include it. To preview the changes without writing them:

```sh
kitr add http --dry-run
```

`kitr remove http` removes the provider, the `packages` entry, the `ky` and `@kitr/http` dependencies, the `AGENTS.md` section and `config/http.ts`. It leaves `VITE_API_URL` in `app/env.ts` and `.env.example`, and lists the files that still import `@kitr/http`.

## Configure

`kitr add http` writes this file:

```ts
// config/http.ts
import { defineConfig } from '@kitr/http'
import { env } from '#app/env'

export default defineConfig({
  baseUrl: env.VITE_API_URL,
  // getToken: () => auth.getToken(), refresh: () => auth.refresh(),
})
```

| Option | Default | Description |
| --- | --- | --- |
| `baseUrl` | none | Prefix for every relative path. `http.get('orders')` with `baseUrl: 'https://api.acme.com/v1'` requests `https://api.acme.com/v1/orders`. |
| `getToken` | none | Called before every request with the container. Return a token (or a promise of one) to send it; return `null` or `undefined` to send none. |
| `refresh` | none | Called once when a response is `401`, with the container. Return `true` when a new token is ready; the request then retries once with it. |

In `config/http.ts`, `getToken` and `refresh` receive the container the client belongs to. On a server that is the request's own container, because the provider builds one `http` client per request, so `getToken: (container) => container.use('auth').getToken()` sends the token of the user being served and never another's. In the browser it is the app's container. `createHttpClient()` called directly takes the same options without the container.
| `onUnauthorized` | none | Called with the `KitrError` whenever a request finally fails with `401`, for example to send the user to sign in. |
| `authHeader` | `'Authorization'` | Header that carries the token. With the default the value is `Bearer <token>`; any other header gets the raw token. |
| `retry` | `{ limit: 2, methods: ['get', 'put', 'head', 'delete', 'options', 'trace'] }` | ky's retry rule. `POST` and `PATCH` are never retried, so a write is never sent twice. |
| `timeout` | `10_000` | ky's per-request timeout in milliseconds, or `false` for none. |
| `hooks` | `{}` | ky hooks. Yours run after kitr's own `beforeRequest`, `afterResponse` and `beforeError` hooks. |
| `headers`, `credentials`, `fetch`, ... | ky's defaults | Every other [ky option](https://github.com/sindresorhus/ky#options) except `prefixUrl` passes through unchanged. |

| Variable | Used for |
| --- | --- |
| `VITE_API_URL` | The API's base URL, read through `env.VITE_API_URL`. Public, so it ships to the browser. Defaults to `http://localhost:3333`. |

To point production at the real API, set the variable where the app is built:

```sh
VITE_API_URL=https://api.acme.com/v1 pnpm build
```

Because `config/http.ts` is a module, you can compute options in it. This config sends cookies to the API on another origin and adds a header that names the client:

```ts
// config/http.ts
import { defineConfig } from '@kitr/http'
import { env } from '#app/env'

export default defineConfig({
  baseUrl: env.VITE_API_URL,
  credentials: 'include',
  headers: { 'x-acme-client': 'web' },
  timeout: 15_000,
})
```

## Load your first endpoint

Describe the endpoint once in the feature's `queries.ts`. `httpQuery` turns it into a query contract, and `queryFrom` turns that into something components and loaders use:

```ts
// app/queries/orders.ts
import { app } from '#app/app'
import { createKeys } from 'kitr/app'
import { httpQuery } from '@kitr/http'
import { queryFrom } from '@kitr/query'

export interface Order {
  id: string
  customer: string
  total: number
  status: 'open' | 'paid' | 'shipped'
}

const http = () => app.container.use('http')
export const orderKeys = createKeys('orders')

export const ordersQuery = queryFrom(
  httpQuery<void, Order[]>(http, {
    path: 'orders',
    key: () => orderKeys.list(),
  }),
)
```

`http` is a function that returns the client, not the client itself. `app/routes.ts` imports this file for its loader, and the route table loads before the app boots, when the container has no `http` binding yet. `httpQuery` and `httpMutation` take either form and call the function on each request. Pass the client directly only from code that runs after boot, such as an event handler.

Then show it on a page:

```ts
// app/routes.ts
import { ordersQuery } from '#app/queries/orders'

r.page('/orders', {
  loader: ({ context }) => context.queryClient.ensureQueryData(ordersQuery.options()),
  lazy: () => import('./pages/orders'),
})
```

```tsx
// app/pages/orders.tsx
import { useSuspenseQuery } from '@kitr/query'
import { ordersQuery } from '#app/queries/orders'

export default function OrdersPage() {
  const { data: orders } = useSuspenseQuery(ordersQuery.options())
  return (
    <ul>
      {orders.map((order) => (
        <li key={order.id}>
          {order.customer}: ${order.total}
        </li>
      ))}
    </ul>
  )
}
```

Open `/orders`. The loader calls `GET http://localhost:3333/orders`, and the page lists what the API returns, for example `Ada: $120` and `Grace: $80`. If the API is not running, the route's error component shows the `KitrError` instead.

## Read the client

The provider binds one client as `http` in the container. It is a normal ky instance, so every ky method works on it.

Outside components, such as in `queries.ts` or a loader, read it from the app:

```ts
// app/lib/invoices/download.ts
import { app } from '#app/app'

const http = app.container.use('http')

export async function downloadInvoice(id: string) {
  return http.get(`invoices/${id}/pdf`).blob()
}
```

In a component, read it with `useService` from `@kitr/react`:

```tsx
// app/components/invoices/download-button.tsx
import { useService } from '@kitr/react'

export function DownloadButton({ id }: { id: string }) {
  const http = useService('http')
  const download = async () => {
    const pdf = await http.get(`invoices/${id}/pdf`).blob()
    window.open(URL.createObjectURL(pdf))
  }
  return (
    <button type="button" onClick={download}>
      Download PDF
    </button>
  )
}
```

Prefer `httpQuery` for anything a screen shows: the cache, loading states and refreshes come for free. Use the client directly for one-off calls such as a download.

## Call an endpoint directly

The client has a method per HTTP verb. Each returns a response promise with `.json()`, `.text()`, `.blob()` and `.arrayBuffer()`:

```ts
// app/lib/orders/api.ts
import { app } from '#app/app'
import type { Order } from '#app/queries/orders'

const http = app.container.use('http')

const orders = await http.get('orders', { searchParams: { status: 'open', page: 2 } }).json<Order[]>()
// GET https://api.acme.com/v1/orders?status=open&page=2

const created = await http.post('orders', { json: { customer: 'Linus', total: 45 } }).json<Order>()
// => { id: 'ord_3', customer: 'Linus', total: 45, status: 'open' }

await http.delete(`orders/${created.id}`)
```

A leading slash makes no difference: `http.get('/orders')` and `http.get('orders')` both request `<baseUrl>/orders`. An absolute URL such as `https://billing.acme.com/rates` ignores `baseUrl`.

For a client with extra defaults, call ky's `extend`. It keeps the token, refresh and error handling:

```ts
// app/lib/billing/client.ts
import { app } from '#app/app'

export const billing = app.container.use('http').extend({
  headers: { 'x-acme-team': 'billing' },
  timeout: 30_000,
})
```

## Turn an endpoint into a query

`httpQuery(client, options)` returns a query contract that sends a `GET`. Pass it to `queryFrom`:

```ts
// app/queries/orders.ts
import { app } from '#app/app'
import { createKeys } from 'kitr/app'
import { httpQuery } from '@kitr/http'
import { queryFrom } from '@kitr/query'
import type { Order } from './types'

const http = () => app.container.use('http')
export const orderKeys = createKeys('orders')

export const orderQuery = queryFrom(
  httpQuery<string, Order>(http, {
    path: (id) => `orders/${id}`,
    key: (id) => orderKeys.detail(id),
  }),
)

export const ordersQuery = queryFrom(
  httpQuery<{ status?: Order['status']; page: number }, Order[]>(http, {
    path: 'orders',
    key: (filters) => orderKeys.list(filters),
    searchParams: ({ status, page }) => ({ status, page }),
    staleTime: 10_000,
  }),
)
```

| Option | Default | Description |
| --- | --- | --- |
| `path` | required | A path relative to `baseUrl`, or a function of the input that returns one. |
| `key` | required | The cache key for an input. Include every input that changes the result. |
| `searchParams` | none | A function of the input that returns query string values. `undefined` values are left out, so `{ status: undefined, page: 1 }` sends `?page=1`. |
| `schema` | none | A [Standard Schema](https://standardschema.dev) that validates the response and types the result. |
| `options` | `{}` | ky options for this request only, such as `headers` or `timeout`. |
| `staleTime` | the config's | How long this query's data stays fresh, in milliseconds. |

The query passes TanStack's abort signal to ky, so leaving the page cancels the request. The contract's `source` is `'http'`, which devtools shows.

## Validate the response

An API you don't control can change shape. Give `httpQuery` or `httpMutation` a `schema` from zod, valibot or any other Standard Schema library, and a response that fails it becomes a `VALIDATION` error instead of a crash three components later. The schema also types the result, so you can drop the generic:

```ts
// app/queries/invoices.ts
import { app } from '#app/app'
import { createKeys } from 'kitr/app'
import { httpQuery } from '@kitr/http'
import { queryFrom } from '@kitr/query'
import { z } from 'zod'

const http = () => app.container.use('http')
export const invoiceKeys = createKeys('invoices')

const invoice = z.object({
  id: z.string(),
  orderId: z.string(),
  total: z.number(),
  paidAt: z.string().nullable(),
})

export const invoicesQuery = queryFrom(
  httpQuery(http, {
    path: 'invoices',
    key: () => invoiceKeys.list(),
    schema: z.array(invoice),
  }),
)
```

When the API sends `{ "total": "80.00" }` where a number is expected, the query fails with:

```ts
// => KitrError { code: 'VALIDATION', status: 422, message: 'Validation failed', fieldErrors: { '0.total': ['Invalid input: expected number, received string'] } }
```

The key is the path to the bad value (`0.total`: the first invoice's `total`). The message comes from your schema library; this one is zod 4's.

## Turn an endpoint into a mutation

`httpMutation(client, options)` returns a mutation contract. Pass it to `mutationFrom` and run it with `useMutation`. Declare `effects` so every screen showing the changed data updates:

```ts
// app/queries/orders.ts
import { app } from '#app/app'
import { httpMutation } from '@kitr/http'
import { mutationFrom } from '@kitr/query'
import { orderKeys } from './keys'
import type { Order } from './types'

const http = () => app.container.use('http')

export const createOrder = mutationFrom(
  httpMutation<{ customer: string; total: number }, Order>(http, {
    path: 'orders',
    effects: { invalidate: [orderKeys.lists()] },
  }),
)

export const shipOrder = mutationFrom(
  httpMutation<{ id: string; carrier: string }, Order>(http, {
    method: 'post',
    path: (input) => `orders/${input.id}/ship`,
    body: (input) => ({ carrier: input.carrier }),
    effects: (order) => ({
      set: [{ key: orderKeys.detail(order.id), data: order }],
      invalidate: [orderKeys.lists()],
    }),
  }),
)
```

```tsx
// app/components/orders/ship-button.tsx
import { useMutation } from '@kitr/query'
import { shipOrder } from '#app/queries/orders'

export function ShipButton({ id }: { id: string }) {
  const ship = useMutation(shipOrder)
  return (
    <button type="button" disabled={ship.isPending} onClick={() => ship.mutate({ id, carrier: 'UPS' })}>
      Ship
    </button>
  )
}
```

| Option | Default | Description |
| --- | --- | --- |
| `method` | `'post'` | One of `'get'`, `'post'`, `'put'`, `'patch'`, `'delete'`. |
| `path` | required | A path, or a function of the input that returns one. |
| `body` | the input | Builds the JSON body from the input. By default the input is the body (none for `get` and `delete`). |
| `schema` | none | A Standard Schema that validates the response and types the result. |
| `effects` | none | Cache effects after success: an object, or a function of `(result, input)`. See [Query](/packages/query). |
| `options` | `{}` | ky options for this request only. |

## Delete and update records

`delete` sends no body by default, and a `204 No Content` response resolves to `undefined`, so the result type is `void`:

```ts
// app/queries/projects.ts
import { app } from '#app/app'
import { createKeys } from 'kitr/app'
import { httpMutation } from '@kitr/http'
import { mutationFrom } from '@kitr/query'

const http = () => app.container.use('http')
export const projectKeys = createKeys('projects')

export const deleteProject = mutationFrom(
  httpMutation<{ id: string }, void>(http, {
    method: 'delete',
    path: ({ id }) => `projects/${id}`,
    effects: (_result, { id }) => ({
      remove: [projectKeys.detail(id)],
      invalidate: [projectKeys.lists()],
    }),
  }),
)

export const renameProject = mutationFrom(
  httpMutation<{ id: string; name: string }, { id: string; name: string }>(http, {
    method: 'patch',
    path: ({ id }) => `projects/${id}`,
    body: ({ name }) => ({ name }),
    effects: (project) => ({ set: [{ key: projectKeys.detail(project.id), data: project }] }),
  }),
)
```

`renameProject` sends `PATCH /projects/prj_1` with the body `{"name":"Website"}`; the `id` stays in the URL because `body` leaves it out.

## Upload a file

`httpMutation` always sends JSON. For a file, call the client with a `FormData` body and let the browser set the multipart headers:

```ts
// app/lib/invoices/import.ts
import { app } from '#app/app'
import { mutationFrom } from '@kitr/query'
import { invoiceKeys } from '#app/queries/invoices'

const http = app.container.use('http')

export const importInvoices = mutationFrom({
  mutate: async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return http.post('invoices/import', { body: form, timeout: 60_000 }).json<{ imported: number }>()
  },
  effects: { invalidate: [invoiceKeys.lists()] },
})
// => { imported: 42 }
```

Don't set `content-type` yourself for `FormData`: the browser adds the boundary the server needs to parse the body. For uploads to your own server with progress and size limits, see [Uploads](/packages/uploads).

## Send the login token

`getToken` runs before every request. When it returns a token, the client sends `Authorization: Bearer <token>`. With [Auth](/packages/auth)'s token adapter, keep the adapter in its own module and point the client at it:

```ts
// app/auth/adapter.ts
import { localStorageTokens, tokenAdapter } from '@kitr/auth'
import { env } from '#app/env'

export const authAdapter = tokenAdapter<{ id: string; email: string }>({
  storage: localStorageTokens('acme:token'),
  refreshStorage: localStorageTokens('acme:refresh'),
  fetchUser: async (token) => {
    const res = await fetch(`${env.VITE_API_URL}/me`, { headers: { authorization: `Bearer ${token}` } })
    return res.ok ? res.json() : null
  },
  refresh: async (refreshToken) => {
    const res = await fetch(`${env.VITE_API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    return res.ok ? res.json() : null
  },
})
```

```ts
// config/http.ts
import { defineConfig } from '@kitr/http'
import { authAdapter } from '#app/auth/adapter'
import { env } from '#app/env'

export default defineConfig({
  baseUrl: env.VITE_API_URL,
  getToken: () => authAdapter.getToken?.(),
  refresh: async () => (await authAdapter.refresh?.()) ?? false,
  onUnauthorized: () => window.location.assign('/sign-in'),
})
```

Components never touch the token. When Ada signs in, the adapter stores her token, and the next request carries it.

An API that expects a key in its own header gets the raw token. This config sends `x-api-key: <token>` and no `Authorization` header:

```ts
// config/http.ts
import { defineConfig } from '@kitr/http'
import { env } from '#app/env'

export default defineConfig({
  baseUrl: env.VITE_API_URL,
  authHeader: 'x-api-key',
  getToken: () => localStorage.getItem('acme:api-key'),
})
```

> **Warning**
> `VITE_` variables are compiled into the browser bundle, where anyone can read them. Never put a secret API key in one. Fetch per-user tokens at sign-in instead.

## Refresh an expired token

When a response is `401` and `refresh` is set, the client calls `refresh()` once. If it returns `true`, the client reads the token again with `getToken()` and retries the request once, marked with an `x-kitr-retried: 1` header. If it returns `false`, or the retry is also `401`, the request fails with an `UNAUTHORIZED` error and `onUnauthorized` runs.

Several requests that fail at the same moment share one `refresh()` call. When Grace's dashboard loads orders, invoices and projects together after her token expired, the client refreshes once and retries all three with the new token.

`onUnauthorized` runs for every request that ends in `401`, with or without `refresh`. Use it to sign the user out or send them to the sign-in page, not to show a message per request:

```ts
// config/http.ts
import { defineConfig } from '@kitr/http'
import { env } from '#app/env'

export default defineConfig({
  baseUrl: env.VITE_API_URL,
  onUnauthorized: (error) => {
    console.warn('Session ended:', error.message)
    window.location.assign(`/sign-in?next=${encodeURIComponent(window.location.pathname)}`)
  },
})
```

## Send the CSRF token

On every request except `GET`, `HEAD` and `OPTIONS`, the client reads the `kitr-csrf` cookie and sends its value as the `x-csrf-token` header. That is the double-submit check of [Shield](/packages/shield), so writes to a same-site kitr server pass its CSRF check with no code. A request that already has an `x-csrf-token` header keeps it. On the server there is no `document`, so no header is added.

## Retry and time out

Idempotent requests (`GET`, `PUT`, `HEAD`, `DELETE`, `OPTIONS`, `TRACE`) retry up to twice on ky's retryable statuses, such as `408`, `429`, `500`, `502`, `503` and `504`, and on network errors, with ky's backoff between attempts. `POST` and `PATCH` are never retried, because sending a payment or an order twice is worse than showing an error.

Queries add their own retries on top: [Query](/packages/query) retries failed queries twice unless the status is 4xx. For a screen that must fail fast, turn off one layer:

```ts
// config/http.ts
import { defineConfig } from '@kitr/http'
import { env } from '#app/env'

export default defineConfig({
  baseUrl: env.VITE_API_URL,
  retry: 0, // Query's retries are enough
  timeout: 5_000,
})
```

For one slow endpoint, pass `options` to the contract instead of changing every request:

```ts
// app/queries/reports.ts
import { app } from '#app/app'
import { httpQuery } from '@kitr/http'
import { queryFrom } from '@kitr/query'

const http = () => app.container.use('http')

export const yearlyReportQuery = queryFrom(
  httpQuery<number, { year: number; revenue: number }>(http, {
    path: (year) => `reports/${year}`,
    key: (year) => ['reports', year],
    options: { timeout: 60_000, retry: 0 },
  }),
)
```

## Add hooks

ky [hooks](https://github.com/sindresorhus/ky#hooks) run around every request. Pass them in `config/http.ts`; yours run after kitr's, so `beforeRequest` sees the token already set and `beforeError` receives the normalised `KitrError`:

```ts
// config/http.ts
import { defineConfig } from '@kitr/http'
import { env } from '#app/env'

export default defineConfig({
  baseUrl: env.VITE_API_URL,
  hooks: {
    beforeRequest: [
      ({ request }) => {
        request.headers.set('x-request-id', crypto.randomUUID())
      },
    ],
    afterResponse: [
      ({ response }) => {
        const remaining = response.headers.get('x-ratelimit-remaining')
        if (remaining === '0') console.warn('Acme API rate limit reached')
      },
    ],
  },
})
```

## Handle errors

Every failure becomes a `KitrError` with `code`, `status`, `message` and, when the API sends them, `fieldErrors` and `data`. Components, forms and queries check `code`, never the raw response:

```ts
// app/lib/orders/place-order.ts
import { app } from '#app/app'
import { isKitrError } from 'kitr/app'

const http = app.container.use('http')

try {
  await http.post('orders', { json: { customer: 'Ada', total: -5 } })
} catch (error) {
  if (isKitrError(error) && error.code === 'VALIDATION') console.log(error.fieldErrors)
  // => { total: ['Must be positive'] }
}
```

The client reads the error body in this order:

| The API responds with | The `KitrError` has |
| --- | --- |
| kitr's own shape `{ code, message, status, fieldErrors? }` | Those fields as-is. |
| `{ errors: [{ field, message }] }` (Adonis, VineJS) | `fieldErrors` keyed by `field`, or `path`; entries without either go under `_root`. |
| `{ message: '...' }` | That message. |
| `{ error: { message: '...' } }` or `{ error: '...' }` | That message. |
| No JSON body, such as an HTML error page | The status's code and a message from it, such as `'Not found'`. |

The full parsed body is kept in `error.data`. For example, a `409` with `{ "message": "Invoice already paid" }` becomes:

```ts
// => KitrError { code: 'CONFLICT', status: 409, message: 'Invoice already paid', data: { message: 'Invoice already paid' } }
```

A `422` whose `fieldErrors` reach a [Forms](/packages/forms) `<Form>` shows each message under its input, with no code in the component.

## Commands

| Command | What it does |
| --- | --- |
| `kitr make:queries <name>` | Writes `app/queries/<name>.ts` with keys, a list query, a detail query and an update mutation over `@kitr/http`. |

```sh
kitr make:queries orders
```

It writes `app/queries/orders.ts`:

```ts
// app/queries/orders.ts
import { createKeys } from 'kitr/app'
import { mutationFrom, queryFrom } from '@kitr/query'
import { httpMutation, httpQuery } from '@kitr/http'
import { app } from '#app/app'

const http = () => app.container.use('http')
export const ordersKeys = createKeys('orders')

export interface Orders {
  id: string
  name: string
}

export const ordersListQuery = queryFrom(
  httpQuery<void, Orders[]>(http, { path: 'orders', key: () => ordersKeys.list() }),
)

export const ordersQuery = queryFrom(
  httpQuery<string, Orders>(http, { path: (id) => `orders/${id}`, key: (id) => ordersKeys.detail(id) }),
)

export const updateOrders = mutationFrom(
  httpMutation<Partial<Orders> & { id: string }, Orders>(http, {
    method: 'patch',
    path: (input) => `orders/${input.id}`,
    effects: (result) => ({ set: [{ key: ordersKeys.detail(result.id), data: result }], invalidate: [ordersKeys.lists()] }),
  }),
)
```

Names come from the argument as given, so pass the singular (`kitr make:queries order`) if you want `Order` and `orderQuery`. Pass `--force` to overwrite an existing file. To change the template for your project, run `kitr eject stub queries` and edit `stubs/queries.ts`.

## Errors

| Code | When | What to do |
| --- | --- | --- |
| `BAD_REQUEST` | `400`, or any 4xx not listed below. | Fix the request; the message usually says what is wrong. |
| `UNAUTHORIZED` | `401` after `refresh` failed or was not set. `onUnauthorized` runs. | Sign the user in again. |
| `FORBIDDEN` | `403`. | Hide the action, or ask the API owner for access. |
| `NOT_FOUND` | `404`. | Show a not-found state; the record was deleted or the path is wrong. |
| `TIMEOUT` | `408` from the server. | Retry later. |
| `CONFLICT` | `409`. | Reload the record and let the user decide. |
| `PAYLOAD_TOO_LARGE` | `413`. | Send a smaller body or file. |
| `VALIDATION` | `422`, or a response that fails the contract's `schema`. | Show `fieldErrors` next to the inputs; for a schema failure, update the schema or the API. |
| `RATE_LIMITED` | `429`. | Back off; ky already retried idempotent requests. |
| `INTERNAL` | `500` or any other 5xx; also a network failure or a client-side timeout. | Show a retry button. The message names the cause, such as `Request timed out: GET https://api.acme.com/v1/orders`. |
| `UNAVAILABLE` | `503`. | Show a maintenance notice and retry later. |

`normaliseHttpError(error)` performs this mapping on any error, if you call ky outside the client:

```ts
// app/lib/errors.ts
import { normaliseHttpError } from '@kitr/http'

export async function describeError(error: unknown) {
  const kitrError = await normaliseHttpError(error)
  return `${kitrError.code} (${kitrError.status}): ${kitrError.message}`
}
// describeError(new TypeError('Failed to fetch')) => 'NETWORK (0): Network request failed'
```

## Testing

`createHttpClient` takes ky's `fetch` option, so a test passes a fake `fetch` and never touches the network. The fake sees the real `Request`, with the URL, headers and body the client built:

```ts
// app/queries/orders.test.ts
import { createKeys } from 'kitr/app'
import { createHttpClient, httpMutation, httpQuery } from '@kitr/http'
import { describe, expect, it, vi } from 'vitest'

interface Order {
  id: string
  customer: string
  status: 'open' | 'shipped'
}

const orderKeys = createKeys('orders')

function fakeApi(handler: (request: Request) => Response) {
  const requests: Request[] = []
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init)
    requests.push(request.clone())
    return handler(request)
  })
  return { fetch: fetch as unknown as typeof globalThis.fetch, requests }
}

describe('orders endpoints', () => {
  it('lists open orders with the token and filters', async () => {
    const api = fakeApi(() => Response.json([{ id: 'ord_1', customer: 'Ada', status: 'open' }]))
    const http = createHttpClient({ baseUrl: 'https://api.acme.com/v1', getToken: () => 'tok_ada', fetch: api.fetch })
    const orders = httpQuery<{ status?: string }, Order[]>(http, {
      path: 'orders',
      key: (filters) => orderKeys.list(filters),
      searchParams: ({ status }) => ({ status }),
    })

    expect(await orders.fetch({ status: 'open' }, {})).toEqual([{ id: 'ord_1', customer: 'Ada', status: 'open' }])
    expect(api.requests[0]!.url).toBe('https://api.acme.com/v1/orders?status=open')
    expect(api.requests[0]!.headers.get('authorization')).toBe('Bearer tok_ada')
  })

  it('turns a 422 into field errors', async () => {
    const api = fakeApi(() =>
      Response.json({ errors: [{ field: 'customer', message: 'Required' }] }, { status: 422 }),
    )
    const http = createHttpClient({ baseUrl: 'https://api.acme.com/v1', fetch: api.fetch })
    const createOrder = httpMutation<{ customer: string }, Order>(http, { path: 'orders' })

    await expect(createOrder.mutate({ customer: '' })).rejects.toMatchObject({
      code: 'VALIDATION',
      status: 422,
      fieldErrors: { customer: ['Required'] },
    })
    expect(await api.requests[0]!.json()).toEqual({ customer: '' })
  })
})
```

To test with the app's own provider and config, boot a test app and pass the fake `fetch` in the `http` config:

```ts
// app/lib/orders/provider.test.ts
import { httpProvider } from '@kitr/http'
import { createTestApp } from '@kitr/testing'
import { expect, it } from 'vitest'

it('binds a client with the base URL', async () => {
  const fetch = async (input: RequestInfo | URL) =>
    Response.json({ url: input instanceof Request ? input.url : String(input) })
  const app = await createTestApp({
    providers: [httpProvider],
    config: { http: { baseUrl: 'https://api.acme.com/v1', fetch: fetch as typeof globalThis.fetch } },
  })

  expect(await app.container.use('http').get('teams').json()).toEqual({
    url: 'https://api.acme.com/v1/teams',
  })
})
```

To fake the API for a whole app, in tests and in the browser during development, use [Mocks](/packages/mocks): its handlers answer every request the client makes, with no change to `config/http.ts`.

## Devtools

With [Devtools](/packages/devtools) installed, every request in development is logged to the Log panel under `http`, for example `GET /orders → 200 (84ms)`. The entry carries the full URL, the status and the time in milliseconds. Responses from `400` to `499` log as warnings and `500` and above as errors, so a failing endpoint stands out.

## Next steps

- [API reference](/packages/http/api)
- [ky docs](https://github.com/sindresorhus/ky#readme): every option and method works on the `http` client.
- [Query](/packages/query): caching, mutations and effects for the contracts this package builds.
- [Auth](/packages/auth): sign-in and the token adapter that feeds `getToken` and `refresh`.
- [Mocks](/packages/mocks): fake the API in tests and development.
- [Loading and saving data](/docs/data): how HTTP fits beside API routes, actions and realtime.
- [Choosing a data source](/docs/data-sources): when to use HTTP and when to use actions, API routes, HTTP or realtime.
