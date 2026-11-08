---
title: Query
description: Load data from your API, keep it cached, and refresh it when something changes.
order: 1
---

# Query

Most screens show data that lives on a server: Acme's list of orders, one invoice, the projects a team owns. `@kitr/query` loads that data, keeps a cached copy so going back to a page is instant, and refreshes it when it changes, whether because you saved something, another tab did, or a live update arrived.

> [!SUMMARY]
> Loads server data, caches it and refreshes it when something changes. Add it with `kitr add query`; the overview is at [/packages/query](/packages/query).

It is [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview), re-exported unchanged, plus a small **data contract**: describe each piece of data once with `queryFrom`, `mutationFrom` and `subscriptionFrom`, and every source (REST, API routes, server actions, realtime) plugs in the same way. Every failure arrives as one error type, `KitrError`.

It runs in the browser, and on the server while a page renders.

This guide follows Acme's order screen from the first query to live updates and tests.

## When to use it

Use queries for **server data**: anything a server owns and the browser only displays or changes, such as orders, invoices or a team's projects. The cache knows when it is stale and refetches it.

Use [State](/packages/state) for **client state** that exists only in the browser, such as a half-filled cart or a theme choice. Copying server data into a store means you own keeping it fresh.

## Install

```sh
kitr add query
```

<details>
<summary>Everything kitr add changes</summary>

What `kitr add` does:

- Installs `@kitr/query` and `@tanstack/react-query`, and `@tanstack/react-query-devtools` as a dev dependency.
- Adds `'@kitr/query'` to `packages` and `() => import('@kitr/query/provider')` to `providers` in `kitrrc.ts`.
- Writes `config/query.ts` (shown under [Configure](#configure)).
- Adds a `## kitr: query` section to `AGENTS.md` with four rules: import from `@kitr/query`, keep each feature's queries in `app/queries/<name>.ts`, load data in route loaders with `ensureQueryData`, and declare cache `effects` on mutations instead of calling `invalidateQueries` in components.

</details>

Every UI kit includes it. To see the changes without writing them, run it with `--dry-run`:

```sh
kitr add query --dry-run
```

<details>
<summary>What kitr remove does</summary>

`kitr remove query` reverses every step above and deletes `config/query.ts`. It then lists the files that still import `@kitr/query`, which you remove by hand.

</details>

## Configure

`kitr add query` writes this file:

```ts
// config/query.ts
import { defineConfig } from '@kitr/query'

export default defineConfig({
  // Navigating back within 30s never refetches.
  staleTime: 30_000,
})
```

| Option | Default | Description |
| --- | --- | --- |
| `staleTime` | `30_000` | How long data counts as fresh, in milliseconds. Fresh data is served from the cache without a request. |
| `defaultOptions` | `{}` | Passed to `new QueryClient({ defaultOptions })`. Keys under `defaultOptions.queries` win over `staleTime` and the retry rule. |
| `defaultOptions.queries.retry` | no retry on 4xx, two retries otherwise | When a failed query retries. kitr's rule reads `error.status`: a status from 400 to 499 never retries; anything else retries up to twice. |
| `createClient` | | A function that returns your own `QueryClient`. When set, every other option is ignored. |

The provider builds the client from this file, binds it as `queryClient`, wraps the React tree in `QueryClientProvider` and gives the router the same client as `context.queryClient`. To change the defaults for every query, such as refetching on window focus, pass TanStack's own options:

```ts
// config/query.ts
import { defineConfig } from '@kitr/query'

export default defineConfig({
  staleTime: 60_000,
  defaultOptions: {
    queries: { refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
})
```

To build the client yourself, for example to share one with code outside kitr, return it from `createClient`:

```ts
// config/query.ts
import { defineConfig, QueryClient } from '@kitr/query'

export default defineConfig({
  createClient: () =>
    new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, retry: 1 } } }),
})
```

## Show your first query

A query needs two things: a **key**, its name in the cache, and a **fetch** function that loads it. Put both in the feature's `queries.ts`. This one returns fixed data so it runs in a fresh `kitr new` project; the next sections swap in real sources.

```ts
// app/queries/orders.ts
import { createKeys } from '@kitr/kitr/app'
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

```ts
// app/routes.ts
r.page('/orders', { lazy: () => import('./pages/orders') })
```

```tsx
// app/pages/orders.tsx
import { useQuery } from '@kitr/query'
import { ordersQuery } from '#app/queries/orders'

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

Open `/orders` and you see `Ada: $120 (paid)` and `Grace: $80 (open)`. Leave and come back within 30 seconds: the list shows at once, from the cache.

`ordersQuery.options()` returns ordinary TanStack [`queryOptions`](https://tanstack.com/query/latest/docs/framework/react/reference/queryOptions), accepted by `useQuery`, `useSuspenseQuery`, `prefetchQuery`, `ensureQueryData` and the rest.

## Name cache entries with keys

A key is an array that names a piece of data in the cache; equal keys share one entry and one request. `createKeys` from `@kitr/kitr/app` builds keys in one shape per resource:

```ts
// app/lib/orders/keys.ts
import { createKeys } from '@kitr/kitr/app'

export const orderKeys = createKeys('orders')

orderKeys.all // => ['orders']
orderKeys.lists() // => ['orders', 'list']
orderKeys.list() // => ['orders', 'list']
orderKeys.list({ status: 'open' }) // => ['orders', 'list', { status: 'open' }]
orderKeys.details() // => ['orders', 'detail']
orderKeys.detail('ord_1') // => ['orders', 'detail', 'ord_1']
orderKeys.custom('by-customer', 'ada') // => ['orders', 'by-customer', 'ada']
```

Invalidating a key also invalidates every key that starts with it: `orderKeys.lists()` covers every filtered list, `orderKeys.all` everything about orders. `keyMatches(prefix, key)` from `@kitr/kitr/app` applies the same rule in your own code:

```ts
import { keyMatches } from '@kitr/kitr/app'

keyMatches(['orders', 'list'], ['orders', 'list', { status: 'open' }]) // => true
keyMatches(['orders', 'detail'], ['orders', 'list']) // => false
```

> [!WARNING] Keys need every input
> A list filtered by status and page needs both in its key, or two pages share one cache entry.

## Pass input to a query

The first argument of `key` and `fetch` is the query's input. Type it once on `key` and `options(input)`, `key(input)` and `fetch(input)` all expect it:

```ts
// app/queries/orders.ts
import { createKeys } from '@kitr/kitr/app'
import { queryFrom } from '@kitr/query'
import type { Order } from './types'

export const orderKeys = createKeys('orders')

export const orderQuery = queryFrom({
  key: (id: string) => orderKeys.detail(id),
  fetch: async (id, { signal }) => {
    const res = await fetch(`/api/orders/${id}`, { signal })
    return (await res.json()) as Order
  },
})

export const ordersQuery = queryFrom({
  key: (filters: { status?: Order['status']; page: number }) => orderKeys.list(filters),
  fetch: async (filters, { signal }) => {
    const params = new URLSearchParams({ page: String(filters.page) })
    if (filters.status) params.set('status', filters.status)
    const res = await fetch(`/api/orders?${params}`, { signal })
    return (await res.json()) as Order[]
  },
})
```

`fetch` receives a `signal`; pass it on so TanStack can abort the request. You rarely write `fetch` by hand: each source package produces the contract, and you pass it to `queryFrom`:

| Source | Package | Contract |
| --- | --- | --- |
| An existing REST API | [HTTP](/packages/http) | `queryFrom(httpQuery(http, { path: 'orders', key: () => orderKeys.list() }))` |
| Your own API routes | [API](/packages/api) | `queryFrom(api.orders.index.query())` |
| A server action | [Actions](/packages/actions) | Nothing to wrap: `defineQuery('orders.list', …)` registers a named query, used as `useQuery('orders.list')` |
| A realtime channel | [Realtime](/packages/realtime) | `useChannel(realtime(), orderChannel, params)` |

Components never learn which source they read from, so swapping a REST endpoint for a server action changes no component.

## Read data in a component

`useQuery` returns `data` as `undefined` until the first load finishes, plus flags for every state. Use it when the component draws its own loading and error states:

```tsx
// app/components/orders/order-summary.tsx
import { useQuery } from '@kitr/query'
import { orderQuery } from '#app/queries/orders'

export function OrderSummary({ id }: { id: string }) {
  const { data: order, isPending, isError, error, isFetching } = useQuery(orderQuery.options(id))
  if (isPending) return <p>Loading…</p>
  if (isError) return <p role="alert">{error.message}</p>
  return (
    <p>
      {order.customer} owes ${order.total} {isFetching ? '(refreshing)' : null}
    </p>
  )
}
```

`useSuspenseQuery` returns `data` that is always defined; the component suspends and the nearest `<Suspense>` boundary (or the route's `pendingComponent`) shows the fallback:

```tsx
// app/components/orders/order-list.tsx
import { useSuspenseQuery } from '@kitr/query'
import { ordersQuery } from '#app/queries/orders'

export function OrderList({ page }: { page: number }) {
  const { data: orders } = useSuspenseQuery(ordersQuery.options({ page }))
  return (
    <ul>
      {orders.map((order) => (
        <li key={order.id}>{order.customer}</li>
      ))}
    </ul>
  )
}
```

Errors go to the nearest error boundary, such as the route's `errorComponent`. Spread `options()` to add any TanStack option for one call site; here only the count of open orders is selected:

```tsx
// app/components/orders/open-count.tsx
import { useQuery } from '@kitr/query'
import { ordersQuery } from '#app/queries/orders'

export function OpenOrderCount() {
  const { data: count } = useQuery({
    ...ordersQuery.options({ status: 'open', page: 1 }),
    select: (orders) => orders.length,
    refetchInterval: 60_000,
  })
  return <span>{count ?? 0} open</span>
}
```

## Load data before the page renders

Start the request in the route's loader so the data arrives with the page. Every loader gets `context.queryClient`, the client components read from:

```ts
// app/routes.ts
import { orderQuery } from '#app/queries/orders'

r.page('/orders/$orderId', {
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(orderQuery.options(params.orderId)),
  lazy: () => import('./pages/orders/orderId'),
})
```

```tsx
// app/pages/orders/orderId.tsx
import { useSuspenseQuery } from '@kitr/query'
import { orderQuery } from '#app/queries/orders'
import { getRouteApi } from '@kitr/router'

const route = getRouteApi('/orders/$orderId')

export default function OrderPage() {
  const { orderId } = route.useParams()
  const { data: order } = useSuspenseQuery(orderQuery.options(orderId))
  return <h1>Order {order.id} for {order.customer}</h1>
}
```

`ensureQueryData` returns cached data when there is some and fetches otherwise. With server rendering, the data travels with the HTML, so the browser does not fetch it again.

Don't `await` data the page can live without: start it with `prefetchQuery` and let the component suspend on it:

```ts
// app/routes.ts
import { ordersQuery } from '#app/queries/orders'
import { OrderList } from '#app/components/orders/order-list'
import { OpenOrderCount } from '#app/components/orders/open-count'

r.page('/orders/', {
  loader: async ({ context }) => {
    // Needed for the first paint: wait for it.
    await context.queryClient.ensureQueryData(ordersQuery.options({ page: 1 }))
    // Nice to have: start it, don't wait.
    void context.queryClient.prefetchQuery(ordersQuery.options({ status: 'open', page: 1 }))
  },
    <>
      <OpenOrderCount />
      <OrderList page={1} />
    </>
  ),
  lazy: () => import('./pages/orders/index'),
})
```

```tsx
// app/pages/orders/index.tsx
export default () => (
```



## Change data with a mutation

A mutation changes something on the server: pay an invoice, rename a project, ship an order. Define it next to the queries, then run it in a component with `useMutation`:

```ts
// app/queries/orders.ts
import { mutationFrom } from '@kitr/query'
import type { Order } from './types'

export const shipOrder = mutationFrom({
  mutate: async (input: { id: string; carrier: string }) => {
    const res = await fetch(`/api/orders/${input.id}/ship`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ carrier: input.carrier }),
    })
    return (await res.json()) as Order
  },
})
```

```tsx
// app/components/orders/ship-button.tsx
import { useMutation } from '@kitr/query'
import { shipOrder } from '#app/queries/orders'

export function ShipButton({ id }: { id: string }) {
  const ship = useMutation(shipOrder)
  return (
    <>
      <button
        type="button"
        disabled={ship.isPending}
        onClick={() => ship.mutate({ id, carrier: 'UPS' })}
      >
        {ship.isPending ? 'Shipping…' : 'Ship order'}
      </button>
      {ship.error ? <p role="alert">{ship.error.message}</p> : null}
    </>
  )
}
```

`useMutation` returns TanStack's [`useMutation`](https://tanstack.com/query/latest/docs/framework/react/reference/useMutation) result (`mutate`, `mutateAsync`, `isPending`, `error`, `data`, `reset`). Pass any option except `mutationFn` as the second argument; your `onSuccess` runs after the mutation's cache effects:

```tsx
// app/hooks/orders/use-ship-and-return.ts
import { useNavigate } from '@tanstack/react-router'
import { useMutation } from '@kitr/query'
import { shipOrder } from '#app/queries/orders'

export function useShipAndReturn() {
  const navigate = useNavigate()
  return useMutation(shipOrder, {
    onSuccess: (order) => navigate({ to: '/orders/$orderId', params: { orderId: order.id } }),
    onError: (error) => console.warn('Ship failed', error.message),
  })
}
```

## Refresh what a mutation changed

After a save, every screen showing the changed data must update. The mutation declares its **effects** on the cache, and `useMutation` applies them on success:

```ts
// app/queries/orders.ts
import { mutationFrom } from '@kitr/query'
import { orderKeys } from './keys'
import type { Order } from './types'

export const shipOrder = mutationFrom({
  mutate: async (input: { id: string; carrier: string }) => {
    const res = await fetch(`/api/orders/${input.id}/ship`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ carrier: input.carrier }),
    })
    return (await res.json()) as Order
  },
  effects: (order, input) => ({
    set: [{ key: orderKeys.detail(input.id), data: order }],
    invalidate: [orderKeys.lists()],
  }),
})
```

| Effect | What it does | Use it when |
| --- | --- | --- |
| `set` | Writes `data` into the entry at `key` with no request. | The server returned the new value. |
| `invalidate` | Marks every entry starting with the key as stale. Entries on screen refetch now; the rest refetch next time they are used. | You don't have the new value, or many entries changed (every filtered list). |
| `remove` | Drops the entries from the cache. The next read fetches from scratch. | The thing was deleted. |

They run in that order: `set`, `remove`, `invalidate`. `ship.isPending` stays `true` until the invalidated lists on screen have refetched. `effects` is a function of the result and input, or a plain object when they never depend on the result:

```ts
// app/queries/invoices.ts
import { createKeys } from '@kitr/kitr/app'
import { mutationFrom } from '@kitr/query'

export const invoiceKeys = createKeys('invoices')

export const deleteInvoice = mutationFrom({
  mutate: async (id: string) => {
    await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
  },
  effects: { invalidate: [invoiceKeys.lists()], remove: [invoiceKeys.details()] },
})
```

> [!WARNING]
> Don't call `queryClient.invalidateQueries` in the component after `mutate`. The next component that runs the mutation forgets to. Declare the effect on the mutation once.

`effectsFor(result, input)` returns the effects a result would produce, for tests:

```ts
import { shipOrder } from '#app/queries/orders'

shipOrder.effectsFor(
  { id: 'ord_2', customer: 'Grace', total: 80, status: 'shipped' },
  { id: 'ord_2', carrier: 'UPS' },
)
// => {
//   set: [{ key: ['orders', 'detail', 'ord_2'], data: { id: 'ord_2', customer: 'Grace', total: 80, status: 'shipped' } }],
//   invalidate: [['orders', 'list']],
// }
```

## Combine effects from several resources

Shipping an order also changes the customer's open invoice. `mergeEffects` from `@kitr/kitr/app` joins effects, concatenating each list (it skips `undefined`):

```ts
// app/queries/orders.ts
import { mergeEffects } from '@kitr/kitr/app'
import { mutationFrom } from '@kitr/query'
import { invoiceKeys } from '#app/queries/invoices'
import { orderKeys } from './keys'
import type { Order } from './types'

export const shipOrder = mutationFrom({
  mutate: async (input: { id: string; carrier: string }) => {
    const res = await fetch(`/api/orders/${input.id}/ship`, { method: 'POST' })
    return (await res.json()) as Order
  },
  effects: (order) =>
    mergeEffects(
      { set: [{ key: orderKeys.detail(order.id), data: order }] },
      { invalidate: [orderKeys.lists()] },
      { invalidate: [invoiceKeys.lists()] },
    ),
})
// effects for ord_2 => { set: [...], invalidate: [['orders', 'list'], ['invoices', 'list']] }
```



## Update the cache outside a mutation

When the change does not come from a mutation (a service worker message, a `postMessage`, a test), `applyCacheEffect` applies the same effect shape to any client, and `invalidate` marks several keys stale in one call:

```ts
// app/lib/orders/sync.ts
import { app } from '#app/app'
import { applyCacheEffect, invalidate } from '@kitr/query'
import { invoiceKeys } from '#app/queries/invoices'
import { orderKeys } from './keys'

const queryClient = app.container.use('queryClient')

export async function onOrderPaidElsewhere(orderId: string) {
  await applyCacheEffect(queryClient, {
    remove: [orderKeys.detail(orderId)],
    invalidate: [orderKeys.lists()],
  })
}

export function refreshBilling() {
  return invalidate(queryClient, orderKeys.all, invoiceKeys.all)
}
```

In a component, read the client with `useQueryClient()`. It is TanStack's own [`QueryClient`](https://tanstack.com/query/latest/docs/reference/QueryClient), so `setQueryData`, `getQueryData` and the rest work.

## Update the screen before the server answers

For an optimistic update, write the expected value before the request and roll back on failure, with TanStack's `onMutate` and `onError`; the mutation's effects still run on success:

```tsx
// app/hooks/orders/use-mark-paid.ts
import { mutationFrom, useMutation, useQueryClient } from '@kitr/query'
import { orderKeys } from '#app/lib/orders/keys'
import type { Order } from '#app/lib/orders/types'

export const markPaid = mutationFrom({
  mutate: async (id: string) => {
    const res = await fetch(`/api/orders/${id}/pay`, { method: 'POST' })
    return (await res.json()) as Order
  },
  effects: (order) => ({
    set: [{ key: orderKeys.detail(order.id), data: order }],
    invalidate: [orderKeys.lists()],
  }),
})

export function useMarkPaid(id: string) {
  const queryClient = useQueryClient()
  const key = orderKeys.detail(id)
  return useMutation(markPaid, {
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Order>(key)
      if (previous) queryClient.setQueryData<Order>(key, { ...previous, status: 'paid' })
      return { previous }
    },
    onError: (_error, _input, snapshot) => {
      // `snapshot` is what onMutate returned.
      const previous = (snapshot as { previous?: Order } | undefined)?.previous
      if (previous) queryClient.setQueryData(key, previous)
    },
  })
}
```

## Use a query or mutation by name

[Server actions](/packages/actions) register every `defineQuery('orders.list', ...)` and `defineMutation('orders.ship', ...)` under its name, and `kitr types` types those names. Every hook then takes the name first, the input second and TanStack overrides third:

```tsx
// app/components/open-orders.tsx
import { queryOptions, useMutation, useQuery, useSuspenseQuery } from '@kitr/query'

export function OpenOrders() {
  const { data } = useQuery('orders.list', { status: 'open' }, { refetchInterval: 10_000 })
  const { data: orders } = useSuspenseQuery('orders.list', { status: 'open' })
  const ship = useMutation('orders.ship', { onSuccess: () => toast('Shipped') })
  return <ul>{orders.map((o) => <li key={o.id}>{o.customer}</li>)}</ul>
}

// In a loader, which has no React context: pass the app first.
const options = queryOptions(context.app, 'orders.list', { status: 'open' })
```

A misspelled name is a type error, and at run time throws `[@kitr/query] "orders.lsit" is not registered`. Outside React, `call` runs an operation by name: a request in the browser, an in-process handler call on the server:

```ts
import { call } from '@kitr/query'

const open = await call(app, 'orders.list', { status: 'open' })
// => [{ id: 'ord_2', customer: 'Grace', total: 80, status: 'open' }]
await call(app, 'orders.ship', { id: 'ord_2', carrier: 'UPS' })
```

Every hook also accepts the imported definition (`useQuery(listOrders, input)`) or plain TanStack options; all three forms share one cache entry.

## Call a source without the cache

`fetch(input, signal?)` on a query and `mutate(input)` on a mutation call the source directly, skipping the cache, effects and `KitrError` normalisation. Use them in scripts, server code or source tests:

```ts
// scripts/print-open-orders.ts
import { ordersQuery, shipOrder } from '#app/queries/orders'

const open = await ordersQuery.fetch({ status: 'open', page: 1 })
// => [{ id: 'ord_2', customer: 'Grace', total: 80, status: 'open' }]

await shipOrder.mutate({ id: 'ord_2', carrier: 'UPS' })
// The cache is untouched: no effects ran.
```



## Subscribe to live updates

A subscription is a stream of events whose effects land in the cache `useQuery` reads: when Linus ships an order, the page Ada has open updates without a refetch. Define it with the input and event types, a `key`, a `subscribe` function that returns an unsubscribe function, and `effects` per event:

```ts
// app/lib/orders/subscriptions.ts
import { subscriptionFrom } from '@kitr/query'
import { orderKeys } from './keys'
import type { Order } from './types'

type OrderEvent = { type: 'updated'; order: Order } | { type: 'deleted'; id: string }

export const orderEvents = subscriptionFrom<string, OrderEvent>({
  key: (teamId) => ['order-events', teamId],
  subscribe: (teamId, { next, error }) => {
    const source = new EventSource(`/api/teams/${teamId}/order-events`)
    source.onmessage = (message) => next(JSON.parse(message.data))
    source.onerror = () => error?.({ code: 'NETWORK', message: 'Order feed lost', status: 0 })
    return () => source.close()
  },
  effects: (event) =>
    event.type === 'updated'
      ? { set: [{ key: orderKeys.detail(event.order.id), data: event.order }], invalidate: [orderKeys.lists()] }
      : { remove: [orderKeys.detail(event.id)], invalidate: [orderKeys.lists()] },
})
```

Subscribe from the component that needs it. The hook subscribes on mount, unsubscribes on unmount and resubscribes only when the input's key changes:

```tsx
// app/components/orders/live-orders.tsx
import { useSubscription } from '@kitr/query'
import { OrderList } from './order-list'
import { orderEvents } from '#app/lib/orders/subscriptions'

export function LiveOrders({ teamId }: { teamId: string }) {
  const live = useSubscription(orderEvents, teamId, {
    onEvent: (event) => console.info('order event', event.type),
    onError: (error) => console.warn(error.code, error.message),
  })
  return (
    <>
      <p>{live.status === 'open' ? 'Live' : live.status === 'error' ? 'Offline' : 'Paused'}</p>
      <OrderList page={1} />
    </>
  )
}
```

| Option | Default | Description |
| --- | --- | --- |
| `enabled` | `true` | Set `false` to not subscribe, for example until the user opens the panel. |
| `onEvent` | | Called with every event, after it is stored as `lastEvent`. |
| `onError` | | Called with a `KitrErrorShape` when the source reports an error. |

The hook returns `{ status, lastEvent, error }`, where `status` is `'idle'`, `'open'` or `'error'`. [Realtime](/packages/realtime) channels produce the same shape, so you rarely write `subscribe` by hand.

## Handle errors

Every failure from `options()` and `useMutation`, whatever its source, reaches you as a `KitrError` from `@kitr/kitr/app` with a `code`, `status`, `message` and, for validation failures, `fieldErrors`:

```tsx
// app/components/orders/order-error.tsx
import { isKitrError } from '@kitr/kitr/app'

export function OrderError({ error }: { error: Error }) {
  if (isKitrError(error) && error.code === 'NOT_FOUND') return <p>This order no longer exists.</p>
  if (isKitrError(error) && error.code === 'FORBIDDEN') return <p>Ask Grace for access to this team.</p>
  return <p role="alert">{error.message}</p>
}
```

A thrown shape such as `{ code: 'CONFLICT', message: 'Order already shipped', status: 409 }` becomes a `KitrError` with that code. A failed fetch becomes `NETWORK` (status `0`), an `AbortError` becomes `TIMEOUT`, and anything else becomes `INTERNAL`.

| Code | Status | Retried by queries |
| --- | --- | --- |
| `BAD_REQUEST` | 400 | no |
| `UNAUTHORIZED` | 401 | no |
| `FORBIDDEN` | 403 | no |
| `NOT_FOUND` | 404 | no |
| `TIMEOUT` | 408 | no |
| `CONFLICT` | 409 | no |
| `VALIDATION` | 422 | no |
| `RATE_LIMITED` | 429 | no |
| `INTERNAL` | 500 | twice |
| `UNAVAILABLE` | 503 | twice |
| `NETWORK` | 0 | twice |

Queries retry only failures that might pass on a second try; a 4xx fails at once. Mutations are not retried. [Forms](/packages/forms) puts a `VALIDATION` error's `fieldErrors` under the right inputs.

## Tune caching per query

`staleTime` on the contract overrides the config default for one query. Use a long one for data that rarely changes and `0` for data that must always be fresh:

```ts
// app/queries/teams.ts
import { createKeys } from '@kitr/kitr/app'
import { queryFrom } from '@kitr/query'

export const teamKeys = createKeys('teams')

export const teamsQuery = queryFrom({
  key: () => teamKeys.list(),
  fetch: async (_input, { signal }) => {
    const res = await fetch('/api/teams', { signal })
    return (await res.json()) as { id: string; name: string }[]
  },
  // Teams change rarely: serve them from the cache for ten minutes.
  staleTime: 10 * 60_000,
})
```

A query without its own `staleTime` uses the config value. For one call site, spread the options and override them:

```tsx
// app/components/teams/team-picker.tsx
import { useQuery } from '@kitr/query'
import { teamsQuery } from '#app/queries/teams'

export function TeamPicker() {
  // This screen edits teams, so it always wants the latest list.
  const { data: teams = [] } = useQuery({ ...teamsQuery.options(), staleTime: 0 })
  return (
    <select>
      {teams.map((team) => (
        <option key={team.id} value={team.id}>
          {team.name}
        </option>
      ))}
    </select>
  )
}
```

## Render on the server

On the server every request gets its own `QueryClient`, so one customer's orders never render into another's page. In the browser one client serves the session. Read it through `context.queryClient` in loaders and `useQueryClient()` in components and you always get the current request's.

> [!WARNING]
> Don't call `app.container.use('queryClient')` from code that runs during a server render. It reads the root app's client, so one visitor's cached data can reach another.

## Testing

In a test, seed the cache with the data the component needs. `createTestApp` from `@kitr/testing` boots the app; `renderWithKitr` from `@kitr/testing/react` renders inside `KitrProvider` and takes `queryData` as `[key, data]` pairs, fresh for 30 seconds, so `fetch` is not called:

```tsx
// app/components/orders/orders.test.tsx
import { act, renderHook, screen } from '@testing-library/react'
import { createKeys } from '@kitr/kitr/app'
import {
  mutationFrom,
  queryFrom,
  queryProvider,
  useMutation,
  useSuspenseQuery,
} from '@kitr/query'
import { KitrProvider } from '@kitr/react'
import { createTestApp } from '@kitr/testing'
import { renderWithKitr } from '@kitr/testing/react'
import { type ReactNode, Suspense } from 'react'
import { describe, expect, it, vi } from 'vitest'

interface Order {
  id: string
  customer: string
  status: 'open' | 'shipped'
}

const orderKeys = createKeys('orders')
const fetchOrders = vi.fn(async (): Promise<Order[]> => [])
const ordersQuery = queryFrom({ key: () => orderKeys.list(), fetch: fetchOrders })
const shipOrder = mutationFrom({
  mutate: async (id: string): Promise<Order> => ({ id, customer: 'Grace', status: 'shipped' }),
  effects: (order) => ({
    set: [{ key: orderKeys.detail(order.id), data: order }],
    invalidate: [orderKeys.lists()],
  }),
})

function OrderList() {
  const { data: orders } = useSuspenseQuery(ordersQuery.options())
  return (
    <ul>
      {orders.map((order) => (
        <li key={order.id}>{order.customer}</li>
      ))}
    </ul>
  )
}

describe('orders', () => {
  it('renders seeded orders without fetching', async () => {
    const app = await createTestApp({ providers: [queryProvider] })
    renderWithKitr(
      <Suspense fallback="Loading">
        <OrderList />
      </Suspense>,
      { app, queryData: [[orderKeys.list(), [{ id: 'ord_1', customer: 'Ada', status: 'open' }]]] },
    )
    expect(await screen.findByText('Ada')).toBeTruthy()
    expect(fetchOrders).not.toHaveBeenCalled()
  })

  it('shipping writes the order and marks every list stale', async () => {
    const app = await createTestApp({ providers: [queryProvider] })
    const queryClient = app.container.use('queryClient')
    queryClient.setQueryData(orderKeys.list(), [])
    const wrapper = ({ children }: { children: ReactNode }) => (
      <KitrProvider app={app}>{children}</KitrProvider>
    )
    const { result } = renderHook(() => useMutation(shipOrder), { wrapper })

    await act(() => result.current.mutateAsync('ord_2'))

    expect(queryClient.getQueryData(orderKeys.detail('ord_2'))).toEqual({
      id: 'ord_2',
      customer: 'Grace',
      status: 'shipped',
    })
    expect(queryClient.getQueryState(orderKeys.list())?.isInvalidated).toBe(true)
  })
})
```

The assertions you will write most:

| To check | Assert |
| --- | --- |
| A mutation wrote an entry | `queryClient.getQueryData(key)` equals the new value |
| A mutation marked entries stale | `queryClient.getQueryState(key)?.isInvalidated` is `true` |
| A mutation removed an entry | `queryClient.getQueryData(key)` is `undefined` |
| A component did not refetch | the `fetch` mock was not called |
| A failure reached the UI | `result.current.error` is a `KitrError` with the expected `code` |

To test effects without React, call `effectsFor` and apply the result to a bare client:

```ts
// app/lib/orders/effects.test.ts
import { applyCacheEffect, QueryClient } from '@kitr/query'
import { expect, it } from 'vitest'
import { orderKeys } from './keys'
import { shipOrder } from '#app/queries/orders'

it('shipping replaces the order and refreshes lists', async () => {
  const queryClient = new QueryClient()
  queryClient.setQueryData(orderKeys.list({ status: 'open' }), [{ id: 'ord_2' }])
  const shipped = { id: 'ord_2', customer: 'Grace', total: 80, status: 'shipped' as const }

  await applyCacheEffect(queryClient, shipOrder.effectsFor(shipped, { id: 'ord_2', carrier: 'UPS' }))

  expect(queryClient.getQueryData(orderKeys.detail('ord_2'))).toEqual(shipped)
  expect(queryClient.getQueryState(orderKeys.list({ status: 'open' }))?.isInvalidated).toBe(true)
})
```

To fake the network itself, use [Mocks](/packages/mocks).

## Extend

To add a source kitr does not ship, such as GraphQL or a vendor SDK, write one function per kind returning a `QueryContract`, `MutationContract` or `SubscriptionContract` (from `@kitr/kitr/app`, see the [API reference](/packages/query/api)) and pass it to `queryFrom`, `mutationFrom` or `subscriptionFrom`:

| Member | Kind | Description |
| --- | --- | --- |
| `key(input)` | query, subscription | The cache key. Include every input that changes the result. |
| `fetch(input, { signal })` | query | Load the data. Pass `signal` to the request so TanStack can cancel it. |
| `mutate(input)` | mutation | Make the change and return the result. |
| `subscribe(input, { next, error })` | subscription | Start the stream, call `next` per event, return a function that stops it. |
| `effects` | mutation, subscription | Cache effects after a success or per event. |
| `staleTime` | query | Freshness for this query, overriding the config. |
| `source` | all | A label for devtools, stored in TanStack's `meta.source`. |

This source turns a GraphQL operation into a query contract:

```ts
// app/lib/graphql.ts
import { KitrError, type QueryContract, type QueryKey } from '@kitr/kitr/app'

interface GraphqlQueryOptions<TInput> {
  document: string
  key: (input: TInput) => QueryKey
  variables?: (input: TInput) => Record<string, unknown>
  staleTime?: number
}

export function graphqlQuery<TInput = void, TOutput = unknown>(
  opts: GraphqlQueryOptions<TInput>,
): Omit<QueryContract<TInput, TOutput>, 'kind'> {
  return {
    source: 'graphql',
    key: opts.key,
    staleTime: opts.staleTime,
    fetch: async (input, { signal }) => {
      const res = await fetch('https://api.acme.com/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: opts.document, variables: opts.variables?.(input) }),
        signal,
      })
      if (!res.ok) throw KitrError.fromStatus(res.status)
      const body = (await res.json()) as { data?: TOutput; errors?: { message: string }[] }
      if (body.errors?.length) throw new KitrError('BAD_REQUEST', body.errors[0]!.message)
      return body.data as TOutput
    },
  }
}
```

```ts
// app/queries/projects.ts
import { createKeys } from '@kitr/kitr/app'
import { queryFrom } from '@kitr/query'
import { graphqlQuery } from '#app/lib/graphql'

export const projectKeys = createKeys('projects')

export const projectsQuery = queryFrom(
  graphqlQuery<{ teamId: string }, { projects: { id: string; name: string }[] }>({
    document: 'query ($teamId: ID!) { projects(teamId: $teamId) { id name } }',
    key: ({ teamId }) => projectKeys.list({ teamId }),
    variables: ({ teamId }) => ({ teamId }),
  }),
)
```

Throw a `KitrError` (or anything with `code`, `message` and `status`) so components see the same shape as every other source.

## Devtools

With [Devtools](/packages/devtools) installed, a **Query** panel lists every cached query: select one to see its data, invalidate, refetch or remove it. Failed mutations are logged under `query`.

## Next steps

- [API reference](/packages/query/api): every export and contract type.
- [HTTP](/packages/http): turn REST endpoints into queries and mutations.
- [Loading and saving data](/docs/data): how every data source shares one contract.
