---
title: State
description: Keep app-wide values like a cart or settings, and optionally save them in the browser.
order: 1
---

# State

Some values belong to the whole app rather than one component: what's in the cart, whether the sidebar is open, which units the user prefers. `kitr/state` gives you a small store for those values that any component can read and update, and that can remember them across page reloads.

It is [Zustand](https://zustand.docs.pmnd.rs), re-exported, plus one helper, `createKitrStore`, that makes stores safe for server rendering.

## When to use it

Use a store for **client state**: values that live in the browser and that no server owns.

- A shopping cart before checkout
- UI preferences such as theme, density or a collapsed sidebar
- A multi-step wizard's progress

Don't use a store for **server data** such as the list of projects or the current user's profile. That belongs in a query (see [Query](/packages/query)), which caches it, refetches it and keeps it in sync for you.

## Install

```sh
kitr add state
```

This installs `@kitr/state` and `zustand`, creates `app/stores/`, and adds a note to `AGENTS.md`. There is no provider and no config file.

## Your first store

```ts
// app/stores/cart.ts
import { createKitrStore } from 'kitr/state'

interface CartState {
  items: string[]
  add: (item: string) => void
  clear: () => void
}

export const [useCart, CartProvider, cartStore] = createKitrStore<CartState>(
  { name: 'cart', persist: true },
  (set) => ({
    items: [],
    add: (item) => set((s) => ({ items: [...s.items, item] })),
    clear: () => set({ items: [] }),
  }),
)
```

`kitr make:store cart` writes the same file for you.

Read it in any component. Pass a selector so the component only re-renders when that slice changes:

```tsx
import { useCart } from '#app/stores/cart'

export function CartButton() {
  const count = useCart((s) => s.items.length)
  return <button type="button">Cart ({count})</button>
}

export function AddToCart({ item }: { item: string }) {
  const add = useCart((s) => s.add)
  return <button type="button" onClick={() => add(item)}>Add</button>
}
```

## Saving to the browser

With `persist: true`, the store is saved to `localStorage` under the key `kitr:<name>` (here `kitr:cart`) and restored on the next visit. Only the browser ever reads it, so server rendering is unaffected.

Pass an object to control what is saved, using any of Zustand's [persist options](https://zustand.docs.pmnd.rs/middlewares/persist):

```ts
createKitrStore<CartState>(
  {
    name: 'cart',
    persist: {
      // Save the items, not the functions.
      partialize: (s) => ({ items: s.items }),
      // Bump when the shape changes; old data is dropped or migrated.
      version: 2,
    },
  },
  (set) => ({ /* ... */ }),
)
```

Use `sessionStorage` instead by passing `storage: createJSONStorage(() => sessionStorage)`, with `createJSONStorage` imported from `zustand/middleware`.

## Server rendering

On the server, one process renders pages for many users at once. A plain module-level store would leak one user's cart into another user's page. `createKitrStore` prevents that:

- **In the browser**, the store is a single shared instance, so it works without any provider.
- **On the server**, each `<StoreProvider>` creates a fresh store for that render.

If you render on the server (with [SSR](/packages/seo) or server actions), wrap the part of the tree that uses the store:

```tsx
// app/routes/__root.tsx
import { CartProvider } from '#app/stores/cart'

<CartProvider>
  <Outlet />
</CartProvider>
```

You can seed it per request with `initialState`:

```tsx
<CartProvider initialState={{ items: loaderData.savedCart }}>
```

In a client-only app you can skip the provider entirely.

## Outside React

The third value, `cartStore`, is the browser's store instance for code that runs outside components, such as a route loader or an event handler:

```ts
cartStore?.getState().clear()
```

It is `null` on the server, which is why the optional chaining is there.

## Devtools

In development, stores connect to the [Redux DevTools](https://github.com/reduxjs/redux-devtools) extension under their `name`. Turn it off with `devtools: false`.

## Next steps

- [API reference](/packages/state/api)
- [Zustand docs](https://zustand.docs.pmnd.rs): everything there works as written, imported from `kitr/state`.
