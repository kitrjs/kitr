---
title: Testing
description: Test components and API routes with everything already wired up.
order: 1
---

# Testing

The hard part of testing an app is rarely the assertion. It is the setup: the providers a component expects, the query cache, the router, a server listening on a port. `@kitr/testing` boots your real app for each test, renders components inside its providers, and sends requests to your API by calling its fetch handler directly, so no server starts and no port opens.

> [!SUMMARY]
> Test components and API routes against your real app with no setup. Add it with `kitr add testing`; the overview is at [/packages/testing](/packages/testing).

It is built on [Vitest](https://vitest.dev) and [Testing Library](https://testing-library.com/docs/react-testing-library/intro/), with three helpers: `createTestApp()` boots an app with your providers and config, `createTestClient()` sends JSON requests to anything with a `fetch(request)` method, and `renderWithKitr()` from `@kitr/testing/react` renders a component inside that app with the query cache filled. It runs in your test process only. To fake an API your frontend calls, use [mocks](/packages/mocks) alongside it.

The examples test Acme's order screens at `app.acme.com`: an `/api/orders` API and an order list component.

## Install

```sh
kitr add testing
```

<details>
<summary>Everything kitr add changes</summary>

- Adds `@kitr/testing` and `vitest` to `devDependencies` and installs them. In a project with React it also adds `@testing-library/react`, `@testing-library/dom` and `happy-dom`. Pass `--no-install` to skip the install.
- Adds `'@kitr/testing'` to `packages` in `kitrrc.ts`. It registers no provider.
- Writes `vitest.config.ts`, unless one exists (see [Configure](#configure)).
- Writes `test/example.test.ts`, unless one exists: an API test of `/api/health` without React, or a one-line `expect(1 + 1).toBe(2)` with React.
- Adds a `## kitr: testing` section to `AGENTS.md`.

It writes no config file, adds no env variables or scripts and asks no questions. Projects from `kitr new` already have `"test": "vitest run"` in `package.json`; otherwise add that script. Every kit except `blank` includes testing.

`kitr remove testing` takes `'@kitr/testing'` out of `kitrrc.ts`, removes the dependency and the `AGENTS.md` section, and lists files that still import it. It leaves `vitest.config.ts`, everything under `test/` and the other dev dependencies.

</details>

## Configure

`@kitr/testing` has no config file. The test runner reads `vitest.config.ts`. In a project with React it reads:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { kitr } from '@kitr/vite'

export default defineConfig({
  plugins: [kitr({ plugins: { tailwind: false } })],
  test: {
    environment: 'happy-dom',
    include: ['app/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
  },
})
```

The `kitr()` plugin gives tests the same `#app`, `#server`, `#config` and `#components` aliases as the app, plus the `virtual:kitr/providers` and `virtual:kitr/config` modules. `happy-dom` gives components a DOM. Without React the file has no plugin and runs in Node:

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

Tests live next to the code (`app/components/orders/order-list.test.tsx`) or under `test/`. Every other [Vitest option](https://vitest.dev/config/) works here as usual.

The helpers take their options per call. `createTestApp(options)` takes the same options as `createApp()`:

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

`renderWithKitr(ui, options)` from `@kitr/testing/react` takes every [Testing Library render option](https://testing-library.com/docs/react-testing-library/api#render-options) plus:

| Option | Default | Description |
| --- | --- | --- |
| `app` | required | The booted app whose providers wrap the component, usually from `createTestApp`. |
| `queryData` | none | Entries `[queryKey, data]` written into the query cache before rendering. Needs the [query](/packages/query) provider in `app`. |
| `wrapper` | none | An extra component rendered inside the app's providers, such as a router. |

## Write your first test

Start with the API, because it needs no DOM. The server in `server/main.ts` is a fetch handler, so the test client calls it directly. This test creates an order and reads it back:

```ts
// test/orders.test.ts
import { createTestClient } from '@kitr/testing'
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

The first request boots the server's app, with every provider in `kitrrc.ts`, as in `kitr dev`. Nothing listens on a port, so tests run in parallel without clashing.

## Run the tests

`pnpm test` runs `vitest run`: every test once, exiting non-zero on failure, which is what CI needs. While you work, use watch mode:

```sh
pnpm vitest
```

To run one file, or tests whose name matches:

```sh
pnpm test test/orders.test.ts
pnpm test -t "creates an order"
```

`it.only` runs one test and `it.skip` skips one; remove them before you commit. The [Vitest CLI reference](https://vitest.dev/guide/cli) lists every flag.

## Send requests to your API

`createTestClient` returns one method per verb. `post`, `put` and `patch` take a body; `get` and `delete` do not. Per-call headers come last:

```ts
// test/orders.test.ts
import { createTestClient } from '@kitr/testing'
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

`put` works like `patch`; a `.resource()` route uses `PATCH` for updates. Each request carries:

- `accept: application/json`.
- A body, when you pass one, sent as JSON. Falsy bodies such as `0`, `false` and `null` are sent too; only `undefined` means no body.
- The query string exactly as you write it. Encode values containing spaces or `&` with `URLSearchParams`.

## Read the response

Every call resolves to a `TestResponse` with four fields:

```ts
// test/orders.test.ts
import { createTestClient } from '@kitr/testing'
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
| `body` | The body as JSON, else as text, or `undefined` when empty. |
| `response` | The raw `Response`. Its body is already consumed, so don't call `.json()` on it again. |

The type argument (`post<{ id: string }>`) types `body` only; it does not check the response at run time, so assert the fields you care about.

## Sign requests in

Pass headers once in `defaults` and every request carries them. A per-call header with the same name wins:

```ts
// test/orders.test.ts
import { createTestClient } from '@kitr/testing'
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

Signing in through the real route keeps the test honest: same tokens, cookies and guards as production. When many files need a signed-in client, put the sign-in in a helper, as in [Testing](#testing).

## Assert validation errors

When a controller's `static validation` rejects a body, the server answers `422` with `code`, `message`, `status` and `fieldErrors` keyed by field. Assert the fields, not the wording:

```ts
// test/orders.test.ts
import { createTestClient } from '@kitr/testing'
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

The full body, with a [zod](https://zod.dev) schema of `customer: z.string().min(2)` and `total: z.number().positive()`:

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

The same `fieldErrors` reach a client form, where [forms](/packages/forms) shows each message under its field.

## Assert error responses

Every error a kitr server sends has the same JSON shape. A controller that throws `KitrError.notFound('Order 99')` answers:

```ts
// test/orders.test.ts
import { createTestClient } from '@kitr/testing'
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

A path with no route answers `404` with `NOT_FOUND` and a message like `Cannot find any route matching [GET] http://test/api/nothing`; the test client sends requests to `http://test`.

## Test a deployed API

Pass a URL string instead of the server and the client sends real HTTP requests with the global `fetch`, so the same test file can smoke-test a staging deployment:

```ts
// test/smoke.test.ts
import { createTestClient } from '@kitr/testing'
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

A trailing slash on the base URL is removed. `/healthz` is the server's built-in health route. Give smoke tests their own include pattern, because they need the network and a running deployment.

## Test any fetch handler

The target only needs a `fetch(request)` method that returns a `Response`: a TanStack Start handler, an [h3](https://h3.dev) app, a Cloudflare Worker's default export, or a webhook handler of your own:

```ts
// test/stripe-webhook.test.ts
import { createTestClient } from '@kitr/testing'
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

Wrapping a function in `{ fetch: ... }` is enough. Read paths from `new URL(request.url).pathname`, not the host.

## Boot the app without a server

To test a service, a provider or anything else in the container, boot an app with `createTestApp()`. This checks that the billing provider binds an `invoices` service with the configured currency:

```ts
// app/lib/invoices/invoices.test.ts
import { createTestApp } from '@kitr/testing'
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

`createTestApp` runs every provider's `register`, resolves the container, then runs every `boot`; it skips `ready` and `shutdown`, which only servers call. Each call builds a new app, so no state leaks between tests.

Reading a binding nobody registered throws, with the reason in the message:

```ts
app.container.use('mailer')
// => Error: [kitr] No binding named "mailer". Did you add the package that provides it?
```

`createApp` is re-exported too, for a test that adds providers with `app.use()` before booting.

## Use your real providers and config

With React, the `kitr()` plugin in `vitest.config.ts` serves the same two virtual modules as the app. Import them to boot the app as `app/app.ts` does:

```ts
// app/lib/orders/app.test.ts
import { createTestApp } from '@kitr/testing'
import { config } from 'virtual:kitr/config'
import { providers } from 'virtual:kitr/providers'
import { expect, it } from 'vitest'

it('boots with every provider in kitrrc.ts', async () => {
  const app = await createTestApp({ providers, config })

  expect(app.container.has('queryClient')).toBe(true)
  expect(app.container.has('http')).toBe(true)
})
```

`virtual:kitr/providers` is every provider in `kitrrc.ts`, in order; `virtual:kitr/config` is every file in `config/`, keyed by file name. Pass `env` when a provider reads `app.env`, because `createTestApp` does not run `app/env.ts`. Without React there are no virtual modules: test through the server, which already boots the providers.

## Replace a service with a fake

Tests should not send real emails or charge real cards. Bind a fake under the same name after the real provider; a later binding replaces an earlier one:

```ts
// test/order-confirmation.test.ts
import { defineProvider } from 'kitr/app'
import { createTestApp } from '@kitr/testing'
import { config } from 'virtual:kitr/config'
import { providers } from 'virtual:kitr/providers'
import { expect, it } from 'vitest'
import { sendOrderConfirmation } from '#app/lib/orders/confirmation'

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

To fake a service the API server uses, bind it on `server.app` before the requests that need it. This pins the clock so an "orders due today" route answers the same every day:

```ts
// test/orders-due.test.ts
import { createTestClient } from '@kitr/testing'
import { expect, it } from 'vitest'
import { server } from '#server/main'

it('lists orders due today', async () => {
  await server.boot()
  server.app.container.value('clock', { now: () => new Date('2026-03-01T09:00:00Z') })

  const res = await createTestClient(server).get<{ today: string }>('/api/orders/due')
  expect(res.body.today).toBe('2026-03-01')
})
```

> [!WARNING] Boot first
> Call `server.boot()` first, so the real binding exists before you replace it. A service a module captured at import time keeps the original; read services inside the handler.

## Render a component

`renderWithKitr` from `@kitr/testing/react` renders a component inside every provider the app has, the tree `KitrProvider` builds in the browser. Query the screen with [Testing Library](https://testing-library.com/docs/queries/about):

```tsx
// app/components/orders/order-total.test.tsx
import { screen } from '@testing-library/react'
import { createTestApp } from '@kitr/testing'
import { renderWithKitr } from '@kitr/testing/react'
import { expect, it } from 'vitest'
import { OrderTotal } from '#app/components/orders/order-total'

it('shows the order total', async () => {
  const app = await createTestApp()
  renderWithKitr(<OrderTotal total={120} />, { app })

  expect(screen.getByText('Total: 120')).toBeTruthy()
})
```

`renderWithKitr` returns what Testing Library's `render` returns. `useApp()` inside the component returns `app`. To click and type, use `fireEvent`, or [`@testing-library/user-event`](https://testing-library.com/docs/user-event/intro) for events closer to a real user's.

## Seed the query cache

A component that loads data with [query](/packages/query) would try the network on first render. Pass `queryData`, entries of a query key and its data, to render with the cache filled:

```tsx
// app/components/orders/order-list.test.tsx
import queryProvider from '@kitr/query/provider'
import { screen } from '@testing-library/react'
import { createTestApp } from '@kitr/testing'
import { renderWithKitr } from '@kitr/testing/react'
import { expect, it } from 'vitest'
import { OrderList } from './order-list'
import { ordersQuery } from '#app/queries/orders'

it('lists the orders from the cache', async () => {
  const app = await createTestApp({ providers: [queryProvider] })

  renderWithKitr(<OrderList />, {
    app,
    queryData: [[ordersQuery.key(), [{ id: '1', customer: 'Grace', total: 120 }]]],
  })

  expect(await screen.findByText('Grace: 120')).toBeTruthy()
})
```

The query and the component read the same key:

```ts
// app/queries/orders.ts
import { queryFrom } from '@kitr/query'

export interface Order {
  id: string
  customer: string
  total: number
}

export const ordersQuery = queryFrom<void, Order[]>({
  key: () => ['orders', 'list'],
  fetch: async (_input, { signal }) => {
    const res = await fetch('/api/orders', { signal })
    return (await res.json()) as Order[]
  },
})
```

```tsx
// app/components/orders/order-list.tsx
import { useQuery } from '@kitr/query'
import { ordersQuery } from '#app/queries/orders'

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

Take the key from the query definition (`ordersQuery.key()`), not a hand-written array, so the test follows the key when it changes. `queryData` is written before the first render. Whether the component refetches afterwards depends on `staleTime`, so give real queries one, or fake the network with [mocks](#fake-the-network-for-components). Without a query provider, `queryData` is ignored.

## Read services in a component

A component that calls `useService('clock')` gets what the app's container holds. Register a fake provider:

```tsx
// app/components/orders/due-badge.test.tsx
import { screen } from '@testing-library/react'
import { defineProvider } from 'kitr/app'
import { createTestApp } from '@kitr/testing'
import { renderWithKitr } from '@kitr/testing/react'
import { expect, it } from 'vitest'
import { DueBadge } from '#app/components/orders/due-badge'

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

The same pattern fakes the [http](/packages/http) client, the [analytics](/packages/analytics) tracker or anything else read from the container.

## Render a component that uses links

`<Link>` and the route hooks need a router above them. Pass one as `wrapper`; it renders inside the app's providers. A root route whose component is the element under test, on a memory history, is enough:

```tsx
// test/with-router.tsx
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@kitr/router'
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
// app/components/orders/order-row.test.tsx
import { screen } from '@testing-library/react'
import { createTestApp } from '@kitr/testing'
import { renderWithKitr } from '@kitr/testing/react'
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

The router renders after a tick, so use `findBy...` queries, which wait. The helper lives in `test/` and has no import alias, so import it by relative path.

## Render a whole page

To test a page with its loader, search params and layout, build the real router from your route table with `createKitrRouter`. It wraps the tree in the app's providers itself, so use Testing Library's plain `render`:

```tsx
// app/pages/orders.test.tsx
import { act, render, screen } from '@testing-library/react'
import queryProvider from '@kitr/query/provider'
import { createKitrRouter, createMemoryHistory, RouterProvider } from '@kitr/router'
import { createTestApp } from '@kitr/testing'
import { expect, it } from 'vitest'
import { routes } from '#app/routes'

it('renders the orders page from its URL', async () => {
  const app = await createTestApp({ providers: [queryProvider] })
  const router = createKitrRouter({
    routes,
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

The loader runs for real: seed its data with `app.container.use('queryClient').setQueryData(...)` before `router.load()`, or answer its requests with [mocks](/packages/mocks).

## Fake the network for components

When a component really fetches, answer its requests with [mocks](/packages/mocks). MSW intercepts `fetch` in the test process, so the component, query and http client run as in production:

```tsx
// app/components/orders/order-list.network.test.tsx
import queryProvider from '@kitr/query/provider'
import { screen } from '@testing-library/react'
import { HttpResponse, http, setupNodeMocks } from '@kitr/mocks'
import { createTestApp } from '@kitr/testing'
import { renderWithKitr } from '@kitr/testing/react'
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

Seed the cache when the test is about rendering; fake the network when it is about loading, errors and retries.

## Choose the test environment per file

The React config runs every file in `happy-dom`. API tests need no DOM, so put a comment on the first line to run a file in Node:

```ts
// @vitest-environment node
// test/invoices.test.ts
import { createTestClient } from '@kitr/testing'
import { expect, it } from 'vitest'
import { server } from '#server/main'

it('lists a team’s invoices', async () => {
  const res = await createTestClient(server).get('/api/teams/acme/invoices')
  expect(res.status).toBe(200)
})
```

The comment must come before any import. The `saas`, `site` and `realtime` kits do this for their API tests.

## Keep tests isolated

Each file gets its own module graph, but tests inside one file share the imported `server` and anything its controllers keep in memory. Make each test create the data it reads, and don't assume an order with id `1` exists:

```ts
// test/orders.test.ts
import { createTestClient } from '@kitr/testing'
import { expect, it } from 'vitest'
import { server } from '#server/main'

const client = createTestClient(server)

it('finds the order it just created', async () => {
  const { body } = await client.post<{ id: string }>('/api/orders', { customer: 'Ada', total: 80 })

  expect((await client.get(`/api/orders/${body.id}`)).status).toBe(200)
})
```

For services, prefer a fresh `createTestApp()` per test over one shared at the top of the file: boot is cheap, and nothing carries over.

## Commands

| Command | What it does |
| --- | --- |
| `kitr make:test <name>` | Writes `test/<name>.test.ts` with a test that boots the app. `--force` overwrites an existing file. |

`kitr make:test orders` writes:

```ts
// test/orders.test.ts
import { createTestApp } from '@kitr/testing'
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

The name is turned into kebab case (`kitr make:test invoice-totals` writes `test/invoice-totals.test.ts`). A `stubs/test.ts` file (`kitr eject stub test` copies the default) replaces the template.

## Testing

A broken helper makes every test that uses it lie, so test shared helpers too. Use an inline fetch handler that echoes what it received, so you can assert what the helper sends without booting your server.

This helper signs a client in as one of Acme's users:

```ts
// test/helpers.ts
import { createTestClient } from '@kitr/testing'

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

The same trick tests any code that takes a fetch target: retry wrappers, webhook signers, partner API clients.

## Next steps

- [API reference](/packages/testing/api): every export of `@kitr/testing` and `@kitr/testing/react`.
- [Mocks](/packages/mocks): fake the API your frontend calls, in tests and in the browser.
- [Vitest docs](https://vitest.dev/guide/): matchers, mocking modules, timers, coverage.
