---
title: Build a dashboard on an existing API
description: A signed-in admin app with a sortable, paged table and a create form, against a backend you already have.
packages: router, query, http, auth, table, forms, mocks, testing
platforms: web
time: 45 min
---

# Build a dashboard on an existing API

Most teams already have a backend. What they need is the screen in front of it: sign in, see the records in a table, sort and page through them, create a new one, and trust that the table is right afterwards. This guide builds that screen for Acme's orders, from `kitr new` to a passing test.

You will build `acme-admin`, a single-page app where Ada signs in, sees every order in a table that keeps its sorting and paging in the URL, and creates orders with a form that shows the API's validation errors under the right fields. The backend is any REST API that speaks JSON. Until you point the app at yours, [Mocks](/packages/mocks) answers in its place, so you can follow every step without a server.

## Before you start

You need [Node.js](https://nodejs.org) 22 or newer and the kitr CLI (`npm install -g kitr`, see [Getting started](/docs/getting-started)). The guide assumes your API exposes these endpoints. Adjust the paths as you go if yours differ:

| Endpoint | Returns |
| --- | --- |
| `POST /sign-in` | `{ token }` for an email and password |
| `GET /me` | The signed-in user, for a bearer token |
| `GET /orders?page=&size=&sort=&status=` | `{ rows, total }`: one page of orders and the total count |
| `POST /orders` | The created order, or `422` with field errors |

## Create the project

The `app` kit is made for exactly this: a single-page web app that talks to an API someone else runs.

```sh
kitr new acme-admin --kit app
```

It installs and wires [Router](/packages/router), [Query](/packages/query), [HTTP](/packages/http), [Forms](/packages/forms), [Table](/packages/table), [State](/packages/state), [Tailwind](/packages/tailwind), [Theme](/packages/theme), [Auth](/packages/auth), [Storage](/packages/storage), [Mocks](/packages/mocks) and [Testing](/packages/testing), and copies a set of UI components into `app/components/ui/`. The parts this guide touches:

```
acme-admin/
├── app/
│   ├── routes.ts          # the route table: every page, as .page('/path', { lazy })
│   ├── pages/             # one component file per page
│   ├── components/ui/     # data-table, form, button, input, app-shell: yours to edit
│   ├── mocks/             # handlers.ts and browser.ts
│   ├── abilities.ts       # the User type and permission rules
│   ├── app.ts             # the app, built from kitrrc.ts and config/
│   └── router.tsx         # puts the session in the router context
├── config/
│   ├── auth.ts            # where sessions come from
│   └── http.ts            # the API's base URL and token
├── kitrrc.ts              # platforms: { site: web({ mode: 'spa' }) }
└── .env.example
```

Start it:

```sh
cd acme-admin
cp .env.example .env
npm run dev
```

`npm run dev` runs `kitr dev`, which starts the `site` web platform on `http://localhost:3000`. Edit `app/pages/home.tsx` and the page updates as you save.

## Point the app at your API

Every request goes through one HTTP client, configured in `config/http.ts`. It reads the base URL from `VITE_API_URL`, which `app/env.ts` validates when the app starts:

```ts
// config/http.ts
import { defineConfig } from 'kitr/http'
import { env } from '#app/env'

export default defineConfig({
  baseUrl: env.VITE_API_URL,
})
```

Set the URL of your API in `.env`. This guide uses `/api` under port 3333, which is what the mocks below answer:

```sh
# .env
VITE_API_URL=http://localhost:3333/api
VITE_MOCKS=true
```

`VITE_` variables are public: Vite inlines them into the browser bundle, so never put a secret in one. A malformed URL stops the app at startup with the variable's name in the message, not halfway through a request.

## Fake the API while you build

With `VITE_MOCKS=true`, [MSW](https://mswjs.io) answers requests in the browser before they reach the network. Write one handler per endpoint, with Acme's data:

```ts
// app/mocks/handlers.ts
import { KitrError } from 'kitr/app'
import { HttpResponse, http, kitrErrorResponse } from 'kitr/mocks'

const orders = [
  { id: 'ord_1042', customer: 'Ada', total: 129, status: 'paid', placedAt: '2026-10-02' },
  { id: 'ord_1043', customer: 'Grace', total: 480, status: 'open', placedAt: '2026-10-05' },
  { id: 'ord_1044', customer: 'Linus', total: 75, status: 'open', placedAt: '2026-10-09' },
]

export const handlers = [
  http.post('*/api/sign-in', () => HttpResponse.json({ token: 'tok_ada' })),
  http.get('*/api/me', () =>
    HttpResponse.json({ id: 'u_ada', email: 'ada@acme.com', role: 'admin' }),
  ),
  http.get('*/api/orders', ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const rows = status ? orders.filter((o) => o.status === status) : orders
    return HttpResponse.json({ rows, total: rows.length })
  }),
  http.post('*/api/orders', async ({ request }) => {
    const body = (await request.json()) as { customer: string; total: number }
    if (body.customer.length < 2)
      return kitrErrorResponse(KitrError.validation({ customer: ['Enter the customer’s name'] }))
    const order = { id: `ord_${1042 + orders.length}`, status: 'open', placedAt: '2026-10-10', ...body }
    orders.push(order)
    return HttpResponse.json(order, { status: 201 })
  }),
]
```

MSW needs its worker script served from the site's root. Copy it once and commit it:

```sh
npx msw init public --save
```

Then start the worker in the client entry, before the app boots, so the first request is already answered. The kit wrote `enableMocks()` in `app/mocks/browser.ts`; it does nothing unless `VITE_MOCKS` is `'true'` in development:

```tsx
// app/client.tsx
import { StartClient } from '@tanstack/react-start/client'
import { StrictMode, startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { app } from './app'

async function start() {
  if (import.meta.env.DEV) {
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

The dynamic `import()` keeps MSW and the fake orders out of the production bundle. When your real API is ready, set `VITE_MOCKS=false` and restart `kitr dev`; nothing else changes.

## Sign in

Two pieces of the app need the session: [Auth](/packages/auth), which signs users in and keeps their token, and the HTTP client, which sends that token with every request. Put the adapter in its own module so both can import it without importing each other:

```ts
// app/auth/adapter.ts
import { localStorageTokens, tokenAdapter } from 'kitr/auth'
import { type User, abilities } from '#app/abilities'
import { env } from '#app/env'

export const authAdapter = tokenAdapter<User>({
  abilities,
  storage: localStorageTokens(),
  fetchUser: async (token) => {
    const res = await fetch(`${env.VITE_API_URL}/me`, { headers: { authorization: `Bearer ${token}` } })
    return res.ok ? ((await res.json()) as User) : null
  },
  signIn: async (credentials) => {
    const res = await fetch(`${env.VITE_API_URL}/sign-in`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(credentials),
    })
    if (!res.ok) throw new Error('Wrong email or password')
    return (await res.json()) as { token: string }
  },
})
```

```ts
// config/auth.ts
import { defineConfig } from 'kitr/auth'
import { authAdapter } from '#app/auth/adapter'

export default defineConfig({ adapter: authAdapter, signInPath: '/sign-in' })
```

```ts
// config/http.ts
import { defineConfig } from 'kitr/http'
import { authAdapter } from '#app/auth/adapter'
import { env } from '#app/env'

export default defineConfig({
  baseUrl: env.VITE_API_URL,
  getToken: () => authAdapter.getToken?.(),
  onUnauthorized: () => window.location.assign('/sign-in'),
})
```

Every request now carries `Authorization: Bearer tok_ada` once Ada signs in, and a `401` from the API sends her back to the sign-in page. `localStorageTokens()` keeps the token across reloads; the [Auth guide](/packages/auth) explains when to keep it in memory instead.

Now the sign-in page. `requireAuth()` sends anonymous visitors here with the page they wanted in `?redirect=`, so send them back after a successful sign-in:

```ts
// app/routes.ts
r.page('/sign-in', {
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : '/orders',
  }),
  lazy: () => import('./pages/sign-in'),
})
```

```tsx
// app/pages/sign-in.tsx
import { useAuth } from 'kitr/auth'
import { getRouteApi, useNavigate } from 'kitr/router'
import { type FormEvent, useState } from 'react'
import type { User } from '#app/abilities'

const route = getRouteApi('/sign-in')

export default function SignInPage() {
  const { redirect } = route.useSearch()
  const navigate = useNavigate()
  const auth = useAuth<User, { email: string; password: string }>()
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    try {
      await auth.signIn({ email: String(data.get('email')), password: String(data.get('password')) })
      await navigate({ to: redirect })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto mt-24 grid max-w-sm gap-3">
      <h1 className="text-2xl font-semibold">Sign in to Acme</h1>
      {error && <p role="alert">{error}</p>}
      <input name="email" type="email" autoComplete="email" defaultValue="ada@acme.com" />
      <input name="password" type="password" autoComplete="current-password" />
      <button type="submit">Sign in</button>
    </form>
  )
}
```

## Protect every page behind the layout

`.layout()` wraps pages in a component without adding a URL segment. Put the guard and the app's chrome on it, and every page declared inside it needs a signed-in user:

```ts
// app/routes.ts
import { requireAuth } from 'kitr/router'

r.layout('_app', { beforeLoad: requireAuth(), lazy: () => import('./pages/app-layout') }, (app) =>
  app
    .page('/orders', { lazy: () => import('./pages/orders/index') })
    .page('/orders/new', { lazy: () => import('./pages/orders/new') }),
)
```

```tsx
// app/pages/app-layout.tsx
import { useAuth, useUser } from 'kitr/auth'
import { Outlet } from 'kitr/router'
import type { User } from '#app/abilities'
import { AppShell } from '#components/ui/app-shell'

export default function AppLayout() {
  const auth = useAuth()
  const user = useUser<User>()
  return (
    <AppShell
      brand="Acme admin"
      nav={[{ to: '/orders', label: 'Orders' }]}
      user={
        <button type="button" onClick={() => auth.signOut()}>
          Sign out {user?.email}
        </button>
      }
    >
      <Outlet />
    </AppShell>
  )
}
```

The kit's `app/router.tsx` already puts the auth session in the router context, which is what `requireAuth()` reads. Open `http://localhost:3000/orders` signed out and you land on `/sign-in?redirect=%2Forders`; sign in and you are back on `/orders`.

> **Warning**
> Route guards decide what the browser shows. They do not protect data: anyone can call your API without loading the page. Your API must check the token on every request it answers.

## Describe the orders

Each feature keeps its data in one `queries.ts`: the cache keys, the queries that read and the mutations that write. Let the CLI write a starting point:

```sh
kitr make:queries orders
```

It writes `app/features/orders/queries.ts` with a list query, a detail query and an update mutation over the HTTP client. Replace it with the two operations this screen needs: one page of orders for the table, and a create mutation:

```ts
// app/features/orders/queries.ts
import { createKeys } from 'kitr/app'
import { httpMutation, httpQuery } from 'kitr/http'
import { mutationFrom, queryFrom } from 'kitr/query'
import type { TableSearch } from 'kitr/table'
import { app } from '#app/app'

const http = () => app.container.use('http')
export const orderKeys = createKeys('orders')

export interface Order {
  id: string
  customer: string
  total: number
  status: 'open' | 'paid' | 'refunded'
  placedAt: string
}

export interface OrdersPage {
  rows: Order[]
  total: number
}

export const ordersPageQuery = queryFrom(
  httpQuery<TableSearch, OrdersPage>(http, {
    path: 'orders',
    key: (search) => orderKeys.list(search),
    searchParams: (search) => ({
      page: search.page,
      size: search.size,
      sort: search.sort,
      status: search.filter?.status,
    }),
  }),
)

export const createOrder = mutationFrom(
  httpMutation<{ customer: string; total: number }, Order>(http, {
    path: 'orders',
    effects: { invalidate: [orderKeys.lists()] },
  }),
)
```

Three things to notice:

- The whole table search is part of the key (`['orders', 'list', { page: 2, sort: '-total' }]`), so every page and sort order is cached on its own and the back button is instant.
- `searchParams` drops `undefined` values, so page 1 with no sort requests `/orders` and nothing more.
- `createOrder` declares what it changes: `invalidate: [orderKeys.lists()]` refetches every orders list, whatever its page or sort. No component has to remember to refresh the table. [Loading and saving data](/docs/data) explains the idea.

## Show the orders in a table

Columns describe what each cell shows. Keep them outside the component so the table does not rebuild them on every render:

```tsx
// app/features/orders/columns.tsx
import type { ColumnDef, DataTableFeatures } from 'kitr/table'
import type { Order } from './queries'

export const columns: ColumnDef<DataTableFeatures, Order>[] = [
  { accessorKey: 'id', header: 'Order', enableSorting: false },
  { accessorKey: 'customer', header: 'Customer' },
  { accessorKey: 'total', header: 'Total', cell: ({ row }) => `$${row.original.total.toFixed(2)}` },
  { accessorKey: 'status', header: 'Status', enableSorting: false },
  {
    accessorKey: 'placedAt',
    header: 'Placed',
    cell: ({ row }) => new Date(row.original.placedAt).toLocaleDateString('en-US'),
  },
]
```

The page validates the search params, loads the matching page before it renders, and binds the table's sorting and paging to the URL:

```ts
// app/routes.ts
import { parseTableSearch } from 'kitr/table'
import { ordersPageQuery } from '#app/features/orders/queries'

app.page('/orders', {
  validateSearch: parseTableSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(ordersPageQuery.options(deps)),
  lazy: () => import('./pages/orders/index'),
})
```

```tsx
// app/pages/orders/index.tsx
import { getRouteApi, Link } from 'kitr/router'
import { useSuspenseQuery } from 'kitr/query'
import { useUrlTableState } from 'kitr/table'
import { DataTable } from '#components/ui/data-table'
import { columns } from '#app/features/orders/columns'
import { ordersPageQuery } from '#app/features/orders/queries'

const route = getRouteApi('/_app/orders')

export default function OrdersPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const { data } = useSuspenseQuery(ordersPageQuery.options(search))
  const urlState = useUrlTableState({
    search,
    setSearch: (patch) => navigate({ search: (prev) => ({ ...prev, ...patch }) }),
  })

  return (
    <section className="grid gap-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <Link to="/orders/new">New order</Link>
      </header>
      <DataTable columns={columns} data={data.rows} rowCount={data.total} {...urlState} />
    </section>
  )
}
```

Open `/orders`: three rows. Click the Total header and the URL becomes `/orders?sort=-total`, the loader fetches that page and Grace's $480 order moves to the top. Reload and it is still sorted; share the URL and a teammate sees the same view.

`parseTableSearch` keeps what is valid in the URL and drops the rest, because anyone can edit a URL. The API should do the same: sort only by columns it allows. The [Table guide](/packages/table#fetch-one-page-from-the-server) shows the server half.

## Create an order with a form

Start with a schema. The form validates with it in the browser, and your API can validate with the same rules:

```ts
// app/features/orders/schema.ts
import { z } from 'zod'

export const newOrderSchema = z.object({
  customer: z.string().min(1, 'Enter the customer’s name'),
  total: z.coerce.number().positive('The total must be more than zero'),
})

export type NewOrder = z.output<typeof newOrderSchema>
```

The page runs the mutation with `mutateAsync` and goes back to the table when it succeeds:

```ts
// app/routes.ts
app.page('/orders/new', { lazy: () => import('./pages/orders/new') })
```

```tsx
// app/pages/orders/new.tsx
import { useNavigate } from 'kitr/router'
import { FieldInput, Form, FormField, SubmitButton, useSchemaForm } from 'kitr/forms'
import { useMutation } from 'kitr/query'
import { createOrder } from '#app/features/orders/queries'
import { newOrderSchema } from '#app/features/orders/schema'

export default function NewOrderPage() {
  const create = useMutation(createOrder)
  const navigate = useNavigate()
  const form = useSchemaForm(newOrderSchema, { defaultValues: { customer: '', total: '' } })

  return (
    <Form
      form={form}
      onSubmit={async (order) => {
        await create.mutateAsync(order)
        await navigate({ to: '/orders' })
      }}
      className="grid max-w-md gap-4 p-6"
    >
      <h1 className="text-2xl font-semibold">New order</h1>
      <FormField name="customer" label="Customer">
        <FieldInput autoComplete="off" />
      </FormField>
      <FormField name="total" label="Total (USD)">
        <FieldInput inputMode="decimal" />
      </FormField>
      <SubmitButton pendingText="Creating…">Create order</SubmitButton>
    </Form>
  )
}
```

Fill in `Linus` and `75`, press the button, and you are back on `/orders` with Linus's new order in the table. Nobody told the table to refresh: the mutation's `invalidate` effect did.

Now type a single letter as the customer and submit. The schema allows it, so the request goes out, and the API answers `422` with `{ fieldErrors: { customer: ['Enter the customer’s name'] } }`. `<Form>` puts that message under the Customer field. Use `mutateAsync`, not `mutate`: `mutate` swallows the error, so the form would never see it.

## Test the table

The kit includes [Testing](/packages/testing) and a `vitest.config.ts`. A component test renders the page's table with the app's providers and the same mock handlers you use in the browser, so the HTTP client, the query cache and the table all run as in production:

```tsx
// app/features/orders/orders-table.test.tsx
import { screen } from '@testing-library/react'
import httpProvider from 'kitr/http/provider'
import { setupNodeMocks } from 'kitr/mocks'
import { useSuspenseQuery } from 'kitr/query'
import queryProvider from 'kitr/query/provider'
import { createTestApp } from 'kitr/testing'
import { renderWithKitr } from 'kitr/testing/react'
import { Suspense } from 'react'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { handlers } from '#app/mocks/handlers'
import { ordersPageQuery } from './queries'

let mocks: Awaited<ReturnType<typeof setupNodeMocks>>
beforeAll(async () => {
  mocks = await setupNodeMocks(handlers)
})
afterAll(() => mocks.close())

function OrderCustomers() {
  const { data } = useSuspenseQuery(ordersPageQuery.options({ sort: '-total' }))
  return <p>{data.rows.map((order) => order.customer).join(', ')}</p>
}

it('loads the orders from the API', async () => {
  const app = await createTestApp({
    providers: [queryProvider, httpProvider],
    config: { http: { baseUrl: 'http://localhost:3333/api' } },
  })
  renderWithKitr(
    <Suspense fallback="Loading orders">
      <OrderCustomers />
    </Suspense>,
    { app },
  )
  expect(await screen.findByText('Ada, Grace, Linus')).toBeTruthy()
})
```

```sh
npm test
```

The mock handler above ignores `sort`, so the names come back in insertion order. Make it sort, or point the test at a staging API, when the order matters to you. The [Testing guide](/guides/testing) covers page tests, API tests and CI.

## Next steps

- [Add sign-in, end to end](/guides/authentication): refresh tokens, permissions and protecting the API side.
- [Table](/packages/table): filters, row selection, column visibility and client-side tables.
- [Forms](/packages/forms): editing an existing record, repeating fields and custom inputs.
- [Deploy to production](/guides/deploy): ship the `spa` build to any static host.
- [Deploy to production](/guides/deploy): ship the SPA to a static host.
