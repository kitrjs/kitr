---
title: Overview
description: Load data from your API, keep it cached, and refresh it when something changes.
order: 0
---

# Query

## What it is

`@kitr/query` is the data layer. Describe each piece of data once with `queryFrom` or `mutationFrom`, read it with `useQuery`, change it with `useMutation`. A mutation declares its cache effects, so every screen updates without manual refetching. Every source plugs into the same contract.

Runs in the browser and during server rendering. For values only the browser owns, use [state](/packages/state).

## Install

```sh
kitr add query
```

Adds `@kitr/query` and TanStack Query, its provider and `config/query.ts`. Every UI kit includes it. [Every change](/packages/query/guide#install).

## Quick start

A query has a **key**, its name in the cache, and a **fetch** function:

```ts
// app/features/orders/queries.ts
import { createKeys } from 'kitr/app'
import { queryFrom } from '@kitr/query'

export interface Order {
  id: string
  customer: string
  total: number
  status: 'open' | 'paid' | 'shipped'
}

export const orderKeys = createKeys('orders')

export const ordersQuery = queryFrom({
  key: () => orderKeys.list(),
  fetch: async (): Promise<Order[]> => [
    { id: 'ord_1', customer: 'Ada', total: 120, status: 'paid' },
    { id: 'ord_2', customer: 'Grace', total: 80, status: 'open' },
  ],
})
```

Then read it in a page:

```tsx
// app/pages/orders.tsx
import { useQuery } from '@kitr/query'
import { ordersQuery } from '#app/features/orders/queries'

export default function OrdersPage() {
  const { data: orders, isPending } = useQuery(ordersQuery.options())
  if (isPending) return <p>Loading orders…</p>
  return (
    <ul>
      {orders?.map((order) => (
        <li key={order.id}>
          {order.customer}: ${order.total} ({order.status})
        </li>
      ))}
    </ul>
  )
}
```

Open `/orders` and you see two lines. Come back within 30 seconds and the list shows at once, from the cache. `ordersQuery.options()` is ordinary TanStack `queryOptions`. Next in the guide: [Show your first query](/packages/query/guide#show-your-first-query).

## Built on

| What kitr adds | Why |
| --- | --- |
| `queryFrom`, `mutationFrom`, `subscriptionFrom` | One contract for every data source, with typed keys and inputs. |
| `CacheEffect` and `applyCacheEffect` | A mutation declares what it changed (`set`, `invalidate`, `remove`) and the cache applies it. |
| `createQueryClient` | TanStack Query's client with kitr's defaults, error handling and server-rendering wiring. |
| `KitrError` | One error type from every source, with codes and field errors forms understand. |
| A registry | `useQuery('orders.list')` by name, typed from the sources you defined. |

kitr adds `queryFrom`, `mutationFrom`, cache effects, the key helpers and one error shape.

## Problems it solves

- **Refetching by hand after a save.** [Refresh what a mutation changed](/packages/query/guide#refresh-what-a-mutation-changed).
- **Data that arrives after the page.** [Load data before the page renders](/packages/query/guide#load-data-before-the-page-renders).
- **Slow saves that feel slow.** [Update the screen before the server answers](/packages/query/guide#update-the-screen-before-the-server-answers).
- **Cache keys invented per call site.** [Name cache entries with keys](/packages/query/guide#name-cache-entries-with-keys).
- **Live updates that bypass the cache.** [Subscribe to live updates](/packages/query/guide#subscribe-to-live-updates).
- **Errors handled differently per source.** [Handle errors](/packages/query/guide#handle-errors).

## Further reading

- [Guide](/packages/query/guide).
- [API reference](/packages/query/api).
- [TanStack Query docs](https://tanstack.com/query/latest/docs/framework/react/overview).
- [HTTP](/packages/http), [Actions](/packages/actions), [API](/packages/api) and [Realtime](/packages/realtime).
- [Loading and saving data](/docs/data).
