---
title: State
description: Keep app-wide values like a cart or settings, and optionally save them in the browser.
order: 1
---

# State

Some values belong to the whole app rather than one component: the order Ada is putting together before she submits it, whether the sidebar is open, which currency Linus prefers. `kitr/state` gives you a small store for those values that any component can read and update, and that can remember them across page reloads.

It is [Zustand](https://zustand.docs.pmnd.rs), re-exported, plus one helper, `createKitrStore`, that makes a store safe for server rendering, saves it in the browser when you ask, and connects it to the Redux DevTools in development.

It runs in the browser, and on the server while a page renders. For data a server owns, such as the list of orders or the signed-in user, use [Query](/packages/query) instead.

This guide builds Acme's order draft: the lines Ada adds before she places an order at `app.acme.com`.

## When to use it

Use a store for **client state**: values that live in the browser and that no server owns.

- A draft order or shopping cart before checkout.
- UI preferences such as theme, density, currency or a collapsed sidebar.
- A multi-step wizard's progress.
- A selection shared by distant components, such as the invoices ticked in a table and the bulk-action bar above it.

Don't use a store for **server data** such as Acme's orders, invoices or projects. That belongs in a query (see [Query](/packages/query)), which caches it, refetches it and updates it after a save. A copy in a store goes stale the moment someone else changes the record.

## Install

```sh
kitr add state
```

What `kitr add` does:

- Installs `@kitr/state` and `zustand`.
- Adds `@kitr/state` to `packages` in `kitrrc.ts`. There is no provider to register.
- Writes an empty `app/stores/.gitkeep`, so the folder for your stores exists.
- Adds a `## kitr: state` section to `AGENTS.md`: client state only, `kitr make:store <name>` writes `app/stores/<name>.ts` with `createKitrStore`, and server data belongs in queries.

`kitr add state` asks no questions. The `app`, `fullstack`, `saas`, `desktop` and `mobile` kits include it. To preview the changes without writing them:

```sh
kitr add state --dry-run
```

`kitr remove state` removes the `packages` entry, both dependencies and the `AGENTS.md` section. It leaves `app/stores/` and your stores in place, and lists the files that still import `kitr/state`.

## Configure

`kitr/state` has no config file. Each store takes its options as the first argument of `createKitrStore`:

```ts
// app/stores/preferences.ts
import { createKitrStore } from 'kitr/state'

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
| `name` | required | The store's name. It labels the store in the Redux DevTools and builds the storage key `kitr:<name>`. |
| `persist` | `false` | `true` saves the whole state to `localStorage`. An object saves it with any of Zustand's [persist options](https://zustand.docs.pmnd.rs/middlewares/persist). Only the browser reads or writes storage. |
| `persist.name` | `'kitr:<name>'` | The storage key. |
| `persist.storage` | `localStorage`, as JSON | Where to save. Use `createJSONStorage(() => sessionStorage)` from `zustand/middleware` for one tab only. |
| `persist.partialize` | the whole state | A function that picks what to save. |
| `persist.version` | `0` | The saved shape's version. Saved data with another version goes through `migrate`, or is dropped without one. |
| `persist.migrate` | none | A function `(saved, version) => state` that upgrades old saved data. |
| `devtools` | `true` | Connects the store to the [Redux DevTools](https://github.com/reduxjs/redux-devtools) extension in development. Set `false` to leave it out. Production builds never connect. |

The second argument is a Zustand state creator: a function that gets `set`, `get` and the store, and returns the initial state with its actions.

`createKitrStore` returns three things, in this order:

| Value | Description |
| --- | --- |
| `useStore` | The hook. `useStore(selector)` returns a slice; `useStore()` returns the whole state. |
| `StoreProvider` | A component that gives its subtree a store. Needed on the server; optional in the browser. Takes `initialState`. |
| `store` | The browser's store instance, for code outside components. `null` on the server. |

Name them after the store, as in `[useOrderDraft, OrderDraftProvider, orderDraftStore]`.

## Create your first store

Put each store in `app/stores/`. This one holds the order Ada is building:

```ts
// app/stores/order-draft.ts
import { createKitrStore } from 'kitr/state'

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

```tsx
// app/routes/orders/new.tsx
import { createFileRoute } from '@tanstack/react-router'
import { useOrderDraft } from '#app/stores/order-draft'

export const Route = createFileRoute('/orders/new')({
  component: NewOrderPage,
})

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

function NewOrderPage() {
  return (
    <main>
      <DraftCount />
      <AddLicense />
    </main>
  )
}
```

Open `/orders/new` and press **Add a seat** three times: the count reads `3 items in this order`. Reload the page and it still reads 3, because `persist: true` saved the draft to `localStorage` under `kitr:order-draft`.

`kitr make:store` writes a starter store for you; see [Commands](#commands).

## Read a value in a component

Pass a selector to the hook. The component re-renders only when the selected value changes, so `DraftCount` ignores a change to `customer`:

```tsx
// app/features/orders/draft-customer.tsx
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

Calling the hook with no selector returns the whole state. The component then re-renders on every change to any field, so keep that for small stores or for debugging:

```tsx
// app/features/orders/draft-debug.tsx
import { useOrderDraft } from '#app/stores/order-draft'

export function DraftDebug() {
  const draft = useOrderDraft()
  return <pre>{JSON.stringify({ customer: draft.customer, lines: draft.lines }, null, 2)}</pre>
}
```

## Select several values at once

A selector that builds a new object or array on every call, such as `(s) => ({ customer: s.customer, count: s.lines.length })`, returns a different value each time, and React keeps re-rendering. Either call the hook once per value, or wrap the selector in Zustand's `useShallow`, which compares the result field by field:

```tsx
// app/features/orders/draft-header.tsx
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

Derived numbers and strings are safe without it: `(s) => s.lines.length` returns the same number until the length changes.

## Change state with actions

Inside the creator, `set` merges a partial state into the current one. Pass an object when the new value does not depend on the old one, and a function when it does:

```ts
// app/stores/invoice-selection.ts
import { createKitrStore } from 'kitr/state'

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

`get()` reads the current state inside an action. Keep the logic in actions rather than in components, so every caller changes the state the same way.

Don't mutate the state in place (`s.selected.push(id)`). `set` compares by reference, so a mutated array looks unchanged and nothing re-renders. Return a new array or object.

## Read and change state outside React

The third value is the browser's store instance. Use it in code that is not a component: an event handler set up at startup, a route loader, a mutation's `onSuccess`:

```ts
// app/features/orders/place-order.ts
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

`subscribe` lets code outside React react to changes. This keeps the page title in step with the draft:

```ts
// app/features/orders/draft-title.ts
import { orderDraftStore } from '#app/stores/order-draft'

export const stopDraftTitle = orderDraftStore?.subscribe((state, previous) => {
  if (state.lines.length !== previous.lines.length)
    document.title = state.lines.length ? `(${state.lines.length}) Acme` : 'Acme'
})
```

The store is `null` on the server, which is why every call above uses `?.`. Code that only ever runs in the browser, such as a click handler, can assert it with `orderDraftStore!`.

## Save state in the browser

With `persist: true`, the whole state is saved to `localStorage` under `kitr:<name>` after every change, and restored when the page loads. The saved value is JSON with the state and a version:

```ts
// In the browser console after adding one seat
JSON.parse(localStorage.getItem('kitr:order-draft')!)
// => { state: { customer: '', lines: [{ sku: 'acme-seat', name: 'Acme seat', price: 12, quantity: 1 }] }, version: 0 }
```

Functions are not saved, because JSON cannot hold them; the actions come from the creator each time.

Pass an object to control what is saved. `partialize` picks the fields; here the draft's lines survive a reload but the customer does not:

```ts
// app/stores/order-draft.ts
import { createKitrStore } from 'kitr/state'
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

> **Warning**
> `localStorage` is readable by any script on the page and stays on the device after sign-out. Never persist tokens, passwords or personal data in a store. Use [Secure storage](/packages/secure-storage) for secrets.

## Change the saved shape

When the state's shape changes, data saved by the old version no longer fits. Bump `version`, and give `migrate` a function that upgrades old data. Without `migrate`, data from another version is ignored and the store starts from its initial state:

```ts
// app/stores/preferences.ts
import { createKitrStore } from 'kitr/state'

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

`sessionStorage` keeps state for one tab and clears it when the tab closes. It suits a wizard Grace should be able to run in two tabs at once without them mixing:

```ts
// app/stores/import-wizard.ts
import { createKitrStore } from 'kitr/state'
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

`StoreProvider` takes `initialState`, which is merged over the creator's state when the provider first mounts. Use it to start a store from data a loader fetched, such as the customer of the order Linus is editing:

```tsx
// app/routes/orders/$orderId.edit.tsx
import { createFileRoute } from '@tanstack/react-router'
import { OrderDraftProvider } from '#app/stores/order-draft'
import { orderQuery } from '#app/features/orders/queries'
import { DraftEditor } from '#app/features/orders/draft-editor'

export const Route = createFileRoute('/orders/$orderId/edit')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(orderQuery.options(params.orderId)),
  component: EditOrderPage,
})

function EditOrderPage() {
  const order = Route.useLoaderData()
  return (
    <OrderDraftProvider initialState={{ customer: order.customer }}>
      <DraftEditor />
    </OrderDraftProvider>
  )
}
```

In the browser the store is shared by the whole app, so `initialState` writes into that one store with `setState` when the provider mounts. It overrides values restored from storage, and every component using the store sees it, inside the provider or not. On the server each provider builds its own store with `initialState` already applied, so the page renders with it.

## Render on the server

On the server, one process renders pages for many users at once. A store created at module level would be shared by all of them, and Ada's draft could render in Grace's page. `createKitrStore` prevents that:

- **In the browser**, the store is one module-level instance. The hook reads it without any provider.
- **On the server**, there is no module-level instance. Each `<StoreProvider>` creates a fresh store for its render, and storage is never touched.

If a page renders on the server (a `web` platform in `ssr` or `static` mode), wrap the part of the tree that reads the store:

```tsx
// app/routes/__root.tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { OrderDraftProvider } from '#app/stores/order-draft'

export const Route = createRootRoute({
  component: () => (
    <OrderDraftProvider>
      <Outlet />
    </OrderDraftProvider>
  ),
})
```

Without a provider, a server render fails with:

```txt
[kitr/state] Store "order-draft" has no instance on the server. Wrap the tree in its <StoreProvider>.
```

In a client-only app (`spa` mode, desktop, mobile) you can skip the provider entirely.

A saved store renders its initial state on the server, because the server cannot read the browser's storage, and its saved state in the browser. React reports a hydration mismatch for the elements that differ. Render saved values only after the component mounts:

```tsx
// app/features/orders/draft-badge.tsx
import { useEffect, useState } from 'react'
import { useOrderDraft } from '#app/stores/order-draft'

export function DraftBadge() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const count = useOrderDraft((s) => s.lines.length)
  return <span>{mounted && count > 0 ? `${count} in draft` : null}</span>
}
```

## Use plain Zustand

`kitr/state` re-exports `zustand` unchanged, so `create`, `createStore`, `useStore` and the types work as in the [Zustand docs](https://zustand.docs.pmnd.rs). Middleware comes from `zustand/middleware`. A store made with `create` is a module-level singleton on the server too, so use it only in client-only apps or for state that is the same for every user:

```ts
// app/stores/toasts.ts
import { create } from 'kitr/state'

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

It writes `app/stores/order_draft.ts`. The file name is snake case; the exports are camel and pascal case:

```ts
// app/stores/order_draft.ts
import { createKitrStore } from 'kitr/state'

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

Replace the state with your own. Pass `--force` to overwrite an existing file. To change the template for your project, run `kitr eject stub store` and edit `stubs/store.ts`.

## Testing

In a DOM test (Vitest with `happy-dom` or `jsdom`), the store is the browser singleton, so it keeps its state from one test to the next. Reset it in `beforeEach` with `setState`, and clear `localStorage` if the store persists:

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

Wrap changes made outside React in `act()` when a component is rendered, so React applies the update before you assert.

To test what the server renders, run the test in the `node` environment, where there is no singleton, and render through the provider:

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

In development, every store connects to the [Redux DevTools](https://github.com/reduxjs/redux-devtools) browser extension under its `name`. Each `set` shows up as an action with the state before and after, and you can step back through them. The connection is skipped in production builds, on the server, and for stores created with `devtools: false`.

## Next steps

- [API reference](/packages/state/api)
- [Zustand docs](https://zustand.docs.pmnd.rs): everything there works as written, imported from `kitr/state`.
- [Zustand persist options](https://zustand.docs.pmnd.rs/middlewares/persist): every option `persist` accepts.
- [Query](/packages/query): where server data belongs.
- [Forms](/packages/forms): form state, validation and server errors, without a store.
