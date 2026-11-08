---
title: Query
description: Load data from your API, keep it cached, and refresh it when something changes.
order: 1
---

# Query

Most screens show data that lives on a server: Acme's list of orders, one invoice, the projects a team owns. `kitr/query` loads that data, keeps a cached copy so going back to a page is instant, and refreshes it when it changes, whether because you saved something, another tab did, or a live update arrived.

It is [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview), re-exported unchanged, plus a small **data contract**: you describe each piece of data once with `queryFrom`, `mutationFrom` and `subscriptionFrom`, and every source (a REST API, your own API routes, server actions, realtime channels) plugs into it the same way. Every failure from every source arrives as one error type, `KitrError`.

It runs in the browser, and on the server while a page renders. For values only the browser owns, such as a cart or a sidebar toggle, use [State](/packages/state) instead.

This guide follows Acme's order screen from the first query to live updates and tests.

## When to use it

Use queries for **server data**: anything a server owns and the browser only displays or changes. Orders, invoices, the signed-in user's profile and a team's projects are all server data. The cache knows when they are stale and refetches them for you.

Use [State](/packages/state) for **client state**: values that exist only in the browser, such as a half-filled cart, a selected tab or a theme choice. Copying server data into a store means you now own keeping it fresh, which is the job this package already does.

## Install

```sh
kitr add query
```

What `kitr add` does:

- Installs `@kitr/query` and `@tanstack/react-query`, and `@tanstack/react-query-devtools` as a dev dependency.
- Adds `'@kitr/query'` to `packages` and `() => import('@kitr/query/provider')` to `providers` in `kitrrc.ts`.
- Writes `config/query.ts` (shown under [Configure](#configure)).
- Adds a `## kitr: query` section to `AGENTS.md` with four rules: import from `kitr/query`, keep each feature's queries in `app/features/<name>/queries.ts`, load data in route loaders with `ensureQueryData`, and declare cache `effects` on mutations instead of calling `invalidateQueries` in components.

`kitr add query` asks no questions. Every UI kit includes it: `blank` adds it directly, and every kit with [HTTP](/packages/http) gets it because `http` requires `query`. To see the changes without writing them, run it with `--dry-run`:

```sh
kitr add query --dry-run
```

`kitr remove query` reverses every step above and deletes `config/query.ts`. It then lists the files that still import `kitr/query`, which you remove by hand.

## Configure

`kitr add query` writes this file:

```ts
// config/query.ts
import { defineConfig } from 'kitr/query'

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

`kitr/query` adds no environment variables.

The provider reads this file at boot, builds the client with `createQueryClient(config)`, binds it in the container as `queryClient`, wraps the React tree in `QueryClientProvider` and hands the same client to the router as `context.queryClient`.

To change the defaults for every query, for example to stop refetching when the window regains focus, pass TanStack's own options:

```ts
// config/query.ts
import { defineConfig } from 'kitr/query'

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
import { defineConfig, QueryClient } from 'kitr/query'

export default defineConfig({
  createClient: () =>
    new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, retry: 1 } } }),
})
```

## Show your first query

A query needs two things: a **key**, its name in the cache, and a **fetch** function that loads it. Put both in the feature's `queries.ts`. This one returns fixed data so it runs in a fresh `kitr new` project; the next sections swap in real sources.

```ts
// app/features/orders/queries.ts
import { createKeys } from 'kitr/app'
import { queryFrom } from 'kitr/query'

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
import { useQuery } from 'kitr/query'
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

Open `/orders` and you see two lines, `Ada: $120 (paid)` and `Grace: $80 (open)`. Leave the page and come back within 30 seconds: the list shows at once, with no loading state, because it comes from the cache.

`ordersQuery.options()` returns ordinary TanStack [`queryOptions`](https://tanstack.com/query/latest/docs/framework/react/reference/queryOptions). Anything that takes query options takes it: `useQuery`, `useSuspenseQuery`, `useQueries`, `queryClient.fetchQuery`, `prefetchQuery` and `ensureQueryData`.

## Name cache entries with keys

A key is an array that names a piece of data in the cache. Two calls with equal keys share one cache entry and one request. `createKeys` from `kitr/app` builds keys in one shape for each resource, so every part of the app agrees on what to refresh:

```ts
// app/features/orders/keys.ts
import { createKeys } from 'kitr/app'

export const orderKeys = createKeys('orders')

orderKeys.all // => ['orders']
orderKeys.lists() // => ['orders', 'list']
orderKeys.list() // => ['orders', 'list']
orderKeys.list({ status: 'open' }) // => ['orders', 'list', { status: 'open' }]
orderKeys.details() // => ['orders', 'detail']
orderKeys.detail('ord_1') // => ['orders', 'detail', 'ord_1']
orderKeys.custom('by-customer', 'ada') // => ['orders', 'by-customer', 'ada']
```

Invalidating a key also invalidates every key that starts with it. `orderKeys.lists()` covers every filtered list; `orderKeys.all` covers everything about orders. `keyMatches(prefix, key)` from `kitr/app` applies the same rule, if you need it in your own code:

```ts
import { keyMatches } from 'kitr/app'

keyMatches(['orders', 'list'], ['orders', 'list', { status: 'open' }]) // => true
keyMatches(['orders', 'detail'], ['orders', 'list']) // => false
```

A key must include every input that changes the result. A list filtered by status and page needs both in its key, or two different pages end up in one cache entry.

## Pass input to a query

The first argument of `key` and `fetch` is the query's input. Type it once on `key`, and `options(input)`, `key(input)` and `fetch(input)` all expect it:

```ts
// app/features/orders/queries.ts
import { createKeys } from 'kitr/app'
import { queryFrom } from 'kitr/query'
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

`fetch` receives a `signal`. Pass it on: when a component unmounts or the key changes mid-flight, TanStack aborts the request.

You rarely write `fetch` by hand. Each data source package produces the contract for you, and you pass it straight to `queryFrom`:

| Source | Package | Contract |
| --- | --- | --- |
| An existing REST API | [HTTP](/packages/http) | `queryFrom(httpQuery(http, { path: 'orders', key: () => orderKeys.list() }))` |
| Your own API routes | [API](/packages/api) | `queryFrom(api.orders.index.query())` |
| A server action | [Actions](/packages/actions) | Nothing to wrap: `defineQuery('orders.list', …)` registers a named query, used as `useQuery('orders.list')` |
| A realtime channel | [Realtime](/packages/realtime) | `useChannel(realtime(), orderChannel, params)` |

Components never learn which source they read from. Swap a REST endpoint for a server action and no component changes.

## Read data in a component

`useQuery` returns `data` as `undefined` until the first load finishes, plus flags for every state. It is the hook to use when the component draws its own loading and error states:

```tsx
// app/features/orders/order-summary.tsx
import { useQuery } from 'kitr/query'
import { orderQuery } from './queries'

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

`useSuspenseQuery` returns `data` that is always defined. The component suspends until the data arrives, and the nearest `<Suspense>` boundary shows the fallback. A route's `pendingComponent` acts as that boundary:

```tsx
// app/features/orders/order-list.tsx
import { useSuspenseQuery } from 'kitr/query'
import { ordersQuery } from './queries'

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

Errors thrown by a suspense query go to the nearest error boundary, such as the route's `errorComponent`.

`options()` returns a plain object, so you can spread it and add any TanStack option for one call site. Here only the count of open orders is selected, and the component re-renders only when that number changes:

```tsx
// app/features/orders/open-count.tsx
import { useQuery } from 'kitr/query'
import { ordersQuery } from './queries'

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

Start the request in the route's loader so the data arrives with the page instead of after it. The router gives every loader `context.queryClient`, the same client the components read from:

```ts
// app/routes.ts
import { orderQuery } from '#app/features/orders/queries'

r.page('/orders/$orderId', {
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(orderQuery.options(params.orderId)),
  lazy: () => import('./pages/orders/orderId'),
})
```

```tsx
// app/pages/orders/orderId.tsx
import { useSuspenseQuery } from 'kitr/query'
import { orderQuery } from '#app/features/orders/queries'
import { getRouteApi } from 'kitr/router'

const route = getRouteApi('/orders/$orderId')

export default function OrderPage() {
  const { orderId } = route.useParams()
  const { data: order } = useSuspenseQuery(orderQuery.options(orderId))
  return <h1>Order {order.id} for {order.customer}</h1>
}
```

`ensureQueryData` returns cached data when there is some and fetches otherwise. With server rendering, the server runs the loader, renders with the data and sends it along with the HTML, so the browser does not fetch it again.

Don't `await` data the page can live without. Start it with `prefetchQuery` and let the component suspend on it, so the page renders without waiting:

```ts
// app/routes.ts
import { ordersQuery } from '#app/features/orders/queries'
import { OrderList } from '#app/features/orders/order-list'
import { OpenOrderCount } from '#app/features/orders/open-count'

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

The kitr router preloads a route's loader when the pointer rests on a link to it, so most pages open with their data already in the cache.

## Change data with a mutation

A mutation changes something on the server: pay an invoice, rename a project, ship an order. Define it next to the queries, then run it in a component with `useMutation`:

```ts
// app/features/orders/queries.ts
import { mutationFrom } from 'kitr/query'
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
// app/features/orders/ship-button.tsx
import { useMutation } from 'kitr/query'
import { shipOrder } from './queries'

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

`useMutation` returns TanStack's [`useMutation`](https://tanstack.com/query/latest/docs/framework/react/reference/useMutation) result: `mutate`, `mutateAsync`, `isPending`, `error`, `data` and `reset`. Pass any `useMutation` option except `mutationFn` as the second argument. Your `onSuccess` runs after the mutation's own cache effects, so the cache is already updated when it runs:

```tsx
// app/features/orders/use-ship-and-return.ts
import { useNavigate } from '@tanstack/react-router'
import { useMutation } from 'kitr/query'
import { shipOrder } from './queries'

export function useShipAndReturn() {
  const navigate = useNavigate()
  return useMutation(shipOrder, {
    onSuccess: (order) => navigate({ to: '/orders/$orderId', params: { orderId: order.id } }),
    onError: (error) => console.warn('Ship failed', error.message),
  })
}
```

## Refresh what a mutation changed

After a save, every screen showing the changed data must update. Instead of telling each component to refetch, the mutation declares its **effects** on the cache, and `useMutation` applies them when the mutation succeeds:

```ts
// app/features/orders/queries.ts
import { mutationFrom } from 'kitr/query'
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

They run in that order: `set`, then `remove`, then `invalidate`. The mutation's `onSuccess` waits for the invalidated queries to refetch, so `ship.isPending` stays `true` until the lists on screen have refetched.

`effects` is either a function of the result and the input, as above, or a plain object when the effects never depend on the result:

```ts
// app/features/invoices/queries.ts
import { createKeys } from 'kitr/app'
import { mutationFrom } from 'kitr/query'

export const invoiceKeys = createKeys('invoices')

export const deleteInvoice = mutationFrom({
  mutate: async (id: string) => {
    await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
  },
  effects: { invalidate: [invoiceKeys.lists()], remove: [invoiceKeys.details()] },
})
```

Don't call `queryClient.invalidateQueries` in the component after `mutate`. The next component that runs the same mutation forgets to, and its screen shows stale data. Declare the effect on the mutation once.

`effectsFor(result, input)` returns the effects a result would produce, which helps when you test them:

```ts
import { shipOrder } from '#app/features/orders/queries'

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

Shipping an order also changes the customer's open invoice. `mergeEffects` from `kitr/app` joins several effects into one, concatenating each list:

```ts
// app/features/orders/queries.ts
import { mergeEffects } from 'kitr/app'
import { mutationFrom } from 'kitr/query'
import { invoiceKeys } from '#app/features/invoices/queries'
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

`mergeEffects` skips `undefined`, so a helper that returns no effect for some inputs can sit in the list.

## Update the cache outside a mutation

Sometimes the change comes from somewhere that is not a mutation: a message from a service worker, a `postMessage` from another window, a test. `applyCacheEffect` applies the same effect shape to any client, and `invalidate` marks several keys stale in one call:

```ts
// app/features/orders/sync.ts
import { app } from '#app/app'
import { applyCacheEffect, invalidate } from 'kitr/query'
import { invoiceKeys } from '#app/features/invoices/queries'
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

In a component, read the client with TanStack's `useQueryClient()` instead of the container. For anything not covered by effects, the client is TanStack's own [`QueryClient`](https://tanstack.com/query/latest/docs/reference/QueryClient): `setQueryData`, `getQueryData`, `cancelQueries` and the rest all work.

## Update the screen before the server answers

For an optimistic update, write the expected value before the request, and roll back if it fails. Pass TanStack's `onMutate` and `onError` through `useMutation`; the mutation's own effects still run on success:

```tsx
// app/features/orders/use-mark-paid.ts
import { mutationFrom, useMutation, useQueryClient } from 'kitr/query'
import { orderKeys } from './keys'
import type { Order } from './types'

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

[Server actions](/packages/actions) register every `defineQuery('orders.list', ...)` and `defineMutation('orders.ship', ...)` under its name, and `kitr types` writes those names into `.kitr/actions.ts` so they are typed. Every hook in `kitr/query` then takes the name as its first argument, the input as the second, and TanStack overrides as the third:

```tsx
// app/components/open-orders.tsx
import { queryOptions, useMutation, useQuery, useSuspenseQuery } from 'kitr/query'

export function OpenOrders() {
  const { data } = useQuery('orders.list', { status: 'open' }, { refetchInterval: 10_000 })
  const { data: orders } = useSuspenseQuery('orders.list', { status: 'open' })
  const ship = useMutation('orders.ship', { onSuccess: () => toast('Shipped') })
  return <ul>{orders.map((o) => <li key={o.id}>{o.customer}</li>)}</ul>
}

// In a loader, which has no React context: pass the app first.
const options = queryOptions(context.app, 'orders.list', { status: 'open' })
```

The hooks look the name up in the registry of the app in React context (`useApp().operations`), so two apps, or two tests, never share operations; `queryOptions` and `call` run outside React and take the app as their first argument. The input is optional when every field of it is optional. A name that is not registered, or a mutation name given to `useQuery`, is a type error; at run time the hook throws `[kitr/query] "orders.lsit" is not registered` with the names that are.

`useMutation(name)` works the same way as `useMutation(definition)`: both apply the mutation's cache effects, then your own `onSuccess`. Outside React, `call` runs an operation by name. A query fetches, a mutation mutates; in the browser it is a request, on the server the handler runs in-process:

```ts
import { call } from 'kitr/query'

const open = await call(app, 'orders.list', { status: 'open' })
// => [{ id: 'ord_2', customer: 'Grace', total: 80, status: 'open' }]
await call(app, 'orders.ship', { id: 'ord_2', carrier: 'UPS' })
```

Every hook also accepts the imported definition in place of the name, `useQuery(listOrders, input)`, and plain TanStack options as before. The three forms produce the same query options, so a component and a loader using different forms share one cache entry.

## Call a source without the cache

`fetch(input, signal?)` on a query and `mutate(input)` on a mutation call the source directly. They skip the cache, skip effects and do not normalise errors to `KitrError`. Use them in scripts, server code or a test of the source itself:

```ts
// scripts/print-open-orders.ts
import { ordersQuery, shipOrder } from '#app/features/orders/queries'

const open = await ordersQuery.fetch({ status: 'open', page: 1 })
// => [{ id: 'ord_2', customer: 'Grace', total: 80, status: 'open' }]

await shipOrder.mutate({ id: 'ord_2', carrier: 'UPS' })
// The cache is untouched: no effects ran.
```

`key(input)` returns the cache key, and `contract` holds the full contract with its `kind` and `source` (`'http'`, `'api'`, `'action'`, `'socket'`, or `undefined` for a hand-written one).

## Subscribe to live updates

A subscription is a stream of events whose effects land in the same cache that `useQuery` reads. When Linus ships an order in his browser, the order page Ada has open updates without a refetch.

Define it with the input and event types, a `key`, a `subscribe` function that returns an unsubscribe function, and `effects` that map each event to cache changes:

```ts
// app/features/orders/subscriptions.ts
import { subscriptionFrom } from 'kitr/query'
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

Then subscribe from the component that needs it. The hook subscribes on mount, unsubscribes on unmount and resubscribes only when the input's key changes:

```tsx
// app/features/orders/live-orders.tsx
import { useSubscription } from 'kitr/query'
import { OrderList } from './order-list'
import { orderEvents } from './subscriptions'

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

The hook returns `{ status, lastEvent, error }`. `status` is `'idle'` before subscribing and after unmount, `'open'` while subscribed, and `'error'` after the source calls `error`. You rarely write `subscribe` by hand: [Realtime](/packages/realtime) channels produce the same shape from a channel definition, with WebSocket, Socket.IO or SSE underneath.

## Handle errors

Every failure from `options()` and `useMutation`, whatever its source, reaches you as a `KitrError` from `kitr/app` with a `code`, `status`, `message` and, for validation failures, `fieldErrors`:

```tsx
// app/features/orders/order-error.tsx
import { isKitrError } from 'kitr/app'

export function OrderError({ error }: { error: Error }) {
  if (isKitrError(error) && error.code === 'NOT_FOUND') return <p>This order no longer exists.</p>
  if (isKitrError(error) && error.code === 'FORBIDDEN') return <p>Ask Grace for access to this team.</p>
  return <p role="alert">{error.message}</p>
}
```

A thrown wire shape such as `{ code: 'CONFLICT', message: 'Order already shipped', status: 409 }` becomes a `KitrError` with that code. A `TypeError` whose message mentions fetch (Chrome's `Failed to fetch`) becomes `NETWORK` with status `0`, and an `AbortError` becomes `TIMEOUT`. Anything else becomes `INTERNAL` with the original message.

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

Queries retry only failures that might pass on a second try. A 4xx means the request itself is wrong, so it fails at once and the user sees the error without a wait. Mutations are not retried. [Forms](/packages/forms) puts a `VALIDATION` error's `fieldErrors` under the right inputs, so a `mutateAsync` inside a form's `onSubmit` needs no error code of its own.

## Tune caching per query

`staleTime` on the contract overrides the config default for one query. Use a long one for data that rarely changes and `0` for data that must always be fresh:

```ts
// app/features/teams/queries.ts
import { createKeys } from 'kitr/app'
import { queryFrom } from 'kitr/query'

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

`teamsQuery.options()` now carries `staleTime: 600000`. A query without its own `staleTime` uses the config value. For one call site, spread the options and override them:

```tsx
// app/features/teams/team-picker.tsx
import { useQuery } from 'kitr/query'
import { teamsQuery } from './queries'

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

On the server, every request gets its own `QueryClient`. The provider binds `queryClient` as a scoped binding, so each forked app that renders a request builds a fresh cache, and one customer's orders can never render into another customer's page. In the browser there is one app, so there is one client for the whole session.

Nothing in your code changes for this. Read the client through `context.queryClient` in loaders and `useQueryClient()` in components, and you always get the one for the current request. Don't import `app` and call `app.container.use('queryClient')` from code that runs during a server render: it reads the root app's client, not the request's.

## Testing

In a test, boot an app with the query provider, seed the cache with the data the component needs, and render inside the app's providers. `createTestApp` from `kitr/testing` boots the app; `renderWithKitr` from `kitr/testing/react` renders inside `KitrProvider` and takes `queryData` as `[key, data]` pairs. Seeded data is fresh for 30 seconds, so the component reads it without calling `fetch`:

```tsx
// app/features/orders/orders.test.tsx
import { act, renderHook, screen } from '@testing-library/react'
import { createKeys } from 'kitr/app'
import {
  mutationFrom,
  queryFrom,
  queryProvider,
  useMutation,
  useSuspenseQuery,
} from 'kitr/query'
import { KitrProvider } from 'kitr/react'
import { createTestApp } from 'kitr/testing'
import { renderWithKitr } from 'kitr/testing/react'
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

To test effects without React, call `effectsFor` and apply the result to a bare client. No provider is needed:

```ts
// app/features/orders/effects.test.ts
import { applyCacheEffect, QueryClient } from 'kitr/query'
import { expect, it } from 'vitest'
import { orderKeys } from './keys'
import { shipOrder } from './queries'

it('shipping replaces the order and refreshes lists', async () => {
  const queryClient = new QueryClient()
  queryClient.setQueryData(orderKeys.list({ status: 'open' }), [{ id: 'ord_2' }])
  const shipped = { id: 'ord_2', customer: 'Grace', total: 80, status: 'shipped' as const }

  await applyCacheEffect(queryClient, shipOrder.effectsFor(shipped, { id: 'ord_2', carrier: 'UPS' }))

  expect(queryClient.getQueryData(orderKeys.detail('ord_2'))).toEqual(shipped)
  expect(queryClient.getQueryState(orderKeys.list({ status: 'open' }))?.isInvalidated).toBe(true)
})
```

To fake the network itself rather than the query, use [Mocks](/packages/mocks): its handlers answer `fetch` in tests and in the browser, so the query runs end to end.

## Extend

Every data source is a function that returns a contract. To add a source kitr does not ship, such as a GraphQL endpoint or a vendor SDK, write one function per kind and pass its result to `queryFrom`, `mutationFrom` or `subscriptionFrom`. The types are `QueryContract`, `MutationContract` and `SubscriptionContract` from `kitr/app` (see the [API reference](/packages/query/api)):

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
import { KitrError, type QueryContract, type QueryKey } from 'kitr/app'

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
// app/features/projects/queries.ts
import { createKeys } from 'kitr/app'
import { queryFrom } from 'kitr/query'
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

Throw a `KitrError` (or anything with `code`, `message` and `status`) so components and forms see the same shape as every other source. Whatever you throw is normalised anyway, so a plain `Error` still arrives as `INTERNAL`.

## Devtools

With [Devtools](/packages/devtools) installed, the provider adds a **Query** panel in development. Its badge shows how many queries are fetching (`2↻`) or, when idle, how many are cached. The panel lists every cached query, newest first, with its key, a status badge (`fetching`, `error`, `stale` or `fresh`), its observer count and how long ago it updated. Select a row to see its data or error, and to invalidate, refetch or remove that one entry. Two panel actions apply to the whole cache: **Invalidate all queries** and **Clear cache**.

Failed mutations are logged to the Log panel under `query` as `mutation failed: <mutationKey>` with the error attached.

## Next steps

- [API reference](/packages/query/api)
- [TanStack Query docs](https://tanstack.com/query/latest/docs/framework/react/overview): everything there works as written, imported from `kitr/query`.
- [HTTP](/packages/http): turn REST endpoints into queries and mutations.
- [Realtime](/packages/realtime): live channels whose events update the cache.
- [Loading and saving data](/docs/data): how every kitr data source shares one contract.
