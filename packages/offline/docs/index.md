---
title: Offline
description: Keep showing loaded data with no connection, and send queued changes when the network comes back.
order: 1
---

# Offline

A train goes into a tunnel, the wifi drops, the app is reopened on a plane. With `kitr/offline`, the data the app already loaded is still there. Successful [queries](/packages/query) are saved to storage and restored before the first render, so the app opens with yesterday's data instead of a spinner. Changes made offline wait and are sent when the network comes back.

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

| Option | Default | Description |
| --- | --- | --- |
| `maxAge` | 24 hours | Milliseconds a saved snapshot stays usable. |
| `include(queryKey)` | every successful query | Leave out queries that shouldn't be saved, like search results or anything sensitive. |
| `throttle` | `1000` | Milliseconds to wait after a change before saving. |
| `buster` | none | Change it, usually to the app version, and older snapshots are thrown away. |
| `key` | `kitr:query-cache` | The storage key. |
| `storage` | the app's local storage | Where the snapshot lives. On desktop and mobile it's the native store. |

## What to leave out

The snapshot is stored on the device in plain form. Leave out anything you wouldn't want on a shared computer, using `include`, and call `clear()` from `useOffline()` on sign-out.
