---
title: Offline
description: Keep showing loaded data with no connection, and send queued changes when the network comes back.
order: 1
---

# Offline

The TanStack Query cache survives a reload and a lost connection: successful queries are persisted to storage and restored before the first render, mutations made offline wait and replay when the network returns.

## Install

```sh
kitr add offline
```

```ts
// config/offline.ts
import { defineConfig } from 'kitr/offline'

export default defineConfig({
  maxAge: 24 * 60 * 60 * 1000,
  include: (key) => key[0] !== 'search', // leave volatile queries out
  buster: import.meta.env.VITE_APP_VERSION, // new version, new cache
})
```

The provider goes after `query` in `kitrrc.ts`. Storage is the app's local storage driver, so on desktop and mobile the snapshot lives in the native store.

## In a component

```tsx
import { useOffline } from 'kitr/offline/react'

function Status() {
  const { online, pending } = useOffline()
  if (online && !pending) return null
  return <p>{online ? `Sending ${pending} change(s)…` : 'Offline. Changes will be sent later.'}</p>
}
```

Mutations need no change: with TanStack Query's default `networkMode: 'online'` they pause while offline and resume on reconnect. Give a mutation a `mutationKey` and a `onMutate` optimistic update so the list looks right in the meantime, and set `mutationCache` defaults with `setMutationDefaults` for mutations that must survive a reload.

## Online state

`bindOnlineManager(platform)` makes Query follow the `kitr/platform` driver, which the provider does when `platform` is installed; native shells report connectivity better than `navigator.onLine`.
