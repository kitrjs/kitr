---
title: Overview
description: Call a REST API with login tokens added for you and errors in one shape.
order: 0
---

# HTTP client

If your app talks to a backend that already exists, such as a Laravel, Rails, Adonis or Go API, every request needs the same things: the user's login token, one attempt to refresh it when it expires, a CSRF token for cookie sessions, and a failure shape your forms and error screens can rely on. Most apps write that interceptor code once per project and get it slightly wrong.

`@kitr/http` is that client, written once and bound in the app as `http`.

## What it is

`@kitr/http` gives the app one HTTP client. `createHttpClient` adds the token, the refresh, the CSRF header and the error handling to every request, and two helpers, `httpQuery` and `httpMutation`, turn an endpoint into a [query](/packages/query) contract so components cache it, refresh it and show its errors like any other data. Every failure, network or HTTP, arrives as a `KitrError` with a code, a message and field errors when the server sent them.

It runs in the browser, and on the server when a page renders. When the API is part of this app, use [API routes](/packages/api) instead: its client is typed straight from your routes.

## Install

```sh
kitr add http
```

This installs `@kitr/http` and ky, registers the provider in `kitrrc.ts`, writes `config/http.ts` and adds `VITE_API_URL` to `app/env.ts` and `.env.example`. It adds [query](/packages/query) first when the project does not have it. The guide's [Install](/packages/http/guide#install) section lists every change.

## Quick start

Describe the endpoint once. `httpQuery` turns it into a query contract, and `queryFrom` turns that into something components and loaders use:

```ts
// app/features/orders/queries.ts
import { app } from '#app/app'
import { createKeys } from 'kitr/app'
import { httpQuery } from '@kitr/http'
import { queryFrom } from '@kitr/query'

export interface Order {
  id: string
  customer: string
  total: number
}

const http = () => app.container.use('http')
export const orderKeys = createKeys('orders')

export const ordersQuery = queryFrom(
  httpQuery<void, Order[]>(http, { path: 'orders', key: () => orderKeys.list() }),
)
```

Then show it on a page:

```tsx
// app/pages/orders.tsx
import { useSuspenseQuery } from '@kitr/query'
import { ordersQuery } from '#app/features/orders/queries'

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

Open `/orders`. The client calls `GET http://localhost:3333/orders` (the `VITE_API_URL` base), and the page lists what the API returns, for example `Ada: $120` and `Grace: $80`. A failed request arrives as a `KitrError` with the server's code and message. The guide continues from here: [Load your first endpoint](/packages/http/guide#load-your-first-endpoint).

## Built on

`@kitr/http` is [ky](https://github.com/sindresorhus/ky#readme), re-exported. Ky's options, hooks, retries and methods all work on the `http` client as ky documents them.

| What kitr adds | Why |
| --- | --- |
| Token and refresh hooks | `getToken` and `refresh` from [auth](/packages/auth) run on every request and once on a `401`. |
| CSRF | The token from the cookie goes in the header [shield](/packages/shield) expects. |
| `normaliseHttpError` | Timeouts, network failures and every status become one `KitrError`. |
| `httpQuery` and `httpMutation` | Endpoints become [query](/packages/query) contracts with response validation. |
| `config/http.ts` | Base URL, timeout, retries and headers in one file, per environment. |

## Problems it solves

- **Writing the fetch wrapper again.** One configured client with a base URL, timeouts and retries. See [Configure](/packages/http/guide#configure).
- **Endpoints without caching.** `httpQuery` turns `GET /orders` into a query that components read with `useQuery`. See [Turn an endpoint into a query](/packages/http/guide#turn-an-endpoint-into-a-query).
- **Trusting the server's shape.** Validate the response with a schema and get a typed result or a clear error. See [Validate the response](/packages/http/guide#validate-the-response).
- **Expired sessions mid-request.** On a `401` the client refreshes once and retries, then signs out if that fails. See [Refresh an expired token](/packages/http/guide#refresh-an-expired-token).
- **Errors that look different per endpoint.** Every failure is a `KitrError`, so forms show field errors and screens show the message. See [Handle errors](/packages/http/guide#handle-errors).
- **Uploads with progress.** Send `FormData` and track progress through the same client. See [Upload a file](/packages/http/guide#upload-a-file).

## Further reading

- [Guide](/packages/http/guide): install, configure and every task.
- [API reference](/packages/http/api): every export with its signature.
- [ky docs](https://github.com/sindresorhus/ky#readme): every option and method of the client underneath.
- [Query](/packages/query): caching, mutations and effects for the contracts this package builds.
- [Auth](/packages/auth) and [Mocks](/packages/mocks): the token source and the fake API for tests.
- [Loading and saving data](/docs/data): how HTTP fits beside API routes, actions and realtime.
