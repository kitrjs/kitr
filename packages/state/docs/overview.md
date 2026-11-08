---
title: Overview
description: Keep app-wide values like a cart or settings, and optionally save them in the browser.
order: 0
---

# State

Some values belong to the whole app rather than one component: the order someone is putting together before they submit it, whether the sidebar is open, which currency they prefer. Lifting them to the top of the tree means prop drilling; a global object means re-renders everywhere and nothing survives a reload.

`@kitr/state` gives you a small store for those values that any component can read and update, and that can remember them across reloads.

## What it is

`@kitr/state` is a store factory, `createKitrStore`, and the hooks it returns. You define the state and the actions that change it, components select the slice they need and re-render only when it changes, and plain code reads and writes the store outside React. Ask for persistence and the store saves itself to the browser, with versions so an old saved shape migrates instead of breaking.

It runs in the browser, and on the server while a page renders. For data a server owns, such as the list of orders or the signed-in user, use [query](/packages/query) instead.

## Install

```sh
kitr add state
```

This installs `@kitr/state` and zustand, adds the package to `kitrrc.ts` and creates `app/stores/`. There is no provider and no config file. The guide's [Install](/packages/state/guide#install) section lists every change.

## Quick start

Put each store in `app/stores/`. This one holds the order Ada is building, and `persist: true` keeps it across reloads:

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
  lines: DraftLine[]
  addLine: (line: Omit<DraftLine, 'quantity'>) => void
  clear: () => void
}

export const [useOrderDraft, OrderDraftProvider, orderDraftStore] =
  createKitrStore<OrderDraftState>({ name: 'order-draft', persist: true }, (set) => ({
    lines: [],
    addLine: (line) =>
      set((state) => {
        const existing = state.lines.find((l) => l.sku === line.sku)
        if (!existing) return { lines: [...state.lines, { ...line, quantity: 1 }] }
        return {
          lines: state.lines.map((l) => (l.sku === line.sku ? { ...l, quantity: l.quantity + 1 } : l)),
        }
      }),
    clear: () => set({ lines: [] }),
  }))
```

Then use it from any two components, however far apart. Each selects only what it needs, so it re-renders only when that changes:

```tsx
// app/pages/orders/new.tsx
import { useOrderDraft } from '#app/stores/order-draft'

function AddSeat() {
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
      <AddSeat />
    </main>
  )
}
```

Open `/orders/new` and press **Add a seat** three times: the count reads `3 items in this order`. Reload the page and it still reads 3, because the draft was saved to `localStorage` under `kitr:order-draft`. `kitr make:store <name>` writes a starter store for you. The guide continues from here: [Create your first store](/packages/state/guide#create-your-first-store).

## Built on

`@kitr/state` is [Zustand](https://zustand.docs.pmnd.rs), re-exported. `create`, selectors, middleware and everything in its docs work as written, imported from `@kitr/state`.

kitr adds one helper, `createKitrStore`, which makes a store safe for server rendering (no shared state between requests, no hydration mismatch), saves it in the browser through Zustand's [persist](https://zustand.docs.pmnd.rs/middlewares/persist) middleware when you ask, connects it to the Redux DevTools in development, and lets a page seed it from a loader.

## Problems it solves

- **Prop drilling app-wide values.** Any component reads the store with a selector. See [Read a value in a component](/packages/state/guide#read-a-value-in-a-component).
- **Re-renders on every change.** Components select only the values they use. See [Select several values at once](/packages/state/guide#select-several-values-at-once).
- **State lost on reload.** Persist the store in local or session storage. See [Save state in the browser](/packages/state/guide#save-state-in-the-browser).
- **Old saved data after a deploy.** Versions and a migrate function. See [Change the saved shape](/packages/state/guide#change-the-saved-shape).
- **Server rendering with a global store.** Each request gets its own store and the client hydrates it. See [Render on the server](/packages/state/guide#render-on-the-server).
- **Debugging state changes.** Every action shows in the Redux DevTools. See [Devtools](/packages/state/guide#devtools).

## Further reading

- [Guide](/packages/state/guide): install, configure and every task.
- [API reference](/packages/state/api): `createKitrStore` and its options.
- [Zustand docs](https://zustand.docs.pmnd.rs) and [persist options](https://zustand.docs.pmnd.rs/middlewares/persist): everything there works as written.
- [Query](/packages/query) and [Forms](/packages/forms): where server data and form state belong instead.
