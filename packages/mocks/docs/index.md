---
title: Mocks
description: Fake your API while you build the frontend or run tests.
order: 1
---

# Mocks

Frontend work shouldn't wait for the backend. The invoices screen is designed, the API that feeds it is still a ticket, and the tests for its empty and error states need answers the real server rarely gives. `kitr/mocks` answers your app's HTTP requests with fake data: in the browser while you develop, and in Node while your tests run.

It is [Mock Service Worker](https://mswjs.io) (MSW), with `http` and `HttpResponse` re-exported unchanged. On top it adds `mockRoutes()`, which turns a kitr route table into one handler per route so you only write the answers, plus helpers that send errors in exactly the shape a kitr server sends them, so forms and error screens behave as they will in production.

It runs on the client and in tests. In the browser, a service worker intercepts `fetch`; in Node, MSW patches the global `fetch`. It cannot answer requests the server makes while rendering a page, because those never reach the browser. To test your own API routes rather than fake them, use [testing](/packages/testing)'s `createTestClient`.

The examples on this page follow Acme's billing team building the invoices screen at `app.acme.com` before the `/api/invoices` routes exist. Ada is signed in as an admin; Grace and Linus are customers.

## Install

```sh
kitr add mocks
```

What `kitr add` does:

- Adds `@kitr/mocks` to `dependencies` and `msw` to `devDependencies`, and installs them. Pass `--no-install` to skip the install.
- Adds `'@kitr/mocks'` to `packages` in `kitrrc.ts`. It registers no provider: mocks start only when your code calls them.
- Writes `app/mocks/handlers.ts` with one handler for `*/me`, unless the file exists.
- Writes `app/mocks/browser.ts`, which exports `enableMocks()`, unless the file exists.
- Adds `VITE_MOCKS=false` to `.env.example`, and to `.env` when it exists, under the comment `# Set true to serve app/mocks/handlers.ts in the browser`.
- Adds a `## kitr: mocks` section to `AGENTS.md`: handlers live in `app/mocks/handlers.ts`, `VITE_MOCKS=true` turns them on in development, tests use `setupNodeMocks(handlers)`, and a kitr route table is mocked with `mockRoutes(routes.toJSON(), baseUrl, { ... })`.

It adds no scripts, writes no config file and asks no questions. Mocks are a client package, so in a project without React `kitr add` skips it with a warning. The `app`, `desktop` and `mobile` kits include it.

`kitr add` does not copy MSW's service worker into your public folder. Do it once before you turn mocks on in the browser; see [Turn mocks on in the browser](#turn-mocks-on-in-the-browser).

`kitr remove mocks` takes `'@kitr/mocks'` out of `kitrrc.ts`, removes `@kitr/mocks` and `msw` from `package.json` and the `AGENTS.md` section, then lists files under `app/` and `config/` that still import `kitr/mocks`. It leaves `app/mocks/`, the `VITE_MOCKS` line and `public/mockServiceWorker.js` for you to delete.

## Configure

`kitr/mocks` has no config file. What you configure is the handler list and one env variable. `kitr add` writes these two files:

```ts
// app/mocks/handlers.ts
import { HttpResponse, http } from 'kitr/mocks'

export const handlers = [
  http.get('*/me', () => HttpResponse.json({ id: 'u1', email: 'dev@example.com', role: 'admin' })),
]
```

```ts
// app/mocks/browser.ts
import { setupBrowserMocks } from 'kitr/mocks'
import { handlers } from './handlers'

/**
 * `await enableMocks()` in the client entry. Env values are strings, so only `VITE_MOCKS=true`
 * turns mocks on (`false` would be truthy), and only in dev.
 */
export async function enableMocks() {
  if (import.meta.env.DEV && import.meta.env.VITE_MOCKS === 'true') await setupBrowserMocks(handlers)
}
```

It also adds `"msw": { "workerDirectory": ["public"] }` to `package.json`, so MSW's install step keeps `public/mockServiceWorker.js` up to date, and a `mocks:init` script that writes the worker on demand.

| Variable | Used for |
| --- | --- |
| `VITE_MOCKS` | `true` serves `app/mocks/handlers.ts` in the browser during `kitr dev`. Anything else leaves the real network alone. |

The functions that start mocks take these options:

| Option | Default | Description |
| --- | --- | --- |
| `setupBrowserMocks(handlers)` | required | The handlers to serve in the browser. |
| `setupBrowserMocks(_, { quiet })` | `true` | `false` lets MSW log `[MSW] Mocking enabled` and every request it handles to the console. |
| `setupNodeMocks(handlers)` | required | The handlers to serve in Node. Starts listening immediately. |
| `mockRoutes(table)` | required | The route table: `{ name, method, path }` entries, from `routes.toJSON()` or `kitr api:sync`. |
| `mockRoutes(_, baseUrl)` | required | Prefixed to every path. `'*'` matches any origin; `'http://localhost:3333'` matches only that one. A trailing slash is removed. |
| `mockRoutes(_, _, resolvers)` | required | The answers, keyed by route name. A route without one answers `501`. |

Both setup functions start MSW with `onUnhandledFrame: 'bypass'`: a request that no handler matches goes to the real network, silently. You fake one endpoint and keep the rest.

## Fake your first endpoint

Add a handler for the request your screen makes. This one answers the invoice list with three invoices:

```ts
// app/mocks/handlers.ts
import { HttpResponse, http } from 'kitr/mocks'

export const handlers = [
  http.get('*/api/me', () =>
    HttpResponse.json({ id: 'u_ada', email: 'ada@acme.com', name: 'Ada', role: 'admin' }),
  ),
  http.get('*/api/invoices', () =>
    HttpResponse.json([
      { id: 'inv_1001', customer: 'Grace', amount: 120, status: 'paid' },
      { id: 'inv_1002', customer: 'Linus', amount: 300, status: 'open' },
      { id: 'inv_1003', customer: 'Grace', amount: 80, status: 'draft' },
    ]),
  ),
]
```

Set `VITE_MOCKS=true` in `.env`, restart `kitr dev`, and open the invoices page. The list shows the three invoices, and the browser's network panel shows each request answered `from service worker`.

The leading `*` matches any origin, so the handler answers whether your [http](/packages/http) client calls `http://localhost:3333/api/invoices` in development or `https://app.acme.com/api/invoices` in a preview. `http` and `HttpResponse` are MSW's own, so everything in [MSW's docs](https://mswjs.io/docs/http) applies.

## Turn mocks on in the browser

MSW needs its worker script served from your site's root. Copy it into `public/` once, and commit it:

```sh
npx msw init public --save
```

`--save` records the folder in `package.json`, so MSW updates the file when you upgrade it. Then start the worker in `app/client.tsx`, before the app boots, so the first request is already mocked:

```tsx
// app/client.tsx
import { StartClient } from '@tanstack/react-start/client'
import { StrictMode, startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { app } from './app'

async function start() {
  if (import.meta.env.DEV && import.meta.env.VITE_MOCKS === 'true') {
    const { enableMocks } = await import('#app/mocks/browser')
    await enableMocks()
  }
  await app.boot()
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    )
  })
}

start()
```

The dynamic `import()` keeps MSW and your fake data out of the production bundle, and `import.meta.env.DEV` is `false` in every production build, so mocks never run there even if `VITE_MOCKS` is set.

Don't write `if (import.meta.env.VITE_MOCKS)`: env variables are strings, and `'false'` is truthy.

In a server-rendered app, the first page load renders on the server, where the browser's worker cannot see it. Loaders that fetch during that render hit the real API. Requests made after hydration, and every request in a single-page app, go through the mocks.

## Write handlers

A handler pairs a method and a URL pattern with a function that returns a response. Use `:name` for path params, read the query string from `request.url`, and read the body with `request.json()`:

```ts
// app/mocks/handlers.ts
import { HttpResponse, http } from 'kitr/mocks'

export const handlers = [
  http.get('*/api/invoices/:id', ({ params }) =>
    HttpResponse.json({ id: params.id, customer: 'Grace', amount: 120, status: 'paid' }),
  ),

  http.get('*/api/invoices', ({ request }) => {
    const status = new URL(request.url).searchParams.get('status')
    return HttpResponse.json([{ id: 'inv_1002', customer: 'Linus', amount: 300, status }])
  }),

  http.post('*/api/invoices', async ({ request }) => {
    const input = (await request.json()) as { customer: string; amount: number }
    return HttpResponse.json(
      { id: 'inv_1004', status: 'draft', ...input },
      { status: 201, headers: { location: '/api/invoices/inv_1004' } },
    )
  }),

  http.delete('*/api/invoices/:id', () => new HttpResponse(null, { status: 204 })),
]
```

`HttpResponse.json(body, init)` sets `content-type: application/json`. `HttpResponse.text()`, `HttpResponse.xml()` and a plain `new HttpResponse(body, init)` cover everything else. When two handlers match the same request, the first in the list wins.

## Keep fake data in one place

Handlers that return literal objects drift apart: the list says Grace owes 120, the detail page says 80. Put the records in one module and make the handlers read and write it, so creating an invoice makes it appear in the list:

```ts
// app/mocks/data.ts
export interface Invoice {
  id: string
  customer: string
  amount: number
  status: 'draft' | 'open' | 'paid'
}

export const invoices: Invoice[] = [
  { id: 'inv_1001', customer: 'Grace', amount: 120, status: 'paid' },
  { id: 'inv_1002', customer: 'Linus', amount: 300, status: 'open' },
  { id: 'inv_1003', customer: 'Grace', amount: 80, status: 'draft' },
]
```

```ts
// app/mocks/handlers.ts
import { HttpResponse, http } from 'kitr/mocks'
import { type Invoice, invoices } from './data'

export const handlers = [
  http.get('*/api/invoices', () => HttpResponse.json(invoices)),

  http.post('*/api/invoices', async ({ request }) => {
    const input = (await request.json()) as Pick<Invoice, 'customer' | 'amount'>
    const invoice: Invoice = { id: `inv_${1001 + invoices.length}`, status: 'draft', ...input }
    invoices.push(invoice)
    return HttpResponse.json(invoice, { status: 201 })
  }),
]
```

The array lives as long as the page, or the test file. Reload the browser and it starts over, which is usually what you want while you design.

## Mock a whole route table

With the [API](/packages/api) package, every route has a name. `mockRoutes` builds one handler per route in the table, and you write only the answers, keyed by name:

```ts
// app/mocks/handlers.ts
import { KitrError } from 'kitr/app'
import { HttpResponse, mockRoutes } from 'kitr/mocks'
import { routeTable } from '#app/api/routes.gen'
import { type Invoice, invoices } from './data'

export const handlers = mockRoutes([...routeTable], '*', {
  'invoices.index': ({ request }) => {
    const status = new URL(request.url).searchParams.get('status')
    return status ? invoices.filter((invoice) => invoice.status === status) : invoices
  },
  'invoices.show': ({ params }) => {
    const invoice = invoices.find((i) => i.id === params.id)
    if (!invoice) throw KitrError.notFound(`Invoice ${params.id}`)
    return invoice
  },
  'invoices.store': async ({ body }) => {
    const input = (await body()) as Pick<Invoice, 'customer' | 'amount'>
    const invoice: Invoice = { id: `inv_${1001 + invoices.length}`, status: 'draft', ...input }
    invoices.push(invoice)
    return HttpResponse.json(invoice, { status: 201 })
  },
  'invoices.destroy': () => undefined,
  'auth.me': { id: 'u_ada', email: 'ada@acme.com', role: 'admin' },
})
```

`routeTable` is the file `kitr api:sync` writes for the typed client: names, methods and paths, with no server code. Import it in browser mocks. In a test, `routes.toJSON()` from `#server/routes` gives the same list.

What a resolver can be, and what the request gets back:

| Resolver | Response |
| --- | --- |
| A value, not a function: `{ id: 'u_ada' }` | `200` with that value as JSON, for every request. |
| A function returning a value | `200` with the value as JSON. |
| A function returning `undefined` | `204` with no body. |
| A function returning a `Response` | That response, as is. Use it for other statuses and headers. |
| A function that throws a `KitrError` | That error's status and JSON, as the real server sends it. |
| A function that throws anything else | `500` with `code: 'INTERNAL'` and the error's message. |
| No entry for the route | `501` with `code: 'UNAVAILABLE'` and `No mock for invoices.update`. |

A resolver function receives `params` (the path params), `request` (the `Request`) and `body()`, which reads the body as JSON. An entry whose value is `undefined` counts as no entry and answers `501`; write `() => undefined` for a `204`.

The `501` is on purpose. A route you forgot to mock fails loudly with its name, instead of quietly reaching a backend that does not exist yet.

## Send an error response

Error screens are the hardest states to see in development. `kitrErrorResponse()` turns any error into the JSON response a kitr server would send, so the [http](/packages/http) client turns it back into the same `KitrError` your error handling expects:

```ts
// app/mocks/handlers.ts
import { KitrError } from 'kitr/app'
import { http, kitrErrorResponse } from 'kitr/mocks'

export const handlers = [
  http.post('*/api/invoices/:id/refund', () =>
    kitrErrorResponse(KitrError.forbidden('Only admins can refund')),
  ),
  http.get('*/api/invoices/export', () =>
    kitrErrorResponse(new KitrError('RATE_LIMITED', 'Try again in a minute')),
  ),
  http.get('*/api/ledger', () => kitrErrorResponse(new Error('Ledger offline'))),
]
```

The three responses:

```json
{ "code": "FORBIDDEN", "message": "Only admins can refund", "status": 403 }
{ "code": "RATE_LIMITED", "message": "Try again in a minute", "status": 429 }
{ "code": "INTERNAL", "message": "Ledger offline", "status": 500 }
```

A `KitrError` keeps its code, message, status, `fieldErrors` and `data`. Anything else becomes `INTERNAL` with status `500` and its message. Inside `mockRoutes`, throwing does the same thing without the call.

## Show server validation errors in a form

`mockValidationError(method, url, fieldErrors)` answers with a `422` validation error. It is the quickest way to check that a form shows the server's messages under the right fields:

```ts
// app/mocks/handlers.ts
import { mockValidationError } from 'kitr/mocks'

export const handlers = [
  mockValidationError('post', '*/api/invoices', {
    customer: ['Customer is required'],
    amount: ['Amount must be greater than 0'],
  }),
]
```

```json
{
  "code": "VALIDATION",
  "message": "Validation failed",
  "status": 422,
  "fieldErrors": {
    "customer": ["Customer is required"],
    "amount": ["Amount must be greater than 0"]
  }
}
```

`method` is `'post'`, `'put'` or `'patch'`. With [forms](/packages/forms), each message appears under its field when the submit rejects. Keys can be nested paths such as `'lines.0.amount'`.

## Simulate a slow or failed request

Loading spinners and retry buttons need slow and broken responses. MSW's `delay` pauses a handler; `HttpResponse.error()` makes `fetch` reject as if the network were down. Import `delay` from `msw` itself, which `kitr add mocks` installed:

```ts
// app/mocks/handlers.ts
import { HttpResponse, http } from 'kitr/mocks'
import { delay } from 'msw'
import { invoices } from './data'

export const handlers = [
  http.get('*/api/invoices', async () => {
    await delay(1500)
    return HttpResponse.json(invoices)
  }),
  http.get('*/api/invoices/:id/pdf', () => HttpResponse.error()),
]
```

`delay()` with no argument waits a short, realistic random time; `delay('infinite')` never answers, for testing a spinner. A `fetch` to the PDF route rejects instead of resolving, so the code path for a dropped connection runs.

## Mock a third-party API

Handlers match full URLs too, so the same file fakes services you don't own. This stands in for a currency API the invoice screen calls directly from the browser:

```ts
// app/mocks/handlers.ts
import { HttpResponse, http } from 'kitr/mocks'

export const handlers = [
  http.get('https://api.exchangerate.host/latest', ({ request }) => {
    const base = new URL(request.url).searchParams.get('base') ?? 'EUR'
    return HttpResponse.json({ base, rates: { USD: 1.08, GBP: 0.85 } })
  }),
]
```

Requests to any other host go to the real network.

## Use mocks in tests

In a test, `setupNodeMocks(handlers)` starts MSW in Node and returns MSW's server. Start it once per file, reset per-test overrides after each test, and close it at the end:

```ts
// app/features/invoices/invoices.test.ts
import { setupNodeMocks } from 'kitr/mocks'
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest'
import { handlers } from '#app/mocks/handlers'

let mocks: Awaited<ReturnType<typeof setupNodeMocks>>
beforeAll(async () => {
  mocks = await setupNodeMocks(handlers)
})
afterEach(() => mocks.resetHandlers())
afterAll(() => mocks.close())

it('lists open invoices', async () => {
  const res = await fetch('https://app.acme.com/api/invoices?status=open')
  expect(await res.json()).toEqual([
    { id: 'inv_1002', customer: 'Linus', amount: 300, status: 'open' },
  ])
})
```

Any code that calls `fetch` sees the mocks: your components, the query cache, the http client. Under `happy-dom` a relative URL such as `/api/invoices` resolves against `http://localhost:3000`, which `*/api/invoices` matches. In the `node` environment there is no page URL, so use absolute URLs there.

To render a component against these mocks, combine them with `renderWithKitr` from [testing](/packages/testing#fake-the-network-for-components).

## Override a handler for one test

`mocks.use()` puts handlers in front of the list until the next `resetHandlers()`. Use it to give one test the empty state or the error it needs, without touching the shared handlers:

```ts
// app/features/invoices/invoices.test.ts
import { KitrError } from 'kitr/app'
import { HttpResponse, http, kitrErrorResponse, setupNodeMocks } from 'kitr/mocks'
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest'
import { handlers } from '#app/mocks/handlers'

let mocks: Awaited<ReturnType<typeof setupNodeMocks>>
beforeAll(async () => {
  mocks = await setupNodeMocks(handlers)
})
afterEach(() => mocks.resetHandlers())
afterAll(() => mocks.close())

it('shows the empty state', async () => {
  mocks.use(http.get('*/api/invoices', () => HttpResponse.json([])))
  expect(await (await fetch('/api/invoices')).json()).toEqual([])
})

it('shows the permission error', async () => {
  mocks.use(http.get('*/api/invoices', () => kitrErrorResponse(KitrError.forbidden())))
  const res = await fetch('/api/invoices')
  expect(res.status).toBe(403)
})

it('is back to the shared handlers', async () => {
  expect((await fetch('/api/invoices')).status).toBe(200)
})
```

Don't call `setupNodeMocks` inside each test. Start it once in `beforeAll` and override with `use()`, so every test starts from the same handlers. MSW's [server API](https://mswjs.io/docs/api/setup-server) documents `use`, `resetHandlers`, `restoreHandlers` and `listHandlers`.

## Turn mocks off

Set `VITE_MOCKS=false` in `.env` and restart `kitr dev`. The next page load starts no worker, and the real API answers. To mock one endpoint and use the real backend for the rest, keep `VITE_MOCKS=true` and delete every other handler: unmatched requests always go to the network.

Production builds never start the worker, because the check in `app/client.tsx` requires `import.meta.env.DEV`.

## Errors

The responses `kitr/mocks` builds itself:

| Code | When | What to do |
| --- | --- | --- |
| `UNAVAILABLE` (501) | `mockRoutes` got a request for a route with no resolver: `No mock for invoices.update`. | Add a resolver under that route name, or remove the route from the table you pass. |
| `INTERNAL` (500) | A resolver threw something that is not a `KitrError`, or `kitrErrorResponse` got a plain error. | Throw a `KitrError` with the code you mean, or fix the resolver. |
| `VALIDATION` (422) | `mockValidationError` answered. | Expected: the form should show `fieldErrors`. |

When the browser shows `Failed to register a ServiceWorker` or a 404 for `/mockServiceWorker.js`, the worker file is missing. Run `npx msw init public --save`.

## Testing

Your handlers are the contract the frontend is built against, so test them like code. This test starts the real `app/mocks/handlers.ts` in Node and checks the answers the invoices screen relies on, including that creating an invoice makes it show up in the list:

```ts
// app/mocks/handlers.test.ts
import { setupNodeMocks } from 'kitr/mocks'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { handlers } from './handlers'

const api = 'https://app.acme.com/api'
let mocks: Awaited<ReturnType<typeof setupNodeMocks>>

beforeAll(async () => {
  mocks = await setupNodeMocks(handlers)
})
afterAll(() => mocks.close())

describe('invoice mocks', () => {
  it('filters the list by status', async () => {
    const res = await fetch(`${api}/invoices?status=draft`)
    expect(await res.json()).toEqual([
      { id: 'inv_1003', customer: 'Grace', amount: 80, status: 'draft' },
    ])
  })

  it('answers 404 in the kitr error shape', async () => {
    const res = await fetch(`${api}/invoices/inv_9999`)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({
      code: 'NOT_FOUND',
      message: 'Invoice inv_9999 not found',
      status: 404,
    })
  })

  it('adds a created invoice to the list', async () => {
    const created = await fetch(`${api}/invoices`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ customer: 'Ada', amount: 45 }),
    })
    expect(created.status).toBe(201)
    expect(await created.json()).toEqual({
      id: 'inv_1004',
      status: 'draft',
      customer: 'Ada',
      amount: 45,
    })

    const list = (await (await fetch(`${api}/invoices`)).json()) as Array<{ id: string }>
    expect(list.map((invoice) => invoice.id)).toContain('inv_1004')
  })

  it('fails loudly for a route nobody mocked', async () => {
    const res = await fetch(`${api}/invoices/inv_1001`, { method: 'PATCH', body: '{}' })
    expect(res.status).toBe(501)
    expect(await res.json()).toMatchObject({ message: 'No mock for invoices.update' })
  })
})
```

The test uses the `mockRoutes` handlers from [Mock a whole route table](#mock-a-whole-route-table). Because they read `app/mocks/data.ts`, the third test's invoice stays in the list for the rest of the file; Vitest gives each file a fresh copy.

## Next steps

- [API reference](/packages/mocks/api): every export of `kitr/mocks`.
- [MSW docs](https://mswjs.io/docs): handlers, response helpers, GraphQL and WebSocket mocking.
- [Testing](/packages/testing): `createTestApp`, `renderWithKitr` and the API test client.
- [API](/packages/api): route names and `kitr api:sync`, which feed `mockRoutes`.
- [HTTP](/packages/http): the client that turns these responses back into `KitrError`s.
