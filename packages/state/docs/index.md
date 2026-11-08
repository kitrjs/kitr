---
title: State
description: Keep app-wide values like a cart or settings, and optionally save them in the browser.
order: 1
---

# State

Some values belong to the whole app, not one component: the order Ada is putting together, whether the sidebar is open, Linus's currency. `@kitr/state` is a small store any component can read and update, optionally saved across reloads.

> [!SUMMARY]
> A small store for app-wide values that live in the browser. Add it with `kitr add state`; the overview is at [/packages/state](/packages/state).

It is [Zustand](https://zustand.docs.pmnd.rs), re-exported, plus `createKitrStore`, which makes a store safe for server rendering, saves it in the browser when asked, and connects it to the Redux DevTools in development. The examples build Acme's order draft at `app.acme.com`.

## When to use it

Use a store for **client state**: values that live in the browser and that no server owns.

- A draft order or shopping cart before checkout.
- UI preferences such as theme, density, currency or a collapsed sidebar.
- A multi-step wizard's progress.
- A selection shared by distant components, such as the invoices ticked in a table and the bulk-action bar above it.

> [!WARNING]
> Don't use a store for **server data** such as orders or invoices. Use [Query](/packages/query), which caches and refetches it; a copy in a store goes stale as soon as someone else changes the record.

## Install

```sh
kitr add state
```

<details>
<summary>Everything kitr add changes</summary>

What `kitr add` does:

- Installs `@kitr/state` and `zustand`.
- Adds `@kitr/state` to `packages` in `kitrrc.ts`. There is no provider to register.
- Writes an empty `app/stores/.gitkeep`, so the folder for your stores exists.
- Adds a `## kitr: state` section to `AGENTS.md`: client state only, `kitr make:store <name>` writes `app/stores/<name>.ts` with `createKitrStore`, and server data belongs in queries.

</details>

`kitr add state` asks no questions. The `app`, `fullstack`, `saas`, `desktop` and `mobile` kits include it. To see the changes without writing them:

```sh
kitr add state --dry-run
```

<details>
<summary>What kitr remove does</summary>

`kitr remove state` removes the `packages` entry, both dependencies and the `AGENTS.md` section. It leaves `app/stores/` and your stores in place, and lists the files that still import `@kitr/state`.

</details>

## Configure

`@kitr/state` has no config file. Each store takes its options as the first argument of `createKitrStore`:

```ts
// app/stores/preferences.ts
import { createKitrStore } from '@kitr/state'

interface PreferencesState {
  currency: 'USD' | 'EUR'
  setCurrency: (currency: 'USD' | 'EUR') => void
}

export const [usePreferences, PreferencesProvider, preferencesStore] =
  createKitrStore<PreferencesState>(
    {
      name: 'preferences',
      persist: { version: 1 },
      devtools: true,
    },
    (set) => ({
      currency: 'USD',
      setCurrency: (currency) => set({ currency }),
    }),
  )
```

| Option | Default | Description |
| --- | --- | --- |
| `name` | required | Labels the store in the Redux DevTools and builds the storage key `kitr:<name>`. |
| `persist` | `false` | `true` saves the whole state to `localStorage`; an object takes Zustand's [persist options](https://zustand.docs.pmnd.rs/middlewares/persist). Only the browser touches storage. |
| `persist.name` | `'kitr:<name>'` | The storage key. |
| `persist.storage` | `localStorage`, as JSON | Where to save. Use `createJSONStorage(() => sessionStorage)` from `zustand/middleware` for one tab only. |
| `persist.partialize` | the whole state | A function that picks what to save. |
| `persist.version` | `0` | The saved shape's version. Saved data with another version goes through `migrate`, or is dropped without one. |
| `persist.migrate` | none | A function `(saved, version) => state` that upgrades old saved data. |
| `devtools` | `true` | Connects to the Redux DevTools in development; `false` leaves it out. |

The second argument is a Zustand state creator: it gets `set`, `get` and the store, and returns the initial state with its actions. `createKitrStore` returns three things, in this order:

| Value | Description |
| --- | --- |
| `useStore` | The hook. `useStore(selector)` returns a slice; `useStore()` returns the whole state. |
| `StoreProvider` | A component that gives its subtree a store. Needed on the server; optional in the browser. Takes `initialState`. |
| `store` | The browser's store instance, for code outside components. `null` on the server. |



## Create your first store

Put each store in `app/stores/`. This one holds the order Ada is building:

```ts
// app/stores/order-draft.ts
import { createKitrStore } from '@kitr/state'

export interface DraftLine {
  sku: string
  name: string
  price: number
  quantity: number
}

interface OrderDraftState {
  customer: string
  lines: DraftLine[]
  setCustomer: (customer: string) => void
  addLine: (line: Omit<DraftLine, 'quantity'>) => void
  removeLine: (sku: string) => void
  clear: () => void
}

export const [useOrderDraft, OrderDraftProvider, orderDraftStore] =
  createKitrStore<OrderDraftState>({ name: 'order-draft', persist: true }, (set) => ({
    customer: '',
    lines: [],
    setCustomer: (customer) => set({ customer }),
    addLine: (line) =>
      set((state) => {
        const existing = state.lines.find((l) => l.sku === line.sku)
        if (!existing) return { lines: [...state.lines, { ...line, quantity: 1 }] }
        return {
          lines: state.lines.map((l) => (l.sku === line.sku ? { ...l, quantity: l.quantity + 1 } : l)),
        }
      }),
    removeLine: (sku) => set((state) => ({ lines: state.lines.filter((l) => l.sku !== sku) })),
    clear: () => set({ customer: '', lines: [] }),
  }))
```

Then use it from any two components, however far apart:

```ts
// app/routes.ts
r.page('/orders/new', { lazy: () => import('./pages/orders/new') })
```

```tsx
// app/pages/orders/new.tsx
import { useOrderDraft } from '#app/stores/order-draft'

function AddLicense() {
  const addLine = useOrderDraft((s) => s.addLine)
  return (
    <button type="button" onClick={() => addLine({ sku: 'acme-seat', name: 'Acme seat', price: 12 })}>
      Add a seat
    </button>
  )
}

function DraftCount() {
  const count = useOrderDraft((s) => s.lines.reduce((sum, l) => sum + l.quantity, 0))
  return <p>{count} items in this order</p>
}

export default function NewOrderPage() {
  return (
    <main>
      <DraftCount />
      <AddLicense />
    </main>
  )
}
```

Open `/orders/new` and press **Add a seat** three times: the count reads `3 items in this order`, and still does after a reload, because `persist: true` saved the draft under `kitr:order-draft`. `kitr make:store` writes a starter store; see [Commands](#commands).

## Read a value in a component

Pass a selector to the hook; the component re-renders only when the selected value changes:

```tsx
// app/components/orders/draft-customer.tsx
import { useOrderDraft } from '#app/stores/order-draft'

export function DraftCustomer() {
  const customer = useOrderDraft((s) => s.customer)
  const setCustomer = useOrderDraft((s) => s.setCustomer)
  return (
    <label>
      Customer
      <input value={customer} onChange={(e) => setCustomer(e.target.value)} />
    </label>
  )
}
```

Actions are part of the state, and they never change, so selecting one never causes a re-render.

Calling the hook with no selector (`useOrderDraft()`) returns the whole state and re-renders on every change, so keep that for small stores or debugging.

## Select several values at once

A selector that builds a new object on every call, such as `(s) => ({ customer: s.customer })`, returns a different value each time and React keeps re-rendering. Call the hook once per value, or wrap the selector in Zustand's `useShallow`:

```tsx
// app/components/orders/draft-header.tsx
import { useShallow } from 'zustand/react/shallow'
import { useOrderDraft } from '#app/stores/order-draft'

export function DraftHeader() {
  const { customer, count } = useOrderDraft(
    useShallow((s) => ({ customer: s.customer, count: s.lines.length })),
  )
  return (
    <h2>
      Draft for {customer || 'a new customer'} ({count} lines)
    </h2>
  )
}
```

Derived numbers and strings need no `useShallow`.

## Change state with actions

`set` merges a partial state into the current one: pass an object, or a function when the new value depends on the old one:

```ts
// app/stores/invoice-selection.ts
import { createKitrStore } from '@kitr/state'

interface InvoiceSelectionState {
  selected: string[]
  toggle: (invoiceId: string) => void
  selectAll: (invoiceIds: string[]) => void
  clear: () => void
  isSelected: (invoiceId: string) => boolean
}

export const [useInvoiceSelection, InvoiceSelectionProvider, invoiceSelectionStore] =
  createKitrStore<InvoiceSelectionState>({ name: 'invoice-selection' }, (set, get) => ({
    selected: [],
    toggle: (id) =>
      set((s) => ({
        selected: s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id],
      })),
    selectAll: (ids) => set({ selected: ids }),
    clear: () => set({ selected: [] }),
    isSelected: (id) => get().selected.includes(id),
  }))
```

`get()` reads the current state inside an action. Keep logic in actions, not components.

> [!WARNING]
> Don't mutate the state in place (`s.selected.push(id)`). `set` compares by reference, so a mutated array looks unchanged and nothing re-renders. Return a new array or object.

## Read and change state outside React

The third value is the browser's store instance, for code that is not a component, such as a route loader or a mutation's `onSuccess`:

```ts
// app/lib/orders/place-order.ts
import { orderDraftStore } from '#app/stores/order-draft'

export async function placeDraftOrder() {
  const draft = orderDraftStore?.getState()
  if (!draft || draft.lines.length === 0) return
  await fetch('/api/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ customer: draft.customer, lines: draft.lines }),
  })
  orderDraftStore?.getState().clear()
}
```

| Method | What it does |
| --- | --- |
| `getState()` | Returns the current state, actions included. |
| `setState(partial)` | Merges `partial` (or the result of a function of the state) into the state. |
| `setState(state, true)` | Replaces the whole state. Include the actions, or they are gone. |
| `subscribe(listener)` | Calls `listener(state, previous)` after every change. Returns a function that stops it. |
| `getInitialState()` | Returns the state the creator first produced. |

`subscribe` reacts to changes outside React; this keeps the page title in step with the draft:

```ts
// app/lib/orders/draft-title.ts
import { orderDraftStore } from '#app/stores/order-draft'

export const stopDraftTitle = orderDraftStore?.subscribe((state, previous) => {
  if (state.lines.length !== previous.lines.length)
    document.title = state.lines.length ? `(${state.lines.length}) Acme` : 'Acme'
})
```

The store is `null` on the server, hence the `?.`. In browser-only code such as a click handler, write `orderDraftStore!`.

## Save state in the browser

With `persist: true`, the whole state is saved to `localStorage` under `kitr:<name>` after every change and restored on load:

```ts
// In the browser console after adding one seat
JSON.parse(localStorage.getItem('kitr:order-draft')!)
// => { state: { customer: '', lines: [{ sku: 'acme-seat', name: 'Acme seat', price: 12, quantity: 1 }] }, version: 0 }
```

Actions are not saved; they come from the creator each time. Pass an object to control what is saved. Here `partialize` keeps the lines across a reload but not the customer:

```ts
// app/stores/order-draft.ts
import { createKitrStore } from '@kitr/state'
import type { DraftLine } from './types'

interface OrderDraftState {
  customer: string
  lines: DraftLine[]
  clear: () => void
}

export const [useOrderDraft, OrderDraftProvider, orderDraftStore] =
  createKitrStore<OrderDraftState>(
    {
      name: 'order-draft',
      persist: {
        partialize: (state) => ({ lines: state.lines }),
      },
    },
    (set) => ({
      customer: '',
      lines: [],
      clear: () => set({ customer: '', lines: [] }),
    }),
  )
```

> [!WARNING]
> `localStorage` is readable by any script on the page and survives sign-out. Never persist tokens, passwords or personal data; use [Secure storage](/packages/secure-storage) for secrets.

## Change the saved shape

When the state's shape changes, bump `version` and give `migrate` a function that upgrades old data. Without `migrate`, data from another version is dropped:

```ts
// app/stores/preferences.ts
import { createKitrStore } from '@kitr/state'

interface PreferencesState {
  currency: 'USD' | 'EUR'
  density: 'comfortable' | 'compact'
  setDensity: (density: 'comfortable' | 'compact') => void
}

export const [usePreferences, PreferencesProvider, preferencesStore] =
  createKitrStore<PreferencesState>(
    {
      name: 'preferences',
      persist: {
        version: 2,
        migrate: (saved, version) => {
          const old = saved as { currency?: 'USD' | 'EUR'; compact?: boolean }
          // Version 1 stored a boolean `compact`; version 2 stores `density`.
          if (version < 2) return { currency: old.currency ?? 'USD', density: old.compact ? 'compact' : 'comfortable' }
          return old as Partial<PreferencesState>
        },
      },
    },
    (set) => ({
      currency: 'USD',
      density: 'comfortable',
      setDensity: (density) => set({ density }),
    }),
  )
```

## Save for one tab only

`sessionStorage` keeps state per tab and clears it when the tab closes, so Grace can run a wizard in two tabs without them mixing:

```ts
// app/stores/import-wizard.ts
import { createKitrStore } from '@kitr/state'
import { createJSONStorage } from 'zustand/middleware'

interface ImportWizardState {
  step: 1 | 2 | 3
  fileName: string | null
  next: () => void
  back: () => void
}

export const [useImportWizard, ImportWizardProvider, importWizardStore] =
  createKitrStore<ImportWizardState>(
    { name: 'import-wizard', persist: { storage: createJSONStorage(() => sessionStorage) } },
    (set) => ({
      step: 1,
      fileName: null,
      next: () => set((s) => ({ step: Math.min(3, s.step + 1) as 1 | 2 | 3 })),
      back: () => set((s) => ({ step: Math.max(1, s.step - 1) as 1 | 2 | 3 })),
    }),
  )
```

## Seed a store for a page

`StoreProvider` takes `initialState`, merged over the creator's state when the provider mounts. Use it to start a store from loader data, such as the customer of the order Linus is editing:

```ts
// app/routes.ts
import { orderQuery } from '#app/queries/orders'

r.page('/orders/$orderId/edit', {
  loader: ({ context, params }) => context.queryClient.ensureQueryData(orderQuery.options(params.orderId)),
  lazy: () => import('./pages/orders/orderId/edit'),
})
```

```tsx
// app/pages/orders/orderId/edit.tsx
import { OrderDraftProvider } from '#app/stores/order-draft'
import { DraftEditor } from '#app/components/orders/draft-editor'
import { getRouteApi } from '@kitr/router'

const route = getRouteApi('/orders/$orderId/edit')

export default function EditOrderPage() {
  const order = route.useLoaderData()
  return (
    <OrderDraftProvider initialState={{ customer: order.customer }}>
      <DraftEditor />
    </OrderDraftProvider>
  )
}
```

<details>
<summary>How initialState behaves in the browser and on the server</summary>

In the browser the store is shared by the whole app, so `initialState` is written into that one store when the provider mounts. It overrides values restored from storage, and components outside the provider see it too. On the server each provider builds its own store with `initialState` applied.

</details>

## Render on the server

One server process renders pages for many users, so a module-level store would leak Ada's draft into Grace's page. `createKitrStore` avoids that:

- **In the browser**, the store is one module-level instance, read without a provider.
- **On the server**, each `<StoreProvider>` creates a fresh store for its render, and storage is never touched.

If a page renders on the server (`ssr` or `static` mode), wrap the part of the tree that reads the store:

```tsx
// app/document.tsx
import { HeadContent, Outlet, Scripts } from '@kitr/router'
import { OrderDraftProvider } from '#app/stores/order-draft'

export function RootDocument() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <OrderDraftProvider>
          <Outlet />
        </OrderDraftProvider>
        <Scripts />
      </body>
    </html>
  )
}
```

Without a provider, the server render fails with:

```txt
[@kitr/state] Store "order-draft" has no instance on the server. Wrap the tree in its <StoreProvider>.
```

In a client-only app (`spa` mode, desktop, mobile) skip the provider.

<details>
<summary>Persisted stores and hydration</summary>

The server cannot read browser storage, so a saved store renders its initial state there. The browser's first render uses the same state, so React sees no mismatch, and the saved state follows in a second render.

</details>

## Use plain Zustand

`@kitr/state` re-exports `zustand` unchanged, so `create`, `createStore` and `useStore` work as in the [Zustand docs](https://zustand.docs.pmnd.rs). A store made with `create` is a singleton on the server too, so use it only in client-only apps or for state that is the same for every user:

```ts
// app/stores/toasts.ts
import { create } from '@kitr/state'

interface ToastState {
  messages: string[]
  push: (message: string) => void
}

export const useToasts = create<ToastState>()((set) => ({
  messages: [],
  push: (message) => set((s) => ({ messages: [...s.messages, message] })),
}))
```

## Commands

| Command | What it does |
| --- | --- |
| `kitr make:store <name>` | Writes `app/stores/<name>.ts` with a `createKitrStore` store: a `count`, an `increment` and a `reset` action, not persisted. |

```sh
kitr make:store order-draft
```

It writes `app/stores/order-draft.ts`. The file name is kebab-case; the exports are camel and pascal case:

```ts
// app/stores/order-draft.ts
import { createKitrStore } from '@kitr/state'

interface OrderDraftState {
  count: number
  increment: () => void
  reset: () => void
}

export const [useOrderDraftStore, OrderDraftStoreProvider, orderDraftStore] = createKitrStore<OrderDraftState>(
  { name: 'order_draft', persist: false },
  (set) => ({
    count: 0,
    increment: () => set((s) => ({ count: s.count + 1 })),
    reset: () => set({ count: 0 }),
  }),
)
```

Replace the state with your own. `--force` overwrites an existing file; `kitr eject stub store` lets you edit the template in `stubs/store.ts`.

## Testing

In a DOM test (Vitest with `happy-dom` or `jsdom`) the store is the browser singleton and keeps its state between tests. Reset it in `beforeEach`, and clear `localStorage` if it persists:

```tsx
// app/stores/order-draft.test.tsx
import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { orderDraftStore, useOrderDraft } from './order-draft'

function DraftCount() {
  const count = useOrderDraft((s) => s.lines.reduce((sum, l) => sum + l.quantity, 0))
  return <p>{count} items</p>
}

describe('order draft', () => {
  beforeEach(() => {
    localStorage.clear()
    orderDraftStore!.setState({ customer: '', lines: [] })
  })

  it('adds a line and bumps its quantity', () => {
    const { addLine } = orderDraftStore!.getState()
    addLine({ sku: 'acme-seat', name: 'Acme seat', price: 12 })
    addLine({ sku: 'acme-seat', name: 'Acme seat', price: 12 })
    expect(orderDraftStore!.getState().lines).toEqual([
      { sku: 'acme-seat', name: 'Acme seat', price: 12, quantity: 2 },
    ])
  })

  it('re-renders components that read it', () => {
    render(<DraftCount />)
    expect(screen.getByText('0 items')).toBeTruthy()
    act(() => orderDraftStore!.getState().addLine({ sku: 'acme-seat', name: 'Acme seat', price: 12 }))
    expect(screen.getByText('1 items')).toBeTruthy()
  })

  it('saves the draft under kitr:order-draft', () => {
    act(() => orderDraftStore!.getState().setCustomer('Ada'))
    expect(JSON.parse(localStorage.getItem('kitr:order-draft')!).state.customer).toBe('Ada')
  })
})
```

Wrap changes made outside React in `act()` when a component is rendered. To test the server render, use the `node` environment, where there is no singleton, and render through the provider:

```tsx
// app/stores/order-draft.server.test.tsx
// @vitest-environment node
import { renderToString } from 'react-dom/server'
import { expect, it } from 'vitest'
import { OrderDraftProvider, orderDraftStore, useOrderDraft } from './order-draft'

function Customer() {
  return <p>{useOrderDraft((s) => s.customer) || 'nobody'}</p>
}

it('gives every server render its own store', () => {
  expect(orderDraftStore).toBeNull()
  const ada = renderToString(
    <OrderDraftProvider initialState={{ customer: 'Ada' }}>
      <Customer />
    </OrderDraftProvider>,
  )
  const grace = renderToString(
    <OrderDraftProvider>
      <Customer />
    </OrderDraftProvider>,
  )
  expect(ada).toContain('Ada')
  expect(grace).toContain('nobody')
})
```

## Devtools

In development, each `set` shows up in the [Redux DevTools](https://github.com/reduxjs/redux-devtools) extension as an action with the state before and after, under the store's `name`. Production builds and `devtools: false` skip the connection.

## Next steps

- [API reference](/packages/state/api): every export and option.
- [Query](/packages/query): where server data belongs.
- [Forms](/packages/forms): form state and validation without a store.
