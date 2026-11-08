---
title: Add live updates
description: Push changes from the server to every open screen over typed channels, so lists and details update without a reload.
packages: realtime, query, api, server, seo, testing
platforms: web, server
time: 30 min
---

# Add live updates

Ada ships an order in the warehouse. Grace has the orders board open in the office, and it still says "open". She reloads, or worse, she doesn't. Live updates fix that: the server tells every open screen what changed, and each screen updates itself.

In kitr, a live update is a **channel event that carries cache effects**. The channel is defined once and imported by the server and the browser. The server emits an event; each subscribed browser validates it and applies its effects to the [Query](/packages/query) cache, exactly as if the browser had run the mutation itself. Components that read the data re-render. None of them know a socket exists.

This guide adds live updates to an app with [API routes](/packages/api). It works the same with [server actions](/packages/actions): emit from the handler instead of the controller.

## Before you start

You need a kitr app with a server and a web platform. The `fullstack` kit has everything, including Realtime:

```sh
kitr new acme-orders --kit fullstack
```

In an existing app, add it. It adds [Server](/packages/server) first if the project has none:

```sh
kitr add realtime
```

What `kitr add realtime` sets up:

| File | What it is |
| --- | --- |
| `config/realtime.ts` | The transport (`websocket`) and the path (`/api/ws`) |
| `server/routes.ts` | Gains `realtime` from `kitr/realtime/routes` and a `.ws('/api/ws', { channels })` link |
| `app/realtime.ts` | `realtime()`: one connection per browser tab, opened on first use |
| `app/channels/example.ts` | A sample channel to copy |

The guide also assumes an orders API: a `GET /api/orders` the board reads through a query with the key `['orders', 'list']`, and a `POST /api/orders/:id/ship` that marks an order shipped. The [full-stack guide](/guides/fullstack-app) builds one.

## Define the channel

A channel has a name, the params a subscriber picks, and the events the server can send. Each event has a schema for its payload and the effects it has on the cache:

```ts
// app/channels/orders.ts
import { defineChannel } from 'kitr/realtime'
import { z } from 'zod'

export const orderSchema = z.object({
  id: z.string(),
  customer: z.string(),
  total: z.number(),
  status: z.enum(['open', 'paid', 'shipped']),
})
export type Order = z.infer<typeof orderSchema>

export const ordersChannel = defineChannel({
  name: 'orders',
  params: z.object({ teamId: z.string() }),
  events: {
    shipped: {
      schema: orderSchema,
      effects: (order) => ({
        set: [{ key: ['orders', 'detail', order.id], data: order }],
        invalidate: [['orders', 'list']],
      }),
    },
    deleted: {
      schema: z.object({ id: z.string() }),
      effects: ({ id }) => ({
        remove: [['orders', 'detail', id]],
        invalidate: [['orders', 'list']],
      }),
    },
  },
})
```

The effects are the same three a mutation uses:

| Effect | What it does | Use it when |
| --- | --- | --- |
| `set` | Writes the payload into the cache entry, with no request | The event carries the full record |
| `invalidate` | Marks entries stale; the ones on screen refetch | The event only says something changed, or many lists are affected |
| `remove` | Drops the entries | The record is gone |

Prefer `invalidate` when the payload would have to be filtered per user. A refetch goes through your normal query, so permission checks stay on the server where they belong.

## Serve it

Add the channel to the socket link on the server route table:

```ts
// server/routes.ts
import { defineRoutes } from 'kitr/app'
import api from 'kitr/api/routes'
import realtime from 'kitr/realtime/routes'
import { ordersChannel } from '#app/channels/orders'
// ...controllers

export const routes = defineRoutes([api, realtime], (router) =>
  router.group('/api', (r) =>
    r
      // ...endpoints as before
      .ws('/ws', { channels: [ordersChannel] }),
  ),
)
```

`server/main.ts` already serves the table, and binds the socket server as `realtime` in the app container:

```ts
// server/main.ts
import { createServer } from 'kitr/server'
import { config } from '../config'
import rc from '../kitrrc'
import { routes } from './routes'

export const server = createServer({ providers: rc.providers, config, routes })
// ...listen() when run directly
```

## Emit when an order ships

`app.container.use('realtime')` is the socket server; `.use(channel, params)` is the topic for one team, and `emit` sends to every connection subscribed to it. `app` is on every `HttpContext`:

```ts
// server/controllers/orders_controller.ts
import type { HttpContext } from 'kitr/api'
import { KitrError } from 'kitr/app'
import { type Order, ordersChannel } from '#app/channels/orders'

const orders = new Map<string, Order>([
  ['ord_1042', { id: 'ord_1042', customer: 'Ada', total: 129, status: 'paid' }],
])

export default class OrdersController {
  async ship({ app, params }: HttpContext<{ id: string }>) {
    const order = orders.get(params.id)
    if (!order) throw KitrError.notFound('Order')
    const shipped: Order = { ...order, status: 'shipped' }
    orders.set(shipped.id, shipped)
    // ... save it with your database
    app.container.use('realtime').use(ordersChannel, { teamId: 'team_acme' }).emit('shipped', shipped)
    return shipped
  }
}
```

Emit after the write succeeds, with data you built from your own records. The server does not validate what you pass to `emit`; the schema protects clients from a malformed event, not the server from sending one.

The same call works in a server action, a scheduled task or a webhook handler: anything on the server that can reach the app, for example `server.app.container.use('realtime')` after importing `server` from `#server/main`.

## Subscribe on the board

`useChannel(transport, channel, params)` subscribes when the component mounts, applies each event's effects, and unsubscribes when it unmounts:

```tsx
// app/features/orders/live-orders.tsx
import { useChannel } from 'kitr/realtime/react'
import { ordersChannel } from '#app/channels/orders'
import { realtime } from '#app/realtime'

export function LiveOrders({ teamId }: { teamId: string }) {
  const live = useChannel(realtime(), ordersChannel, { teamId }, {
    onEvent: (event) => {
      if (event.event === 'shipped') console.info(`${event.data.customer}'s order shipped`)
    },
  })
  return <small aria-live="polite">{live.status === 'open' ? 'Live' : 'Connecting…'}</small>
}
```

Render `<LiveOrders teamId="team_acme" />` on the orders page. The socket only exists in the browser, so the page either renders on the client or mounts this component after hydration. With server rendering, opt the page out with `ssrRoute(false)` from [SEO](/packages/seo):

```ts
// app/routes.ts
import { ssrRoute } from 'kitr/seo'
import { ordersQuery } from '#app/features/orders/queries'

r.page('/orders', {
  ...ssrRoute(false),
  loader: ({ context }) => context.queryClient.ensureQueryData(ordersQuery.options()),
  lazy: () => import('./pages/orders'),
})
```

```tsx
// app/pages/orders.tsx
import { useSuspenseQuery } from 'kitr/query'
import { LiveOrders } from '#app/features/orders/live-orders'
import { ordersQuery } from '#app/features/orders/queries'

export default function OrdersBoard() {
  const { data: orders } = useSuspenseQuery(ordersQuery.options())
  return (
    <main>
      <h1>
        Orders <LiveOrders teamId="team_acme" />
      </h1>
      <ul>
        {orders.map((order) => (
          <li key={order.id}>
            {order.customer}: {order.status}
          </li>
        ))}
      </ul>
    </main>
  )
}
```

Open `/orders` in two windows, then ship an order from a third:

```sh
curl -X POST http://localhost:3000/api/orders/ord_1042/ship
```

Both windows change "Ada: paid" to "Ada: shipped" within a moment. The server sent one `shipped` event to the `orders` topic for `team_acme`; each browser validated the payload against `orderSchema`, wrote the order into `['orders', 'detail', 'ord_1042']` and refetched `['orders', 'list']`.

`useChannel` returns `{ status, lastEvent, error }`. `status` is `'idle'`, `'open'` or `'error'`; `lastEvent` is typed as the union of the channel's events.

## Show whether the connection is up

`useChannel` reports the subscription. `useRealtimeStatus` reports the socket, which is what a "reconnecting" banner needs:

```tsx
// app/components/connection-badge.tsx
import { useRealtimeStatus } from 'kitr/realtime/react'
import { realtime } from '#app/realtime'

export function ConnectionBadge() {
  const status = useRealtimeStatus(realtime())
  // => 'connecting' | 'open' | 'closed'
  return status === 'open' ? null : <p role="status">Reconnecting…</p>
}
```

The client reconnects by itself with backoff and resubscribes everything. Events sent while a laptop was asleep are not replayed, so make sure the data catches up: the query refetches when the window regains focus, and you can invalidate the list when the status returns to `'open'`.

## Let only the team listen

Anyone who can open a WebSocket to your server could subscribe to any team's orders. Two checks close that. The server's `authorize(request)` runs once per connection and returns who is connected; returning `false` or throwing refuses the upgrade with `401`:

```ts
// server/routes.ts
// ...
import { KitrError } from 'kitr/app'
import { userFromSession } from '#server/sessions'

export const routes = defineRoutes([api, realtime], (router) =>
  router.group('/api', (r) =>
    r
      // ...endpoints as before
      .ws('/ws', {
        channels: [ordersChannel],
        authorize: async (request) => {
          const cookie = request.headers.get('cookie') ?? ''
          const session = cookie.match(/(?:^|;\s*)acme_session=([^;]+)/)?.[1]
          const user = session ? await userFromSession(session) : null
          if (!user) throw KitrError.unauthorized()
          return { user }
        },
      }),
  ),
)
```

`userFromSession` is your own lookup, the same one your API uses. Browsers send same-site cookies with the WebSocket upgrade, so no client code changes. For bearer tokens, put the token in the socket URL instead; the [Realtime guide](/packages/realtime#authenticate-connections) shows the client side.

Then the channel's `authorize(params, ctx)` decides who may subscribe to which topic. `ctx` is what the server's `authorize` returned:

```ts
// app/channels/orders.ts
import { defineChannel } from 'kitr/realtime'
import { z } from 'zod'

// ...orderSchema as before

type Ctx = { user: { id: string; teamIds: string[] } }

export const ordersChannel = defineChannel({
  name: 'orders',
  params: z.object({ teamId: z.string() }),
  authorize: ({ teamId }, ctx) => (ctx as Ctx).user.teamIds.includes(teamId),
  events: {
    // ...shipped and deleted as before
  },
})
```

When Linus, who is not on `team_acme`, subscribes to it, his `useChannel` returns `error: { code: 'FORBIDDEN', message: 'Not allowed on channel "orders"', status: 403 }` and he receives nothing. `authorize` runs on the server only; the browser bundle imports the same file but never calls it.

## Pick a transport

Channels, effects, `useChannel` and `emit` are the same on every transport. What changes is `config/realtime.ts` and the socket link in `server/routes.ts`:

| `transport` | Use it when |
| --- | --- |
| `websocket` | The default: two-way and low latency, on Node, Bun, Deno and Cloudflare. |
| `sse` | A proxy or host does not allow WebSocket upgrades. Events stream over one long `GET`. |
| `socket.io` | You already run Socket.IO or need its rooms and adapters. |

Switching to SSE:

```ts
// config/realtime.ts
import { defineConfig } from 'kitr/realtime'

export default defineConfig({
  transport: 'sse',
  path: '/api/events',
})
```

```ts
// server/routes.ts
// ...
      .sse('/events', { channels: [ordersChannel], keepAlive: 15_000 }),
```

`.sse()` replaces `.ws()` on the table and serves `/api/events` over plain HTTP. `app/realtime.ts` reads the transport from the config and needs no change.

> **Warning**
> By default each server instance keeps its subscriptions in memory. Behind a load balancer, an emit on one instance only reaches clients connected to that instance, and the others silently miss events. Before you run a second instance, pass a Redis adapter to the socket link: `.ws('/ws', { channels: [ordersChannel], adapter: createRedisRealtimeAdapter(redis) })`. [Run on more than one instance](/guides/scale-out) walks through it.

## Test the channel

The effects are plain functions, so the most useful test needs no socket at all:

```ts
// app/channels/orders.test.ts
import { channel, type SocketTransport } from 'kitr/realtime'
import { expect, it } from 'vitest'
import { ordersChannel } from './orders'

it('writes the shipped order into the cache and refetches lists', () => {
  const idle = { subscribe: () => () => {} } as unknown as SocketTransport
  const effects = channel(idle, ordersChannel).subscription().effects!
  const order = { id: 'ord_1042', customer: 'Ada', total: 129, status: 'shipped' as const }

  expect(effects({ event: 'shipped', data: order }, { teamId: 'team_acme' })).toEqual({
    set: [{ key: ['orders', 'detail', 'ord_1042'], data: order }],
    invalidate: [['orders', 'list']],
  })
})
```

To test authorization and delivery end to end, start the realtime server on a free port and subscribe with the real client; the [Realtime guide](/packages/realtime#testing) has the complete test.

## Next steps

- [Realtime](/packages/realtime): sending events from the client, Socket.IO rooms, custom transports and every option.
- [Query](/packages/query): the effects `set`, `invalidate` and `remove`, and optimistic updates.
- [Add sign-in, end to end](/guides/authentication): the session the realtime server's `authorize` reads.
- [Deploy to production](/guides/deploy): WebSocket upgrades behind proxies and load balancers.
