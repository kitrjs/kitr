---
title: Actions
description: Call server code straight from a component, like a form submit, without writing an API route.
order: 1
---

# Actions

Plenty of buttons only need to run a bit of server code: cancel an order, rename a project, invite Linus to a team. Writing an API route, a client for it and the types on both ends is a lot of ceremony for that. An action is a function you define once and call from the browser as if it were local. kitr sends the request, checks the input on the server, and brings back either the result or a typed error.

Actions are [TanStack Start server functions](https://tanstack.com/start/latest/docs/framework/react/server-functions) with three things added: input validation with any [Standard Schema](https://standardschema.dev), kitr's one error shape (so a validation error lands on the right form field), and cache updates after success. The handler runs only on the server; the function you import runs on both sides. If anything other than your own React app needs to call the code, use [API routes](/packages/api) instead.

The examples follow one feature through the page: Ada, who runs support at Acme, cancels and lists customer orders in the dashboard at `app.acme.com`.

## When to use it

Use actions when the only caller is your own UI: forms, buttons, loaders. There are no URLs to design, no client to generate, and the types flow from the handler to the component.

Use [API routes](/packages/api) when a mobile app, a partner, a webhook or a CLI calls the same code, or when you want stable URLs and an OpenAPI document. Both produce the same `KitrError` shape and the same cache effects, so moving an action to a route later is a small change. Many apps use actions for the UI and a handful of API routes for integrations.

## Install

```sh
kitr add actions
```

What `kitr add` does:

- Adds [server](/packages/server) first if the project does not have it (which in turn adds [logger](/packages/logger)), because actions run on the server runtime.
- Installs `@kitr/actions`.
- Adds `@kitr/actions` to `packages` in `kitrrc.ts`.
- Writes an empty `app/actions/.gitkeep`, the folder where actions live.
- Adds a `## kitr: actions` section to `AGENTS.md`: generate actions with `kitr make:action <feature>/<name>`, call them directly or through `useKitrMutation(defineMutation(action.mutation()))`, and use `.query()` on GET actions for loaders.

It writes no config file, registers no provider, adds no env variables and asks no questions. The `fullstack` kit includes actions. In a server-only project `kitr add` skips actions with a warning, because they are called from React.

Actions run through TanStack Start. The `kitr()` Vite plugin turns Start on when `@kitr/server` is in `kitrrc.ts`, which `kitr add actions` makes sure of.

`kitr remove actions` takes `@kitr/actions` out of `kitrrc.ts`, uninstalls it and removes the `AGENTS.md` section. It leaves `app/actions/` and every action in it, then lists the files that still import `kitr/actions`.

## Configure

`kitr/actions` has no config file. Each action is configured where it is defined, with the second argument of `defineAction`:

```ts
// app/actions/orders/cancel_order.ts
import { defineAction, requireSession } from 'kitr/actions'
import { z } from 'zod'
import { withSession } from '#app/actions/middleware'

export const cancelOrder = defineAction('orders.cancelOrder', {
  method: 'POST',
  input: z.object({ id: z.string() }),
  middleware: [withSession, requireSession],
  effects: { invalidate: [['orders', 'list']] },
  handler: async ({ input, context, signal }) => {
    return { id: input.id, status: 'cancelled' as const }
  },
})
```

The first argument is the action's name. It must be unique in the app; it appears in the query key, in server logs and in devtools. `kitr make:action` uses `<feature>.<name>`.

| Option | Default | Description |
| --- | --- | --- |
| `method` | `'POST'` | `'POST'` for changes. `'GET'` for reads, which can be cached and prefetched as queries. |
| `input` | `undefined` | A Standard Schema (zod, valibot, arktype). The handler receives its output; invalid input is rejected with `VALIDATION` before the handler runs. Without it, the action takes no input. |
| `middleware` | `[]` | TanStack Start function middleware that runs before the handler, in order. |
| `effects` | `undefined` | What a mutation does to the query cache after success: an object, or `(result, input) => effect`. |
| `handler` | required | `({ input, context, signal }) => result`. Runs on the server. Its return value is sent to the caller. |

The handler's argument:

| Field | Description |
| --- | --- |
| `input` | The validated, transformed input. |
| `context` | What middleware passed to `next({ context })`, such as a session. Typed `{}` unless you say otherwise. |
| `signal` | An `AbortSignal` that fires when the caller aborts. |

## Write your first action

Generate the file:

```sh
kitr make:action orders/cancel-order
```

It writes `app/actions/orders/cancel_order.ts`. Replace the body with a real handler. This one uses an in-memory order store so it runs as is:

```ts
// server/orders.ts
export interface Order {
  id: string
  number: string
  customer: string
  total: number
  status: 'paid' | 'shipped' | 'cancelled'
  cancelReason?: string
}

const rows = new Map<string, Order>([
  ['ord_1', { id: 'ord_1', number: 'ACME-1042', customer: 'grace@acme.com', total: 120, status: 'paid' }],
  ['ord_2', { id: 'ord_2', number: 'ACME-1043', customer: 'linus@acme.com', total: 80, status: 'shipped' }],
])

export const orders = {
  list: async () => [...rows.values()],
  find: async (id: string) => rows.get(id),
  update: async (id: string, patch: Partial<Order>) => {
    const next = { ...rows.get(id)!, ...patch }
    rows.set(id, next)
    return next
  },
}
```

```ts
// app/actions/orders/cancel_order.ts
import { defineAction } from 'kitr/actions'
import { KitrError } from 'kitr/app'
import { z } from 'zod'
import { orders } from '#server/orders'

export const cancelOrderInput = z.object({
  id: z.string(),
  reason: z.string().min(3, 'Tell the customer why'),
})

export async function cancelOrderHandler({ input }: { input: z.output<typeof cancelOrderInput> }) {
  const order = await orders.find(input.id)
  if (!order) throw KitrError.notFound('Order')
  if (order.status === 'shipped') throw new KitrError('CONFLICT', 'Shipped orders cannot be cancelled')
  return orders.update(input.id, { status: 'cancelled', cancelReason: input.reason })
}

export const cancelOrder = defineAction('orders.cancelOrder', {
  input: cancelOrderInput,
  effects: (order) => ({
    set: [{ key: ['orders', 'detail', order.id], data: order }],
    invalidate: [['orders', 'list']],
  }),
  handler: cancelOrderHandler,
})
```

Call it from a button:

```tsx
// app/features/orders/cancel-order-button.tsx
import { defineMutation, useKitrMutation } from 'kitr/query'
import { cancelOrder } from '#app/actions/orders/cancel_order'

const cancelOrderMutation = defineMutation(cancelOrder.mutation())

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const cancel = useKitrMutation(cancelOrderMutation)
  return (
    <>
      <button
        type="button"
        disabled={cancel.isPending}
        onClick={() => cancel.mutate({ id: orderId, reason: 'Customer asked' })}
      >
        {cancel.isPending ? 'Cancelling…' : 'Cancel order'}
      </button>
      {cancel.error ? <p role="alert">{cancel.error.message}</p> : null}
    </>
  )
}
```

Render `<CancelOrderButton orderId="ord_1" />` on a page and click it. The browser sends one request to the server, the handler runs there, and `cancel.data` becomes:

```ts
{ id: 'ord_1', number: 'ACME-1042', customer: 'grace@acme.com', total: 120, status: 'cancelled', cancelReason: 'Customer asked' }
```

With `orderId="ord_2"` the button shows "Shipped orders cannot be cancelled" instead. The handler, `server/orders.ts` and everything they import stay out of the browser bundle; Start replaces the handler with a network call when it builds the client.

## Validate input

Pass a schema as `input`. On the server, kitr runs it before the handler. The handler receives the schema's output, so transforms and defaults apply:

```ts
// app/actions/orders/refund_order.ts
import { defineAction } from 'kitr/actions'
import { z } from 'zod'

export const refundOrder = defineAction('orders.refundOrder', {
  input: z.object({
    id: z.string(),
    amount: z.number().positive('Refund at least one cent'),
    note: z.string().trim(),
  }),
  handler: async ({ input }) => {
    // input.note has been trimmed
    return { id: input.id, refunded: input.amount, note: input.note }
  },
})
```

When the input fails, the handler does not run, and the caller gets a `KitrError`:

```ts
await refundOrder({ id: 'ord_1', amount: 0, note: '' })
// throws KitrError {
//   code: 'VALIDATION',
//   status: 422,
//   message: 'Validation failed',
//   fieldErrors: { amount: ['Refund at least one cent'] },
// }
```

`fieldErrors` keys are field paths (`'lines.0.quantity'` for nested data). That is the shape [forms](/packages/forms) puts under each field. Validate in the browser too, with the same schema, so most mistakes never reach the server; the server check is the one you can trust.

The argument's TypeScript type is the schema's *output* type, not its input type. A field with `.default()` is therefore required for callers, and `z.coerce.number()` asks for a number. Keep transforms that change a type in the browser's form schema, and give the action a schema whose input and output match.

An action without `input` takes no argument, and whatever the caller sends is passed through unchecked. Give every action that takes data a schema.

## Call an action from a component

`action.mutation()` returns a mutation contract. Wrap it with `defineMutation` once, at module level, and use it with `useKitrMutation` from [query](/packages/query):

```tsx
// app/features/orders/refund-button.tsx
import { defineMutation, useKitrMutation } from 'kitr/query'
import { refundOrder } from '#app/actions/orders/refund_order'

const refundOrderMutation = defineMutation(refundOrder.mutation())

export function RefundButton({ orderId, total }: { orderId: string; total: number }) {
  const refund = useKitrMutation(refundOrderMutation, {
    onSuccess: (result) => console.log(`Refunded ${result.refunded}`),
  })
  return (
    <button type="button" disabled={refund.isPending} onClick={() => refund.mutate({ id: orderId, amount: total, note: '' })}>
      Refund {total} USD
    </button>
  )
}
```

You get TanStack Query's mutation state (`isPending`, `error`, `data`, `reset`), errors as `KitrError`, and the action's `effects` applied to the cache after success. Your own `onSuccess` runs after the effects.

Don't call `queryClient.invalidateQueries` in the component after the action. Declare it once in `effects`, so every caller gets it. `kitr doctor` points out inline invalidation.

## Update the cache after success

`effects` says what changes in the query cache when the action succeeds. It is a `CacheEffect`, or a function of the result and the input that returns one:

```ts
// app/actions/orders/cancel_order.ts
import { defineAction } from 'kitr/actions'
import { createKeys } from 'kitr/app'
import { z } from 'zod'
import { orders } from '#server/orders'

export const orderKeys = createKeys('orders')

export const cancelOrder = defineAction('orders.cancelOrder', {
  input: z.object({ id: z.string(), reason: z.string().min(3) }),
  effects: (order, input) => ({
    set: [{ key: orderKeys.detail(input.id), data: order }],
    invalidate: [orderKeys.lists()],
    remove: [orderKeys.custom('pending-cancellations')],
  }),
  handler: async ({ input }) => orders.update(input.id, { status: 'cancelled', cancelReason: input.reason }),
})
```

| Field | What it does |
| --- | --- |
| `set` | Writes `data` under `key` directly, so the detail page shows the new order without a refetch. |
| `invalidate` | Marks every query whose key starts with one of these keys as stale; active ones refetch. |
| `remove` | Drops these entries from the cache. |

`createKeys('orders')` gives keys every source agrees on: `lists()` is `['orders', 'list']`, `detail('ord_1')` is `['orders', 'detail', 'ord_1']`. Effects run only through `useKitrMutation` or a mutation definition. Calling the action directly does not touch the cache.

## Submit a form to an action

Pass `mutateAsync` to `<Form onSubmit>` from [forms](/packages/forms). When the server rejects the input, each message appears under its field:

```tsx
// app/features/orders/cancel-order-form.tsx
import { FieldInput, Form, FormField, SubmitButton, useSchemaForm } from 'kitr/forms'
import { defineMutation, useKitrMutation } from 'kitr/query'
import { cancelOrder, cancelOrderInput } from '#app/actions/orders/cancel_order'

const cancelOrderMutation = defineMutation(cancelOrder.mutation())

export function CancelOrderForm({ orderId }: { orderId: string }) {
  const cancel = useKitrMutation(cancelOrderMutation)
  const form = useSchemaForm(cancelOrderInput, { defaultValues: { id: orderId, reason: '' } })
  return (
    <Form form={form} onSubmit={(values) => cancel.mutateAsync(values)}>
      <FormField name="reason" label="Reason">
        <FieldInput />
      </FormField>
      <SubmitButton pendingText="Cancelling…">Cancel order</SubmitButton>
    </Form>
  )
}
```

The form and the action share `cancelOrderInput`, so the browser shows "Tell the customer why" before sending, and the server enforces it again. A `CONFLICT` from the handler shows as the form's root error. Use `mutateAsync`; `mutate` does not reject, so `<Form>` would never see the error.

## Read data with a GET action

An action with `method: 'GET'` is a read. `action.query()` returns a query contract for `defineQuery`:

```ts
// app/actions/orders/list_orders.ts
import { defineAction } from 'kitr/actions'
import { defineQuery } from 'kitr/query'
import { z } from 'zod'
import { orders } from '#server/orders'

export const listOrders = defineAction('orders.listOrders', {
  method: 'GET',
  input: z.object({ status: z.enum(['paid', 'shipped', 'cancelled']).optional() }),
  handler: async ({ input }) => {
    const all = await orders.list()
    return input.status ? all.filter((order) => order.status === input.status) : all
  },
})

export const ordersQuery = defineQuery(listOrders.query())
```

```tsx
// app/features/orders/order-list.tsx
import { useQuery } from 'kitr/query'
import { ordersQuery } from '#app/actions/orders/list_orders'

export function OrderList() {
  const { data = [], isPending } = useQuery(ordersQuery.options({ status: 'paid' }))
  if (isPending) return <p>Loading orders…</p>
  return (
    <ul>
      {data.map((order) => (
        <li key={order.id}>
          {order.number} for {order.customer}
        </li>
      ))}
    </ul>
  )
}
```

The query key is `['action', name, input]`, or `['action', name]` without input:

```ts
listOrders.key({ status: 'paid' })
// => ['action', 'orders.listOrders', { status: 'paid' }]
```

To invalidate every cached call of this action from another action's effects, use the prefix `['action', 'orders.listOrders']`. To set a `staleTime`, spread the contract: `defineQuery({ ...listOrders.query(), staleTime: 30_000 })`.

## Load data in a route loader

A GET action's query works with the router's loader, so the page renders with data on the first paint and the server-rendered HTML already has it:

```tsx
// app/routes/orders/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from 'kitr/query'
import { ordersQuery } from '#app/actions/orders/list_orders'

export const Route = createFileRoute('/orders/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(ordersQuery.options({})),
  component: OrdersPage,
})

function OrdersPage() {
  const { data } = useSuspenseQuery(ordersQuery.options({}))
  return <p>{data.length} orders</p>
}
```

On the server, the loader calls the handler in the same process. In the browser, after navigation, it sends a GET request. Use the same input in the loader and the component, so they share one cache entry.

## Call an action directly

An action is an async function. Await it from anywhere that runs inside the app, such as an event handler or a loader:

```ts
// app/features/orders/bulk-cancel.ts
import { cancelOrder } from '#app/actions/orders/cancel_order'

export async function cancelAll(ids: string[]) {
  const results = await Promise.allSettled(ids.map((id) => cancelOrder({ id, reason: 'Fraud check' })))
  return results.map((r) => (r.status === 'fulfilled' ? r.value.status : r.reason.code))
}

// await cancelAll(['ord_1', 'ord_2', 'ord_9'])
// => ['cancelled', 'CONFLICT', 'NOT_FOUND']
```

It resolves with the handler's return value, or rejects with a `KitrError` carrying the code, message, status, `fieldErrors` and `data` the server produced. A direct call does not apply `effects`.

The input and the result cross the network, so keep them to data Start can serialize: plain objects, arrays, strings, numbers, booleans and `null`. Return an order, not a database connection or a class with methods.

## Cancel a slow action

Pass an `AbortSignal` as the second argument. The handler receives a signal too, and can hand it to anything that accepts one:

```ts
// app/actions/orders/export_orders.ts
import { defineAction } from 'kitr/actions'

export const exportOrders = defineAction('orders.exportOrders', {
  method: 'GET',
  handler: async ({ signal }) => {
    const res = await fetch('https://reports.acme.com/orders.csv', { signal })
    return res.text()
  },
})
```

```ts
const controller = new AbortController()
const csv = exportOrders(undefined, { signal: controller.signal })
controller.abort()
```

When the call comes from a query, TanStack Query passes its own signal, so leaving the page cancels the request.

## Return errors

Throw a `KitrError` from the handler and the caller receives the same code, message, status, `fieldErrors` and `data`:

```ts
// app/actions/orders/reassign_order.ts
import { defineAction } from 'kitr/actions'
import { KitrError } from 'kitr/app'
import { z } from 'zod'
import { orders } from '#server/orders'

export const reassignOrder = defineAction('orders.reassignOrder', {
  input: z.object({ id: z.string(), customer: z.email() }),
  handler: async ({ input }) => {
    const order = await orders.find(input.id)
    if (!order) throw KitrError.notFound('Order')
    if (order.customer === input.customer) {
      throw KitrError.validation({ customer: ['This order already belongs to that customer'] })
    }
    if (order.status !== 'paid') {
      throw new KitrError('CONFLICT', `Order ${order.number} is ${order.status}`, { data: { status: order.status } })
    }
    return orders.update(input.id, { customer: input.customer })
  },
})
```

| Throw | Caller gets |
| --- | --- |
| `KitrError.validation({ customer: ['...'] })` | `VALIDATION`, 422, with `fieldErrors` |
| `KitrError.notFound('Order')` | `NOT_FOUND`, 404, "Order not found" |
| `KitrError.unauthorized()` | `UNAUTHORIZED`, 401, "Authentication required" |
| `KitrError.forbidden()` | `FORBIDDEN`, 403, "Not allowed" |
| `new KitrError('CONFLICT', msg, { data })` | `CONFLICT`, 409, your message and data |
| An error with a numeric `status` or `statusCode` | The code for that status, with the error's message |
| Any other error | `INTERNAL`, 500 |

> **Warning**
> In production (`NODE_ENV=production`), any error with a status of 500 or more reaches the browser as "Internal server error" with no `data`, so a database message or a connection string never leaks. Errors below 500 keep their message and data in every environment, so never put secrets in a `KitrError` you throw on purpose.

Every error with a status of 500 or more is logged on the server, in every environment, as `[kitr/actions] orders.reassignOrder failed:` followed by the original error. Errors below 500 are expected outcomes and are not logged.

## Read the request

Inside a handler or middleware, read headers and cookies with Start's server helpers. They work only on the server, which is the only place a handler runs:

```ts
// app/actions/orders/track_view.ts
import { getCookie, getRequestHeader } from '@tanstack/react-start/server'
import { defineAction } from 'kitr/actions'
import { z } from 'zod'

export const trackOrderView = defineAction('orders.trackOrderView', {
  input: z.object({ id: z.string() }),
  handler: async ({ input }) => {
    const agent = getRequestHeader('user-agent')
    const session = getCookie('acme_session')
    return { id: input.id, agent, signedIn: Boolean(session) }
  },
})
```

Start's [server function docs](https://tanstack.com/start/latest/docs/framework/react/server-functions) list the other helpers, including setting response headers and cookies.

## Use the app's services

Handlers reach the app's container through the request. `useRequestApp(app)` from [server](/packages/server) returns the app for the current request, or `app` itself when there is none, and [db](/packages/db) reads the connection from it:

```ts
// app/actions/orders/list_orders.ts
import { defineAction } from 'kitr/actions'
import { useDb } from 'kitr/db'
import { useRequestApp } from 'kitr/server'
import { app } from '#app/app'
import type { AppDb } from '#config/db'

export const listOrders = defineAction('orders.listOrders', {
  method: 'GET',
  handler: async () => {
    const db = useDb<AppDb>(useRequestApp(app))
    return db.query.orders.findMany()
  },
})
```

The same pattern gives you the cache, the mailer and the job queue: `useRequestApp(app).container.use('jobs')`.

## Add middleware

Middleware runs before the handler and can pass values to it through `context`. Write it with `createMiddleware`, re-exported from `kitr/actions`:

```ts
// app/actions/middleware.ts
import { getCookie } from '@tanstack/react-start/server'
import { createMiddleware } from 'kitr/actions'
import { findSession } from '#server/sessions'

export const withSession = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const session = await findSession(getCookie('acme_session'))
  // => { user: { id: 'usr_ada', email: 'ada@acme.com' } } or null
  return next({ context: { session } })
})
```

`findSession` is your own lookup. `requireSession` is the guard kitr ships: it reads `context.session.user` and throws `UNAUTHORIZED` when there is none. List middleware in the order it runs:

```ts
// app/actions/orders/cancel_order.ts
import { defineAction, requireSession } from 'kitr/actions'
import { z } from 'zod'
import { withSession } from '#app/actions/middleware'
import { orders } from '#server/orders'

type Session = { user: { id: string; email: string } }

export const cancelOrder = defineAction('orders.cancelOrder', {
  input: z.object({ id: z.string(), reason: z.string().min(3) }),
  middleware: [withSession, requireSession],
  handler: async ({ input, context }) => {
    const { session } = context as { session: Session }
    return orders.update(input.id, { status: 'cancelled', cancelReason: `${input.reason} (by ${session.user.email})` })
  },
})
```

An anonymous caller gets `UNAUTHORIZED`, 401, "Authentication required", and the handler never runs. `defineAction` does not infer `context`'s type from the middleware, so cast it in the handler as above.

Middleware runs outside kitr's handler wrapper. An error it throws is serialized by Start itself, which keeps a `KitrError`'s `code`, `status` and `message`, so `useKitrMutation` still reports `UNAUTHORIZED`. A direct call from the browser may reject with a revived plain `Error` that carries the same fields, so check it with `isKitrError()` from `kitr/app` rather than `instanceof KitrError`. The production masking described in [Return errors](#return-errors) applies only to errors from the handler, so throw only `KitrError`s from middleware. Put checks that need the parsed input (such as "is Ada on this order's team?") in the handler, because middleware runs before validation.

## Use the raw server function

`action.serverFn` is the TanStack Start server function underneath, for `useServerFn` or for composing with other Start code. It never throws for handler errors; it resolves with an envelope:

```ts
// app/features/orders/raw-cancel.ts
import { cancelOrder } from '#app/actions/orders/cancel_order'

const envelope = await cancelOrder.serverFn({ data: { id: 'ord_2', reason: 'Customer asked' } })
// => { ok: false, error: { code: 'CONFLICT', message: 'Shipped orders cannot be cancelled', status: 409 } }
// or { ok: true, data: { id: 'ord_1', status: 'cancelled', ... } }
```

Calling the action itself unwraps this envelope for you and throws on `ok: false`, which is what you want almost everywhere. `createServerFn` is also re-exported from `kitr/actions`, so a plain Start server function uses the same import.

## Commands

| Command | What it does |
| --- | --- |
| `kitr make:action <feature>/<name>` | Writes `app/actions/<feature>/<name>.ts` (name in snake_case) with an input schema and `defineAction('<feature>.<name>', ...)`. Without a `/`, the feature is `app`. |
| `kitr eject stub action` | Copies the `make:action` template to `stubs/action.ts` so you can change what it generates. |

```sh
kitr make:action orders/cancel-order
```

writes:

```ts
// app/actions/orders/cancel_order.ts
import { defineAction } from 'kitr/actions'
import { z } from 'zod'

export const cancelOrderInput = z.object({
  id: z.string(),
})

export const cancelOrder = defineAction('orders.cancelOrder', {
  input: cancelOrderInput,
  // What the mutation does to the client cache after success.
  effects: (_result, input) => ({ invalidate: [['orders', 'list'], ['orders', 'detail', input.id]] }),
  handler: async ({ input }) => {
    // const db = useDb<AppDb>(useRequestApp())
    return { ok: true, id: input.id }
  },
})
```

`kitr doctor` warns when a file under `app/` imports `@tanstack/react-start` directly (import `createServerFn` and `createMiddleware` from `kitr/actions`), and notes files that call `queryClient.invalidateQueries` inline instead of declaring `effects`.

## Errors

Every failure reaches the caller as a `KitrError`.

| Code | When | What to do |
| --- | --- | --- |
| `VALIDATION` (422) | The input failed the `input` schema, or the handler threw `KitrError.validation`. | Show `fieldErrors` on the form; `<Form>` does it for you. |
| `UNAUTHORIZED` (401) | `requireSession` found no `context.session.user`, or the handler threw it. | Send the user to sign in. |
| `FORBIDDEN` (403) | The handler threw `KitrError.forbidden()`. | Hide the control from users who cannot use it. |
| `NOT_FOUND` (404) | The handler threw `KitrError.notFound()`. | Refresh the list; the record is gone. |
| `CONFLICT` (409) | The handler threw it, for example for a shipped order. | Show the message; reload the record. |
| `INTERNAL` (500) | The handler threw something that is not a `KitrError`. In production the message is "Internal server error". | Read the server log line `[kitr/actions] <name> failed:`. |
| `NETWORK` | The request never reached the server. Only calls through `defineQuery` or `useKitrMutation` convert this; a direct call rejects with the browser's `TypeError`. | Let the user retry. |

## Testing

Start's server functions need the Start runtime, so a plain Vitest run cannot call `cancelOrder()` itself: it throws "No Start context found in AsyncLocalStorage". Test the two halves separately instead. Export the handler and the schema, and test them as plain functions:

```ts
// app/actions/orders/cancel_order.test.ts
import { KitrError, validate } from 'kitr/app'
import { describe, expect, it } from 'vitest'
import { cancelOrderHandler, cancelOrderInput } from './cancel_order'

describe('orders.cancelOrder', () => {
  it('rejects a missing reason before the handler runs', async () => {
    const result = await validate(cancelOrderInput, { id: 'ord_1', reason: '' })
    expect(result).toEqual({ success: false, fieldErrors: { reason: ['Tell the customer why'] } })
  })

  it('cancels a paid order', async () => {
    const order = await cancelOrderHandler({ input: { id: 'ord_1', reason: 'Customer asked' } })
    expect(order).toMatchObject({ id: 'ord_1', status: 'cancelled', cancelReason: 'Customer asked' })
  })

  it('refuses shipped and unknown orders', async () => {
    const shipped = await cancelOrderHandler({ input: { id: 'ord_2', reason: 'Too late' } }).catch((e) => e)
    expect(shipped).toBeInstanceOf(KitrError)
    expect(shipped).toMatchObject({ code: 'CONFLICT', status: 409 })

    const missing = await cancelOrderHandler({ input: { id: 'ord_9', reason: 'Typo' } }).catch((e) => e)
    expect(missing).toMatchObject({ code: 'NOT_FOUND', message: 'Order not found' })
  })
})
```

To test a component that calls an action, mock the action module. The mock only needs `mutation()` (or `query()` for a GET action) returning a contract:

```tsx
// app/features/orders/cancel-order-button.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { KitrError } from 'kitr/app'
import { QueryClient, QueryClientProvider } from 'kitr/query'
import { expect, it, vi } from 'vitest'
import { CancelOrderButton } from './cancel-order-button'

const mocks = vi.hoisted(() => ({ cancel: vi.fn() }))
vi.mock('../../actions/orders/cancel_order', () => ({
  cancelOrder: { mutation: () => ({ source: 'action', mutate: mocks.cancel }) },
}))

function renderButton(orderId: string) {
  const client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <CancelOrderButton orderId={orderId} />
    </QueryClientProvider>,
  )
}

it('sends the order id and shows the server error', async () => {
  mocks.cancel.mockRejectedValue(new KitrError('CONFLICT', 'Shipped orders cannot be cancelled'))
  renderButton('ord_2')
  fireEvent.click(screen.getByRole('button', { name: 'Cancel order' }))
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Shipped orders cannot be cancelled')
  expect(mocks.cancel).toHaveBeenCalledWith({ id: 'ord_2', reason: 'Customer asked' })
})

it('re-enables the button after success', async () => {
  mocks.cancel.mockResolvedValue({ id: 'ord_1', status: 'cancelled' })
  renderButton('ord_1')
  fireEvent.click(screen.getByRole('button', { name: 'Cancel order' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel order' })).toHaveProperty('disabled', false))
  expect(mocks.cancel).toHaveBeenCalledOnce()
})
```

The path in `vi.mock` is relative to the test file and must point at the same file the component imports. To test an action end to end, through the network and the Start runtime, use a browser test with Playwright against `npm run dev`.

## Next steps

- [API reference](/packages/actions/api): `defineAction`, `Action`, `requireSession` and the option types.
- [TanStack Start server functions](https://tanstack.com/start/latest/docs/framework/react/server-functions): what runs underneath, middleware and request helpers.
- [Query](/packages/query): `defineMutation`, `defineQuery`, `useKitrMutation` and cache effects.
- [Forms](/packages/forms): show an action's validation errors under each field.
- [API routes](/packages/api): when something other than your UI calls the code.
- [A full-stack app](/docs/fullstack): actions, API routes and realtime in one project.
