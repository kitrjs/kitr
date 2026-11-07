---
title: Testing
description: Test components and API routes with everything already wired up.
order: 1
---

# Testing

The hard part of testing an app is rarely the assertion. It is the setup: the providers a component expects, the query cache, the router, a server listening on a port. `kitr/testing` boots your real app for each test, renders components inside its providers, and sends requests to your API by calling its fetch handler directly, so no server starts and no port opens.

It is built on [Vitest](https://vitest.dev) and [Testing Library](https://testing-library.com/docs/react-testing-library/intro/). It adds three helpers on top: `createTestApp()` boots an app with your providers and config, `createTestClient()` sends JSON requests to anything with a `fetch(request)` method, and `renderWithKitr()` from `kitr/testing/react` renders a component inside that app with the query cache already filled.

It runs in your test process only, never in the app bundle. `kitr/testing` has no React in it, so a backend without React uses it as is; `kitr/testing/react` adds the component half. To fake an API your frontend calls, rather than test your own, use [mocks](/packages/mocks) alongside it.

The examples on this page test Acme's order screens at `app.acme.com`: an `/api/orders` API that Ada, Grace and Linus use to create and list orders, and an order list component that shows them.

## Install

```sh
kitr add testing
```

What `kitr add` does:

- Adds `@kitr/testing` and `vitest` to `devDependencies` and installs them. In a project with React it also adds `@testing-library/react`, `@testing-library/dom` and `happy-dom`. Pass `--no-install` to skip the install.
- Adds `'@kitr/testing'` to `packages` in `kitrrc.ts`. It registers no provider, because nothing runs at app startup.
- Writes `vitest.config.ts`, unless one exists. See [Configure](#configure) for both versions.
- Writes `test/example.test.ts`, unless one exists. In a project without React it is an API test of `/api/health` through `createTestClient(server)`; with React it is a one-line `expect(1 + 1).toBe(2)` that proves the runner works.
- Adds a `## kitr: testing` section to `AGENTS.md`: `pnpm test` runs Vitest, components render with `renderWithKitr(<X />, { app, queryData })` from `kitr/testing/react`, APIs are called with `createTestClient(server).get('/api/x')`, and no running backend is needed.

It writes no config file, adds no env variables, adds no scripts and asks no questions. Projects created with `kitr new` already have `"test": "vitest run"` in `package.json`; in an older project, add that script yourself.

Every kit except `blank` includes testing: `app`, `fullstack`, `server`, `saas`, `site`, `realtime`, `desktop` and `mobile`.

`kitr remove testing` takes `'@kitr/testing'` out of `kitrrc.ts`, removes the `@kitr/testing` dependency and the `AGENTS.md` section, then lists files under `app/` and `config/` that still import `kitr/testing`. It leaves `vitest.config.ts`, everything under `test/` and the other dev dependencies in place.

## Configure

`kitr/testing` has no config file. The test runner reads `vitest.config.ts`, which `kitr add testing` writes. In a project with React it reads:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { kitr } from 'kitr/vite'

export default defineConfig({
  plugins: [kitr({ plugins: { tailwind: false } })],
  test: {
    environment: 'happy-dom',
    include: ['app/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
  },
})
```

The `kitr()` plugin gives tests the same `#app`, `#server`, `#config` and `#components` import aliases as the app, and the `virtual:kitr/providers` and `virtual:kitr/config` modules. `happy-dom` gives components a DOM to render into. In a project without React the file has no plugin and runs in Node:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['app/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
  },
})
```

Tests live next to the code they test (`app/features/orders/order-list.test.tsx`) or under `test/` (`test/orders.test.ts`). Every other [Vitest option](https://vitest.dev/config/) works in this file as usual.

The three helpers take their options per call. `createTestApp(options)` takes the same options as `createApp()`:

| Option | Default | Description |
| --- | --- | --- |
| `providers` | `[]` | Providers to register and boot, in order. Pass `providers` from `virtual:kitr/providers` for the app's real ones. |
| `config` | `{}` | Per-package config keyed like `config/<name>.ts` files: `{ i18n: { ... } }`. |
| `environment` | `'test'` | `'client'`, `'server'` or `'test'`. `createTestApp` sets `'test'` unless you pass another. |
| `mode` | from Vite's `MODE` or `NODE_ENV` | `'development'`, `'production'` or `'test'`. Under Vitest it is `'test'`. |
| `env` | `{}` | The validated env object, exposed as `app.env`. |
| `platform` | from `KITR_PLATFORM` | The platform name from `kitrrc.ts` the app runs as. |

`createTestClient(target, defaults)`:

| Option | Default | Description |
| --- | --- | --- |
| `target` | required | A kitr server, any object with `fetch(request)`, or a base URL string such as `'https://staging.acme.com'`. |
| `defaults.headers` | `{}` | Headers sent with every request. Per-call headers override them. |

`renderWithKitr(ui, options)` from `kitr/testing/react` takes every [Testing Library render option](https://testing-library.com/docs/react-testing-library/api#render-options) plus:

| Option | Default | Description |
| --- | --- | --- |
| `app` | required | The booted app whose providers wrap the component, usually from `createTestApp`. |
| `queryData` | none | Entries `[queryKey, data]` written into the query cache before rendering. Needs the [query](/packages/query) provider in `app`. |
| `wrapper` | none | An extra component rendered inside the app's providers, such as a router. |

## Write your first test

Start with the API, because it needs no DOM. The server in `server/main.ts` is a fetch handler, so the test client calls it directly. This test creates an order as Ada and reads it back:

```ts
// test/orders.test.ts
import { createTestClient } from 'kitr/testing'
import { describe, expect, it } from 'vitest'
import { server } from '#server/main'

describe('orders', () => {
  it('creates an order and reads it back', async () => {
    const client = createTestClient(server)

    const created = await client.post<{ id: string; status: string }>('/api/orders', {
      customer: 'Grace',
      total: 120,
    })
    expect(created.status).toBe(201)
    expect(created.body.status).toBe('open')

    const read = await client.get<{ customer: string }>(`/api/orders/${created.body.id}`)
    expect(read.body.customer).toBe('Grace')
  })
})
```

Run it:

```sh
pnpm test
```

```txt
 ✓ test/orders.test.ts (1 test) 31ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
```

The first request boots the server's app: every provider in `kitrrc.ts` registers and boots, exactly as in `kitr dev`. Nothing listens on a port, so tests run in parallel without clashing.

## Run the tests

`pnpm test` runs `vitest run`: every test once, then exits with a non-zero code if any failed, which is what CI needs. While you work, run Vitest in watch mode so it reruns the tests a change affects:

```sh
pnpm vitest
```

To run one file, or only the tests whose name matches a pattern:

```sh
pnpm test test/orders.test.ts
pnpm test -t "creates an order"
```

Inside a file, `it.only` runs one test and `it.skip` skips one. Remove them before you commit. The [Vitest CLI reference](https://vitest.dev/guide/cli) lists every flag.

## Send requests to your API

`createTestClient` returns one method per verb. `post`, `put` and `patch` take a body; `get` and `delete` do not. Every method takes per-call headers last:

```ts
// test/orders.test.ts
import { createTestClient } from 'kitr/testing'
import { expect, it } from 'vitest'
import { server } from '#server/main'

const client = createTestClient(server)

it('updates and deletes an order', async () => {
  const { body: order } = await client.post<{ id: string }>('/api/orders', {
    customer: 'Linus',
    total: 300,
  })

  const paid = await client.patch<{ status: string }>(`/api/orders/${order.id}`, { status: 'paid' })
  expect(paid.body.status).toBe('paid')

  const removed = await client.delete(`/api/orders/${order.id}`)
  expect(removed.status).toBe(204)

  const list = await client.get('/api/orders?status=open&page=2', {
    headers: { 'accept-language': 'de' },
  })
  expect(list.status).toBe(200)
})
```

`put` works the same way as `patch`, for routes you declare with `.put()`. A `.resource()` route uses `PATCH` for updates.

What each request carries:

- `accept: application/json` on every request.
- A body, when you pass one, sent with `JSON.stringify` and `content-type: application/json`. Falsy bodies such as `0`, `false` and `null` are sent too; only `undefined` means no body.
- The query string exactly as you write it in the path. Encode values yourself with `URLSearchParams` when they contain spaces or `&`.

Don't build `new Request(...)` and call `server.fetch()` by hand in every test. The client does it in one line and parses the response for you.

## Read the response

Every call resolves to a `TestResponse` with four fields:

```ts
// test/orders.test.ts
import { createTestClient } from 'kitr/testing'
import { expect, it } from 'vitest'
import { server } from '#server/main'

it('returns the new order as JSON', async () => {
  const res = await createTestClient(server).post<{ id: string; customer: string }>(
    '/api/orders',
    { customer: 'Grace', total: 120 },
  )

  res.status // => 201
  res.headers.get('content-type') // => 'application/json;charset=UTF-8'
  res.body // => { id: '1', customer: 'Grace', total: 120, status: 'open' }
  res.response // => the raw Response; its body has already been read

  expect(res.body).toMatchObject({ customer: 'Grace', total: 120 })
})
```

| Field | What it holds |
| --- | --- |
| `status` | The HTTP status code. |
| `headers` | The response `Headers`. |
| `body` | The body parsed as JSON. When the body is not JSON it is the raw text (`'plain words'`); when it is empty, as in a `204`, it is `undefined`. |
| `response` | The raw `Response`, for anything else. Its body is already consumed, so don't call `.json()` on it again. |

The type argument (`post<{ id: string }>`) types `body` only. It does not check the response at run time, so assert the fields you care about.

## Sign requests in

Pass headers once in `defaults` and every request carries them. A per-call header with the same name wins:

```ts
// test/orders.test.ts
import { createTestClient } from 'kitr/testing'
import { expect, it } from 'vitest'
import { server } from '#server/main'

it('only lets a signed-in user create orders', async () => {
  const anonymous = createTestClient(server)
  expect((await anonymous.post('/api/orders', { customer: 'Grace', total: 120 })).status).toBe(401)

  const signIn = await anonymous.post<{ token: string }>('/api/auth/sign-in', {
    email: 'ada@acme.com',
    password: 'password',
  })
  const ada = createTestClient(server, { headers: { authorization: `Bearer ${signIn.body.token}` } })

  expect((await ada.post('/api/orders', { customer: 'Grace', total: 120 })).status).toBe(201)

  const asSomeoneElse = await ada.get('/api/auth/me', {
    headers: { authorization: 'Bearer expired-token' },
  })
  expect(asSomeoneElse.status).toBe(401)
})
```

Signing in through the real route keeps the test honest: it uses the same tokens, cookies and guards as production. When many files need a signed-in client, put the sign-in in a helper. [Test your own test helpers](#testing) shows one, with a test for it.

## Assert validation errors

When a controller's `static validation` rejects a body, the server answers `422` with kitr's error shape: a `code`, a `message`, the `status` and `fieldErrors` keyed by field. Assert the fields, not the exact wording, so changing a message does not break the test:

```ts
// test/orders.test.ts
import { createTestClient } from 'kitr/testing'
import { expect, it } from 'vitest'
import { server } from '#server/main'

it('rejects an order without a customer or with a negative total', async () => {
  const res = await createTestClient(server).post('/api/orders', { customer: 'G', total: -1 })

  expect(res.status).toBe(422)
  expect(res.body).toMatchObject({ code: 'VALIDATION' })
  expect(Object.keys((res.body as { fieldErrors: object }).fieldErrors)).toEqual([
    'customer',
    'total',
  ])
})
```

The full body for that request, with a [zod](https://zod.dev) schema of `customer: z.string().min(2)` and `total: z.number().positive()`:

```json
{
  "code": "VALIDATION",
  "message": "Validation failed",
  "status": 422,
  "fieldErrors": {
    "customer": ["Too small: expected string to have >=2 characters"],
    "total": ["Too small: expected number to be >0"]
  }
}
```

The same `fieldErrors` reach a form on the client, where [forms](/packages/forms) shows each message under its field.

## Assert error responses

Every error a kitr server sends has the same JSON shape, so one assertion style covers them all. A controller that throws `KitrError.notFound('Order 99')` answers:

```ts
// test/orders.test.ts
import { createTestClient } from 'kitr/testing'
import { expect, it } from 'vitest'
import { server } from '#server/main'

it('answers 404 for an order that does not exist', async () => {
  const res = await createTestClient(server).get('/api/orders/99')

  expect(res.status).toBe(404)
  expect(res.body).toEqual({ code: 'NOT_FOUND', message: 'Order 99 not found', status: 404 })
})
```

The codes you will assert most often:

| Status | `code` | Thrown by |
| --- | --- | --- |
| `401` | `UNAUTHORIZED` | `KitrError.unauthorized()`; body message `Authentication required`. |
| `403` | `FORBIDDEN` | `KitrError.forbidden()`; body message `Not allowed`. |
| `404` | `NOT_FOUND` | `KitrError.notFound('Order 99')`, or a path no route matches. |
| `409` | `CONFLICT` | `new KitrError('CONFLICT', 'Order already paid')`. |
| `422` | `VALIDATION` | `static validation` or `KitrError.validation(fieldErrors)`. |
| `500` | `INTERNAL` | Any other thrown error. In production the message becomes `Internal server error`. |

A path with no route answers `404` with `code: 'NOT_FOUND'` and a message like `Cannot find any route matching [GET] http://test/api/nothing`. Requests from the test client go to `http://test`, which is why that host appears.

## Test a deployed API

Pass a URL string instead of the server and the client sends real HTTP requests with the global `fetch`. The same test file then runs against a staging deployment, for a smoke test after a deploy:

```ts
// test/smoke.test.ts
import { createTestClient } from 'kitr/testing'
import { expect, it } from 'vitest'

const baseUrl = process.env.SMOKE_URL ?? 'https://staging.acme.com'

it('serves health and orders', async () => {
  const client = createTestClient(baseUrl, {
    headers: { authorization: `Bearer ${process.env.SMOKE_TOKEN}` },
  })

  expect((await client.get<{ ok: boolean }>('/healthz')).body).toEqual({ ok: true })
  expect((await client.get('/api/orders')).status).toBe(200)
})
```

A trailing slash on the base URL is removed, so `https://staging.acme.com/` works too. `/healthz` is the kitr server's built-in health route. Keep smoke tests out of the default run by giving them their own include pattern, because they need the network and a running deployment.

## Test any fetch handler

The target only needs a `fetch(request)` method that returns a `Response`. That covers a TanStack Start handler, an [h3](https://h3.dev) app, a Cloudflare Worker's default export, or a webhook handler you wrote by hand:

```ts
// test/stripe-webhook.test.ts
import { createTestClient } from 'kitr/testing'
import { expect, it } from 'vitest'
import { handleStripeWebhook } from '#server/webhooks/stripe'

it('marks the invoice paid', async () => {
  const webhook = createTestClient({ fetch: handleStripeWebhook })

  const res = await webhook.post('/webhooks/stripe', {
    type: 'invoice.paid',
    data: { object: { id: 'in_1001', customer_email: 'ada@acme.com' } },
  })

  expect(res.status).toBe(200)
})
```

Wrapping a plain function in `{ fetch: ... }` is enough. The client builds `Request` objects against `http://test`, so read paths from `new URL(request.url).pathname` in the handler, not the host.

## Boot the app without a server

To test a service, a provider or anything else that lives in the container, boot an app with `createTestApp()` and read from it. This one checks that the billing provider binds an `invoices` service with the configured currency:

```ts
// app/features/invoices/invoices.test.ts
import { createTestApp } from 'kitr/testing'
import { expect, it } from 'vitest'
import billingProvider from '#app/providers/billing'

it('binds the invoice service with the configured currency', async () => {
  const app = await createTestApp({
    providers: [billingProvider],
    config: { billing: { currency: 'EUR' } },
  })

  app.status // => 'booted'
  app.environment // => 'test'
  app.config.get('billing') // => { currency: 'EUR' }

  const invoices = app.container.use('invoices')
  expect(invoices.format(1234.5)).toBe('€1,234.50')
})
```

`createTestApp` runs every provider's `register`, then resolves the container, then runs every `boot`. It does not run `ready` or `shutdown`, which only servers call. Each call builds a new app, so one test's services never leak into the next.

Reading a binding nobody registered throws, with the reason in the message:

```ts
app.container.use('mailer')
// => Error: [kitr] No binding named "mailer". Did you add the package that provides it?
```

`kitr/testing` also re-exports `createApp`, for a test that wants to add providers with `app.use()` before booting it itself.

## Use your real providers and config

In a project with React, the `kitr()` plugin in `vitest.config.ts` serves the same two virtual modules the app uses. Import them to boot the app exactly as `app/app.ts` does:

```ts
// app/features/orders/app.test.ts
import { createTestApp } from 'kitr/testing'
import { config } from 'virtual:kitr/config'
import { providers } from 'virtual:kitr/providers'
import { expect, it } from 'vitest'

it('boots with every provider in kitrrc.ts', async () => {
  const app = await createTestApp({ providers, config })

  expect(app.container.has('queryClient')).toBe(true)
  expect(app.container.has('http')).toBe(true)
})
```

`virtual:kitr/providers` is every provider listed in `kitrrc.ts`, in order. `virtual:kitr/config` is every file in `config/`, keyed by file name. Pass `env` when a provider reads `app.env`, because `createTestApp` does not run `app/env.ts`.

A project without React has no plugin and no virtual modules. There, test through the server, which already boots the providers from `kitrrc.ts`, or import `kitrrc.ts` and the config index yourself.

## Replace a service with a fake

Tests should not send real emails or charge real cards. Bind a fake under the same name, after the real provider, and every caller gets the fake. A later binding replaces an earlier one:

```ts
// test/order-confirmation.test.ts
import { defineProvider } from 'kitr/app'
import { createTestApp } from 'kitr/testing'
import { config } from 'virtual:kitr/config'
import { providers } from 'virtual:kitr/providers'
import { expect, it } from 'vitest'
import { sendOrderConfirmation } from '#app/features/orders/confirmation'

it('emails the customer when an order is placed', async () => {
  const sent: Array<{ to: string; subject: string }> = []
  const fakeMailer = defineProvider({
    name: 'fake-mailer',
    register: (app) => app.container.value('mailer', { send: async (m) => void sent.push(m) }),
  })

  const app = await createTestApp({ providers: [...providers, fakeMailer], config })
  await sendOrderConfirmation(app, { id: '1001', email: 'grace@acme.com' })

  expect(sent).toEqual([{ to: 'grace@acme.com', subject: 'Order 1001 confirmed' }])
})
```

To fake a service the API server uses, bind it on `server.app` before the requests that need it. Controllers that read services from `ctx.app.container` then get the fake. This pins the clock so an "orders due today" route gives the same answer every day:

```ts
// test/orders-due.test.ts
import { createTestClient } from 'kitr/testing'
import { expect, it } from 'vitest'
import { server } from '#server/main'

it('lists orders due today', async () => {
  await server.boot()
  server.app.container.value('clock', { now: () => new Date('2026-03-01T09:00:00Z') })

  const res = await createTestClient(server).get<{ today: string }>('/api/orders/due')
  expect(res.body.today).toBe('2026-03-01')
})
```

Call `server.boot()` first, so the real provider's binding exists before you replace it. A service a module captured at import time, outside any function, keeps the original; read services inside the handler.

## Render a component

On the client, `renderWithKitr` from `kitr/testing/react` renders a component inside every provider the app has, the same tree `KitrProvider` builds in the browser. Then query the screen with [Testing Library](https://testing-library.com/docs/queries/about):

```tsx
// app/features/orders/order-total.test.tsx
import { screen } from '@testing-library/react'
import { createTestApp } from 'kitr/testing'
import { renderWithKitr } from 'kitr/testing/react'
import { expect, it } from 'vitest'
import { OrderTotal } from './order-total'

it('shows the order total', async () => {
  const app = await createTestApp()
  renderWithKitr(<OrderTotal total={120} />, { app })

  expect(screen.getByText('Total: 120')).toBeTruthy()
})
```

`renderWithKitr` returns what Testing Library's `render` returns: `container`, `rerender`, `unmount` and the bound queries. `useApp()` inside the component returns `app`, and `app.mode` is `'test'`. To click and type, use `fireEvent` from `@testing-library/react`, or install [`@testing-library/user-event`](https://testing-library.com/docs/user-event/intro) for events closer to a real user's.

## Seed the query cache

A component that loads data with [query](/packages/query) would try the network on first render. Pass `queryData` and it renders with the data already in the cache. Each entry is a query key and the data under it:

```tsx
// app/features/orders/order-list.test.tsx
import queryProvider from 'kitr/query/provider'
import { screen } from '@testing-library/react'
import { createTestApp } from 'kitr/testing'
import { renderWithKitr } from 'kitr/testing/react'
import { expect, it } from 'vitest'
import { OrderList } from './order-list'
import { ordersQuery } from './queries'

it('lists the orders from the cache', async () => {
  const app = await createTestApp({ providers: [queryProvider] })

  renderWithKitr(<OrderList />, {
    app,
    queryData: [[ordersQuery.key(), [{ id: '1', customer: 'Grace', total: 120 }]]],
  })

  expect(await screen.findByText('Grace: 120')).toBeTruthy()
})
```

The query and the component under test read the same key:

```ts
// app/features/orders/queries.ts
import { defineQuery } from 'kitr/query'

export interface Order {
  id: string
  customer: string
  total: number
}

export const ordersQuery = defineQuery<void, Order[]>({
  key: () => ['orders', 'list'],
  fetch: async (_input, { signal }) => {
    const res = await fetch('/api/orders', { signal })
    return (await res.json()) as Order[]
  },
})
```

```tsx
// app/features/orders/order-list.tsx
import { useQuery } from 'kitr/query'
import { ordersQuery } from './queries'

export function OrderList() {
  const { data, isPending } = useQuery(ordersQuery.options())
  if (isPending) return <p>Loading orders</p>
  return (
    <ul>
      {data?.map((order) => (
        <li key={order.id}>
          {order.customer}: {order.total}
        </li>
      ))}
    </ul>
  )
}
```

Take the key from the query definition (`ordersQuery.key()`), not a hand-written array, so the test follows the key when it changes. `queryData` is written with `setQueryData` before the first render. Whether the component refetches it afterwards depends on the query's `staleTime`, so give real queries a `staleTime`, or fake the network with [mocks](#fake-the-network-for-components). When the app has no query provider, `queryData` is ignored.

## Read services in a component

A component that calls `useService('clock')` gets whatever the app's container holds. Register a fake provider and the component renders with it:

```tsx
// app/features/orders/due-badge.test.tsx
import { screen } from '@testing-library/react'
import { defineProvider } from 'kitr/app'
import { createTestApp } from 'kitr/testing'
import { renderWithKitr } from 'kitr/testing/react'
import { expect, it } from 'vitest'
import { DueBadge } from './due-badge'

const fixedClock = defineProvider({
  name: 'clock',
  register: (app) => app.container.value('clock', { now: () => new Date('2026-03-01T09:00:00Z') }),
})

it('says an order due today is due today', async () => {
  const app = await createTestApp({ providers: [fixedClock] })
  renderWithKitr(<DueBadge dueAt="2026-03-01" />, { app })

  expect(screen.getByText('Due today')).toBeTruthy()
})
```

The same pattern fakes the [http](/packages/http) client, the [analytics](/packages/analytics) tracker or anything else a component reads from the container.

## Render a component that uses links

`<Link>` and the route hooks need a router above them. Pass one as `wrapper`; `renderWithKitr` renders it inside the app's providers. A root route whose component is the element under test, on a memory history, is enough:

```tsx
// test/with-router.tsx
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from 'kitr/router'
import { type ReactNode, useMemo } from 'react'

/** A wrapper that renders the element under test as the root route at `path`. */
export function withRouter(path = '/') {
  return function RouterWrapper({ children }: { children: ReactNode }) {
    const router = useMemo(() => {
      const rootRoute = createRootRoute({ component: () => children, notFoundComponent: () => null })
      return createRouter({
        routeTree: rootRoute,
        history: createMemoryHistory({ initialEntries: [path] }),
      })
    }, [children])
    return <RouterProvider router={router} />
  }
}
```

```tsx
// app/features/orders/order-row.test.tsx
import { screen } from '@testing-library/react'
import { createTestApp } from 'kitr/testing'
import { renderWithKitr } from 'kitr/testing/react'
import { expect, it } from 'vitest'
import { withRouter } from '../../../test/with-router'
import { OrderRow } from './order-row'

it('links to the order', async () => {
  const app = await createTestApp()
  renderWithKitr(<OrderRow order={{ id: '1', customer: 'Grace', total: 120 }} />, {
    app,
    wrapper: withRouter('/orders'),
  })

  const link = await screen.findByRole('link', { name: 'Open' })
  expect(link.getAttribute('href')).toBe('/orders/1')
})
```

The router renders after a tick, so use `findBy...` queries, which wait, not `getBy...`. The helper lives in `test/` because it is shared by many component tests; there is no import alias for that folder, so import it with a relative path.

## Render a whole page

To test a page with its loader, its search params and its layout, build the real router from your route tree with `createKitrRouter` and render it. The router wraps the tree in the app's providers itself, so use Testing Library's plain `render`:

```tsx
// app/routes/orders.test.tsx
import { act, render, screen } from '@testing-library/react'
import queryProvider from 'kitr/query/provider'
import { createKitrRouter, createMemoryHistory, RouterProvider } from 'kitr/router'
import { createTestApp } from 'kitr/testing'
import { expect, it } from 'vitest'
import { routeTree } from '#app/routeTree.gen'

it('renders the orders page from its URL', async () => {
  const app = await createTestApp({ providers: [queryProvider] })
  const router = createKitrRouter({
    routeTree,
    app,
    history: createMemoryHistory({ initialEntries: ['/orders?status=open'] }),
  })

  await act(async () => {
    render(<RouterProvider router={router} />)
    await router.load()
  })

  expect(await screen.findByRole('heading', { name: 'Orders' })).toBeTruthy()
})
```

The page's loader runs for real, so either seed its data with `app.container.use('queryClient').setQueryData(...)` before `router.load()`, or answer its requests with [mocks](/packages/mocks).

## Fake the network for components

When a component really fetches, answer its requests with [mocks](/packages/mocks) instead of seeding the cache. MSW intercepts `fetch` in the test process, so the component, the query and the http client all run as in production:

```tsx
// app/features/orders/order-list.network.test.tsx
import queryProvider from 'kitr/query/provider'
import { screen } from '@testing-library/react'
import { HttpResponse, http, setupNodeMocks } from 'kitr/mocks'
import { createTestApp } from 'kitr/testing'
import { renderWithKitr } from 'kitr/testing/react'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { OrderList } from './order-list'

let mocks: Awaited<ReturnType<typeof setupNodeMocks>>
beforeAll(async () => {
  mocks = await setupNodeMocks([
    http.get('*/api/orders', () => HttpResponse.json([{ id: '1', customer: 'Ada', total: 80 }])),
  ])
})
afterAll(() => mocks.close())

it('loads orders from the API', async () => {
  const app = await createTestApp({ providers: [queryProvider] })
  renderWithKitr(<OrderList />, { app })

  expect(screen.getByText('Loading orders')).toBeTruthy()
  expect(await screen.findByText('Ada: 80')).toBeTruthy()
})
```

Seed the cache when the test is about rendering. Fake the network when it is about loading, errors and retries. The mocks guide covers per-test overrides and error responses.

## Choose the test environment per file

The React config runs every file in `happy-dom`. API tests do not need a DOM, and Node's own `Request` and `Response` are what your server uses in production. Put a comment on the first line of the file to run it in Node:

```ts
// @vitest-environment node
// test/invoices.test.ts
import { createTestClient } from 'kitr/testing'
import { expect, it } from 'vitest'
import { server } from '#server/main'

it('lists a team’s invoices', async () => {
  const res = await createTestClient(server).get('/api/teams/acme/invoices')
  expect(res.status).toBe(200)
})
```

The comment must come before any import. The `saas`, `site` and `realtime` kits put it on their API tests for the same reason.

## Keep tests isolated

Vitest runs each file in its own module graph, so files never share a server or an app. Tests inside one file do share the imported `server`, including anything its controllers keep in memory. Make each test create the data it reads, and don't assume an order with id `1` exists:

```ts
// test/orders.test.ts
import { createTestClient } from 'kitr/testing'
import { expect, it } from 'vitest'
import { server } from '#server/main'

const client = createTestClient(server)

it('finds the order it just created', async () => {
  const { body } = await client.post<{ id: string }>('/api/orders', { customer: 'Ada', total: 80 })

  expect((await client.get(`/api/orders/${body.id}`)).status).toBe(200)
})
```

For services, prefer a fresh `createTestApp()` per test over one shared at the top of the file. Boot is cheap, and a fresh container means no state carries over.

## Commands

| Command | What it does |
| --- | --- |
| `kitr make:test <name>` | Writes `test/<name>.test.ts` with a test that boots the app. `--force` overwrites an existing file. |

`kitr make:test orders` writes:

```ts
// test/orders.test.ts
import { createTestApp } from 'kitr/testing'
import { describe, expect, it } from 'vitest'

describe('orders', () => {
  it('boots the app', async () => {
    const app = await createTestApp()
    expect(app.status).toBe('booted')
  })

  // HTTP: `const client = createTestClient(server)` with `server` from server/main.ts, then
  // `expect((await client.get('/api/health')).status).toBe(200)`.
})
```

The name is turned into snake case, so `kitr make:test invoice-totals` writes `test/invoice_totals.test.ts`. A `stubs/test.ts` file in your project (`kitr eject stub test` copies the default) replaces the template. The generator ships with `@kitr/testing`, so `make:test` is there once the package is added. Testing adds no `kitr doctor` checks.

## Testing

Shared helpers are code too, and a broken helper makes every test that uses it lie. Test them with an inline fetch handler: an object with a `fetch` method that echoes what it received, so you can assert what the helper sends without booting your server.

This helper signs a client in as one of Acme's users:

```ts
// test/helpers.ts
import { createTestClient } from 'kitr/testing'

type Target = Parameters<typeof createTestClient>[0]

/** A client signed in as `email`, through the real sign-in route. */
export async function signedInClient(target: Target, email: string) {
  const anonymous = createTestClient(target)
  const res = await anonymous.post<{ token: string }>('/api/auth/sign-in', {
    email,
    password: 'password',
  })
  if (res.status !== 201) throw new Error(`Sign-in as ${email} failed with ${res.status}`)
  return createTestClient(target, { headers: { authorization: `Bearer ${res.body.token}` } })
}
```

And its test, which runs in milliseconds and needs no server:

```ts
// test/helpers.test.ts
import { describe, expect, it } from 'vitest'
import { signedInClient } from './helpers'

const fakeApi = {
  async fetch(request: Request) {
    const { pathname } = new URL(request.url)
    if (pathname === '/api/auth/sign-in') {
      const { email } = (await request.json()) as { email: string }
      if (email === 'linus@acme.com') return Response.json({ code: 'UNAUTHORIZED' }, { status: 401 })
      return Response.json({ token: `token-for-${email}` }, { status: 201 })
    }
    return Response.json({
      path: pathname,
      authorization: request.headers.get('authorization'),
      accept: request.headers.get('accept'),
    })
  },
}

describe('signedInClient', () => {
  it('sends the token from sign-in on every request', async () => {
    const ada = await signedInClient(fakeApi, 'ada@acme.com')
    const res = await ada.get<{ path: string; authorization: string; accept: string }>('/api/orders')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      path: '/api/orders',
      authorization: 'Bearer token-for-ada@acme.com',
      accept: 'application/json',
    })
  })

  it('lets one request override the token', async () => {
    const grace = await signedInClient(fakeApi, 'grace@acme.com')
    const res = await grace.get<{ authorization: string }>('/api/orders', {
      headers: { authorization: 'Bearer other' },
    })

    expect(res.body.authorization).toBe('Bearer other')
  })

  it('fails loudly when sign-in is refused', async () => {
    await expect(signedInClient(fakeApi, 'linus@acme.com')).rejects.toThrow(
      'Sign-in as linus@acme.com failed with 401',
    )
  })
})
```

The same inline-handler trick tests any code that takes a fetch target: retry wrappers, webhook signers, a client for a partner API.

## Next steps

- [API reference](/packages/testing/api): every export of `kitr/testing` and `kitr/testing/react`.
- [Mocks](/packages/mocks): fake the API your frontend calls, in tests and in the browser.
- [Vitest docs](https://vitest.dev/guide/): matchers, mocking modules, timers, coverage.
- [Testing Library queries](https://testing-library.com/docs/queries/about): which query to use for which element.
- [API](/packages/api): the routes and controllers these tests call.
