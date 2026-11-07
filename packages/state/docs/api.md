---
title: API
description: Every export of kitr/state.
order: 2
---

# API

`kitr/state` re-exports everything from `zustand` and adds `createKitrStore`.

## createKitrStore

```ts
function createKitrStore<T extends object>(
  options: KitrStoreOptions<T>,
  initializer: StateCreator<T>,
): readonly [useStore, StoreProvider, store]
```

Creates a store that is a singleton in the browser and per-provider on the server.

### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | `string` | required | Used for devtools and as the storage key `kitr:<name>`. |
| `persist` | `boolean \| PersistOptions` | `false` | Save to `localStorage`. An object is passed to Zustand's `persist` middleware; its `name` overrides the storage key. |
| `devtools` | `boolean` | `true` in dev | Connect to Redux DevTools in development. |

### Returns

A tuple. Name the parts whatever suits your store.

| Position | Value | Description |
| --- | --- | --- |
| 0 | `useStore()` / `useStore(selector)` | Hook. Without a selector it returns the whole state. |
| 1 | `StoreProvider` | Component with `children` and optional `initialState: Partial<T>`. Required on the server. |
| 2 | `store` | The browser's `StoreApi<T>`, or `null` on the server. |

### Errors

Calling the hook on the server without a surrounding `StoreProvider` throws:

```
[kitr/state] Store "cart" has no instance on the server. Wrap the tree in its <StoreProvider>.
```

## Re-exports from zustand

`create`, `createStore`, `useStore`, `StateCreator`, `StoreApi` and everything else Zustand exports. Middleware such as `persist`, `devtools` and `createJSONStorage` comes from `zustand/middleware`.
