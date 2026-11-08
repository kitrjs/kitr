---
title: Overview
description: Keep app-wide values like a cart or settings, and optionally save them in the browser.
order: 0
---

# State

## What it is

`@kitr/state` is Zustand with one helper, `createKitrStore`. Define the state and its actions; components select the slice they need and re-render only when it changes. Ask for persistence and the store saves itself, with versions for old shapes.

Runs in the browser and during server rendering. For data a server owns, use [query](/packages/query).

## Install

```sh
kitr add state
```

Adds `@kitr/state` and zustand, and creates `app/stores/`. No provider, no config file. [Every change](/packages/state/guide#install).

## Quick start

Put each store in `app/stores/`. `persist: true` keeps it across reloads:

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

Press **Add a seat** three times: `3 items in this order`. Reload and it still reads 3, from `localStorage`. `kitr make:store <name>` writes a starter store. Next in the guide: [Create your first store](/packages/state/guide#create-your-first-store).

## Built on

kitr adds `createKitrStore`: safe server rendering, persistence with versions, Redux DevTools and seeding from a loader.

## Problems it solves

- **Prop drilling app-wide values.** [Read a value in a component](/packages/state/guide#read-a-value-in-a-component).
- **Re-renders on every change.** [Select several values at once](/packages/state/guide#select-several-values-at-once).
- **State lost on reload.** [Save state in the browser](/packages/state/guide#save-state-in-the-browser).
- **Old saved data after a deploy.** [Change the saved shape](/packages/state/guide#change-the-saved-shape).
- **Server rendering with a global store.** [Render on the server](/packages/state/guide#render-on-the-server).
- **Debugging state changes.** [Devtools](/packages/state/guide#devtools).

## Further reading

- [Guide](/packages/state/guide).
- [API reference](/packages/state/api).
- [Zustand docs](https://zustand.docs.pmnd.rs) and [persist options](https://zustand.docs.pmnd.rs/middlewares/persist).
- [Query](/packages/query) and [Forms](/packages/forms).
