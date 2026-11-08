---
title: Overview
description: Call a REST API with login tokens added for you and errors in one shape.
order: 0
---

# HTTP client

## What it is

`@kitr/http` gives the app one HTTP client with the token, refresh, CSRF header and error handling on every request. `httpQuery` and `httpMutation` turn an endpoint into a [query](/packages/query) contract. Every failure is a `KitrError`.

Runs in the browser and during server rendering. When the API is this app, use [API routes](/packages/api) instead.

## Install

```sh
kitr add http
```

Adds `@kitr/http` and ky, its provider, `config/http.ts` and `VITE_API_URL` in `.env.example`. Adds [query](/packages/query) first if missing. [Every change](/packages/http/guide#install).

## Quick start

Describe the endpoint once:

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

Open `/orders`. The client calls `GET http://localhost:3333/orders` and the page lists the result. A failed request arrives as a `KitrError`. Next in the guide: [Load your first endpoint](/packages/http/guide#load-your-first-endpoint).

## Built on

| What kitr adds | Why |
| --- | --- |
| Token and refresh hooks | `getToken` and `refresh` from [auth](/packages/auth) run on every request and once on a `401`. |
| CSRF | The token from the cookie goes in the header [shield](/packages/shield) expects. |
| `normaliseHttpError` | Timeouts, network failures and every status become one `KitrError`. |
| `httpQuery` and `httpMutation` | Endpoints become [query](/packages/query) contracts with response validation. |
| `config/http.ts` | Base URL, timeout, retries and headers in one file, per environment. |

kitr adds the token and CSRF plumbing, the query helpers and the error shape.

## Problems it solves

- **Writing the fetch wrapper again.** [Configure](/packages/http/guide#configure).
- **Endpoints without caching.** [Turn an endpoint into a query](/packages/http/guide#turn-an-endpoint-into-a-query).
- **Trusting the server's shape.** [Validate the response](/packages/http/guide#validate-the-response).
- **Expired sessions mid-request.** [Refresh an expired token](/packages/http/guide#refresh-an-expired-token).
- **Errors that look different per endpoint.** [Handle errors](/packages/http/guide#handle-errors).
- **Uploads with progress.** [Upload a file](/packages/http/guide#upload-a-file).

## Further reading

- [Guide](/packages/http/guide).
- [API reference](/packages/http/api).
- [ky docs](https://github.com/sindresorhus/ky#readme).
- [Query](/packages/query).
- [Auth](/packages/auth) and [Mocks](/packages/mocks).
- [Loading and saving data](/docs/data).
