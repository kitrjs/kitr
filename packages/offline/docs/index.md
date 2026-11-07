---
title: Offline
description: Keep showing loaded data with no connection, and send queued changes when the network comes back.
order: 1
---

# Offline

A train goes into a tunnel, the warehouse wifi drops, the app is reopened on a plane. Without help, every screen turns into a spinner or an error. `kitr/offline` keeps a copy of the data your app already loaded on the device and puts it back before the first render, so the app opens with the last known data. Changes made with no connection wait in a queue and are sent when the network returns.

It is built on [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode)'s own network mode and its [dehydrate and hydrate](https://tanstack.com/query/latest/docs/framework/react/reference/hydration) functions, and stores the snapshot through [Storage](/packages/storage), so desktop and mobile apps keep it in the native store. kitr adds the throttled save, the restore at boot, version-based invalidation and a `useOffline()` hook for a status line.

It runs in the browser and in desktop and mobile shells, never on the server. It keeps **data** available offline, not the app itself: to open a web app with no connection, also make it installable with the [Web](/packages/web) platform's PWA option.

This guide follows Linus, who visits Acme's customers with a tablet: he opens the orders list, loses the connection in a basement, takes a new order for Grace, and the order reaches the server when he is back upstairs.

## When to use it

Use `kitr/offline` to keep **server data** you loaded with [Query](/packages/query) usable with no connection: lists, details, the signed-in user. It saves the query cache as a whole and needs no change to your queries.

Use [Storage](/packages/storage) for values the device itself owns, such as preferences and drafts. Storage items are always there; the offline snapshot is a cache that can expire, be busted by a new version and be cleared on sign-out.

## Install

```sh
kitr add offline
```

What `kitr add` does:

- Installs `@kitr/offline` and adds it to `packages` in `kitrrc.ts`.
- Adds `() => import('@kitr/offline/provider')` to the end of `providers` in `kitrrc.ts`.
- Writes `config/offline.ts` (shown under [Configure](#configure)).
- Adds `VITE_APP_VERSION` to the public variables in `app/env.ts` as `e.string({ default: '0.0.0' })`, and `VITE_APP_VERSION=0.0.0` to `.env.example` (and to `.env` when it exists).
- Adds a `## kitr: offline` section to `AGENTS.md`: successful queries are persisted and restored before the first render, mutations made offline pause and replay on reconnect, give mutations a `mutationKey` and an optimistic `onMutate`, and use `useOffline()` from `kitr/offline/react` for a status line.

`kitr add offline` asks no questions and adds no scripts. No kit includes it.

The provider reads the `queryClient` that [Query](/packages/query) binds, and the snapshot goes through [Storage](/packages/storage). `kitr add offline` does not add either package, so add them in the same command when the project lacks them:

```sh
kitr add query storage offline
```

`kitr remove offline` removes the provider, the `packages` entry, the dependency and the `AGENTS.md` section, deletes `config/offline.ts`, and lists the files that still import `kitr/offline`. It leaves `VITE_APP_VERSION` in `app/env.ts` and `.env.example`, and leaves Query and Storage installed.

## Configure

`kitr add offline` writes this file:

```ts
// config/offline.ts
import { defineConfig } from 'kitr/offline'
import { env } from '#app/env'

export default defineConfig({
  maxAge: 24 * 60 * 60 * 1000,
  // include: (key) => key[0] !== 'search', // leave volatile queries out of the snapshot
  buster: env.VITE_APP_VERSION, // a new version drops old snapshots
})
```

| Option | Default | Description |
| --- | --- | --- |
| `maxAge` | `86_400_000` (24 hours) | How long a saved snapshot stays usable, in milliseconds. An older one is deleted instead of restored. |
| `include` | every successful query | `(queryKey) => boolean`. Only queries that return `true` are saved. Queries that failed or never loaded are never saved. |
| `buster` | `undefined` | Any string. A snapshot saved with a different `buster` is deleted instead of restored. Set it to the app version. |
| `throttle` | `1000` | Milliseconds to wait after a cache change before saving. Changes in that window are saved in one write. |
| `key` | `'kitr:query-cache'` | The storage key the snapshot is saved under. The storage `prefix` is not added. |
| `storage` | the app's local storage driver | A `StorageDriver` from [Storage](/packages/storage). The default is `localStorage` in a browser and the native store on desktop and mobile. |

| Variable | Used for |
| --- | --- |
| `VITE_APP_VERSION` | The `buster`. A public variable, so it ships to the browser. Defaults to `0.0.0`. |

`VITE_APP_VERSION` doesn't change on its own. Set it when you build, so every release drops the snapshots of the last one:

```sh
VITE_APP_VERSION=$(git rev-parse --short HEAD) kitr build
```

The provider runs only when the app's environment is `client`. In `register()` it binds the `offline` service in the container. In `boot()` it binds TanStack's online state to [Platform](/packages/platform) when that is installed, then restores the snapshot. Because providers boot in order, the cache is filled before your first render.

### Keep queries in memory as long as the snapshot

TanStack Query removes a query from memory five minutes after the last component using it unmounts (its `gcTime`). A removed query isn't in the next snapshot, so with the defaults a list Linus hasn't opened in five minutes is gone from the device even though `maxAge` is 24 hours. Raise `gcTime` in `config/query.ts` to match `maxAge`:

```ts
// config/query.ts
import { defineConfig } from 'kitr/query'

export default defineConfig({
  staleTime: 30_000,
  defaultOptions: {
    queries: { gcTime: 24 * 60 * 60 * 1000 },
  },
})
```

## Show cached data with no connection

Nothing changes in your queries. A query that loaded once is saved, and the next time the app starts it is in the cache before the page renders:

```tsx
// app/routes/orders.tsx
import { createFileRoute } from '@tanstack/react-router'
import { defineQuery, useQuery } from 'kitr/query'

interface Order {
  id: string
  customer: string
  total: number
}

export const ordersQuery = defineQuery({
  key: () => ['orders', 'list'],
  fetch: async (_input, { signal }): Promise<Order[]> => {
    const res = await fetch('https://api.acme.com/orders', { signal })
    return (await res.json()) as Order[]
  },
})

export const Route = createFileRoute('/orders')({
  component: OrdersPage,
})

function OrdersPage() {
  const { data: orders, isPending, fetchStatus } = useQuery(ordersQuery.options())
  if (isPending) return <p>Loading orders…</p>
  return (
    <>
      {fetchStatus === 'paused' && <p>Offline. Showing the last orders loaded.</p>}
      <ul>
        {orders?.map((order) => (
          <li key={order.id}>
            {order.customer}: ${order.total}
          </li>
        ))}
      </ul>
    </>
  )
}
```

Open `/orders` with the network on and wait a second for the snapshot to be written. Close the tab, set the browser's devtools to **Offline**, and open the app again (as an installed PWA, or in the desktop or mobile shell). The list shows Ada's and Grace's orders at once, with "Offline. Showing the last orders loaded." above it, instead of "Loading orders…".

Two things happened. At boot the provider restored the snapshot into the query cache, so `isPending` was already `false`. Then TanStack tried to refetch the stale data, saw it was offline, and paused the fetch instead of failing it: `fetchStatus` is `'paused'` and the cached data stays. When the network returns, the paused fetch runs and the list updates.

The snapshot in storage is one JSON string:

```text
kitr:query-cache  {"at":1731000000000,"buster":"1.4.0","state":{"mutations":[],"queries":[{"queryKey":["orders","list"],...}]}}
```

## Show the connection status

`useOffline()` from `kitr/offline/react` gives a component the network state, the number of changes waiting to be sent, and whether the cache came from a snapshot:

```tsx
// app/components/connection-status.tsx
import { useOffline } from 'kitr/offline/react'

export function ConnectionStatus() {
  const { online, pending, restored } = useOffline()
  if (!online) return <p role="status">Offline. {pending} change(s) will be sent later.</p>
  if (pending > 0) return <p role="status">Sending {pending} change(s)…</p>
  if (restored) return <p role="status">Showing saved data while we refresh.</p>
  return null
}
```

| Field | Type | Description |
| --- | --- | --- |
| `online` | `boolean` | What TanStack Query's `onlineManager` says. Follows [Platform](/packages/platform) when it is installed. |
| `pending` | `number` | Mutations paused while waiting for the network. |
| `restored` | `boolean` | `true` once a snapshot was loaded into the cache at boot. It stays `true` for the session. |
| `clear` | `() => void` | Delete the saved snapshot. |
| `persist` | `() => void` | Save the cache now instead of after the throttle. |

The hook re-renders after a restore, after each save, and when the network goes up or down. Put `<ConnectionStatus />` in the layout so it shows on every page.

On the server the provider binds nothing, so during server rendering `useOffline()` reports online, nothing pending and nothing restored, which matches the browser's first render.

## Choose what to save

`include` gets each successful query's key and decides whether it goes in the snapshot. Leave out data that is cheap to refetch, changes every second, or shouldn't stay on the device:

```ts
// config/offline.ts
import { defineConfig } from 'kitr/offline'
import { env } from '#app/env'

const neverSaved = new Set(['search', 'notifications', 'billing'])

export default defineConfig({
  maxAge: 24 * 60 * 60 * 1000,
  include: (key) => !neverSaved.has(String(key[0])),
  buster: env.VITE_APP_VERSION,
})
```

With this config, `['orders', 'list']` and `['projects', 'detail', 'prj_7']` are saved; `['search', 'Grace']` and `['billing', 'invoices']` are not. Keys from `createKeys('orders')` in `kitr/app` always start with the resource name, so the first element is a reliable switch.

Smaller snapshots also save faster. Every save writes the whole snapshot as one string, and `localStorage` has a limit of about 5 MB per origin. When a write fails, the error is logged as `persist failed` and the app keeps running with no saved copy.

## Keep private data off the shared device

The snapshot is plain JSON in local storage or the native store. Anyone with the device can read it. Clear it when someone signs out, along with the in-memory cache:

```tsx
// app/components/sign-out-button.tsx
import { useQueryClient } from 'kitr/query'
import { useOffline } from 'kitr/offline/react'

export function SignOutButton({ onSignedOut }: { onSignedOut: () => void }) {
  const { clear } = useOffline()
  const queryClient = useQueryClient()

  return (
    <button
      type="button"
      onClick={() => {
        queryClient.clear()
        clear()
        onSignedOut()
      }}
    >
      Sign out
    </button>
  )
}
```

Clear the query cache first. `clear()` deletes the stored snapshot, but the next cache change saves a new one, so an uncleared cache would be written straight back.

> **Warning**
> Never let tokens, card numbers or other secrets into the snapshot. Leave such queries out with `include`, and keep tokens in [Secure storage](/packages/secure-storage). On a shared computer, anything in the snapshot survives until it expires or someone signs out.

## Drop old snapshots when you deploy

When a release changes the shape of your data, last week's snapshot would hand new code old data. `buster` prevents that: a snapshot saved with another `buster` is deleted at boot instead of restored. The generated config uses `VITE_APP_VERSION`:

```ts
// app/env.ts
import { createEnv, env as e } from 'kitr/env'

export const env = createEnv({
  public: {
    VITE_APP_VERSION: e.string({ default: '0.0.0' }),
  },
})
```

```sh
# .env.production
VITE_APP_VERSION=1.5.0
```

Linus's tablet holds a snapshot saved by `1.4.0`. After the `1.5.0` update the provider finds it, sees `"buster":"1.4.0"`, deletes it, and the app loads fresh data. Paused mutations in that snapshot are deleted with it, so ship releases that change mutation inputs only when you can afford to lose queued changes, or keep the old `buster`.

## Expire snapshots after a time

`maxAge` is measured from when the snapshot was last saved. A snapshot older than `maxAge` is deleted at boot instead of restored. One saved exactly `maxAge` milliseconds ago still restores:

```ts
// config/offline.ts
import { defineConfig } from 'kitr/offline'
import { env } from '#app/env'

export default defineConfig({
  // A field team works for a week between syncs.
  maxAge: 7 * 24 * 60 * 60 * 1000,
  buster: env.VITE_APP_VERSION,
})
```

Since every cache change saves the snapshot again, an app that is used every day never hits `maxAge`. It matters for an app left closed: after a week with this config, Linus's tablet opens with an empty cache and loads everything fresh. Match `gcTime` in `config/query.ts` to the new `maxAge`, as [Configure](#keep-queries-in-memory-as-long-as-the-snapshot) shows.

Restored data keeps the time it was fetched, so it counts as stale by your `staleTime` and is refetched as soon as a component uses it and the network is up.

## Queue changes while offline

Mutations need no change either. TanStack Query's default `networkMode: 'online'` pauses a mutation that starts with no connection, instead of running it and failing. The provider saves paused mutations in the snapshot, and TanStack sends them when the network returns.

Give each mutation a `mutationKey`, so it can be replayed after a reload (next section), and an optimistic `onMutate`, so the screen shows the change while it waits:

```ts
// app/features/orders/use-create-order.ts
import { defineMutation, useKitrMutation, useQueryClient } from 'kitr/query'

export interface Order {
  id: string
  customer: string
  total: number
}

export const createOrder = defineMutation({
  mutate: async (input: { customer: string; total: number }): Promise<Order> => {
    const res = await fetch('https://api.acme.com/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
    return (await res.json()) as Order
  },
  effects: { invalidate: [['orders', 'list']] },
})

export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useKitrMutation(createOrder, {
    mutationKey: ['orders', 'create'],
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['orders', 'list'] })
      const previous = queryClient.getQueryData<Order[]>(['orders', 'list'])
      const draft: Order = { id: `draft_${Date.now()}`, ...input }
      queryClient.setQueryData<Order[]>(['orders', 'list'], (orders = []) => [...orders, draft])
      return { previous }
    },
    onError: (_error, _input, context) => {
      const previous = (context as { previous?: Order[] } | undefined)?.previous
      if (previous) queryClient.setQueryData(['orders', 'list'], previous)
    },
  })
}
```

```tsx
// app/features/orders/new-order-button.tsx
import { useCreateOrder } from './use-create-order'

export function NewOrderButton() {
  const createOrder = useCreateOrder()
  return (
    <button type="button" onClick={() => createOrder.mutate({ customer: 'Grace', total: 240 })}>
      New order for Grace
    </button>
  )
}
```

In the basement, Linus taps the button. Grace's order appears in the list at once, `createOrder.isPaused` is `true`, and `<ConnectionStatus />` reads "Offline. 1 change(s) will be sent later." Back upstairs, TanStack sends the request, the `effects` refetch the list, and the status line disappears.

Don't catch the offline case yourself and retry with `setTimeout`: the mutation is already queued, and a second attempt sends the order twice.

## Replay queued changes after a reload

A paused mutation that is restored from a snapshot is data only: its function didn't survive the reload. Register the function for each `mutationKey` with TanStack's [`setMutationDefaults`](https://tanstack.com/query/latest/docs/reference/QueryClient#queryclientsetmutationdefaults). TanStack copies the defaults into a mutation when it is restored, so they must be set **before** the offline provider restores the snapshot. Do it in the `register()` of a provider, which runs before any provider boots:

```ts
// app/providers/offline-mutations.ts
import { defineProvider } from 'kitr/app'
import { createOrder } from '#app/features/orders/use-create-order'

export default defineProvider({
  name: 'offline-mutations',
  register(app) {
    if (!app.isClient) return
    const queryClient = app.container.use('queryClient')
    queryClient.setMutationDefaults(['orders', 'create'], createOrder.options({ queryClient }))
  },
  async boot(app) {
    if (!app.isClient) return
    await app.container.use('queryClient').resumePausedMutations()
  },
})
```

List it after the offline provider, so its `boot()` runs once the snapshot is restored:

```ts
// kitrrc.ts
import { defineKitrConfig } from 'kitr/app'

export default defineKitrConfig({
  providers: [
    () => import('@kitr/query/provider'),
    () => import('@kitr/storage/provider'),
    () => import('@kitr/offline/provider'),
    () => import('#app/providers/offline-mutations'),
    // ...
  ],
  // ...
})
```

`createOrder.options({ queryClient })` returns the mutation function and the cache effects, so a replayed order behaves like one sent from the button. `resumePausedMutations()` sends restored mutations as soon as the app starts online; while offline it leaves them paused. Without that call, TanStack sends them on the next focus or reconnect event.

Don't set the defaults in `boot()` or in a component. By then the mutation was restored without a function, and it fails when it resumes with TanStack's `No mutationFn found` error.

## Save and restore by hand

The provider saves on its own: one second after the last cache change, and right away when the page is hidden or closed, so a change made just before Linus locks the tablet is not lost. Outside React, the `offline` service gives you the same controls:

```ts
// app/features/sync/sync-now.ts
import { useOffline } from 'kitr/offline'
import { app } from '#app/app'

export async function resetDeviceCache() {
  const offline = useOffline(app)

  offline.persist() // write the snapshot now
  offline.pendingMutations() // => 0
  offline.isOnline() // => true
  offline.restored // => true when the app started from a snapshot

  offline.clear() // delete the snapshot
  await offline.restore() // => false, nothing left to restore
}
```

`restore()` resolves to `true` when it loaded a snapshot. A snapshot that isn't valid JSON, has the wrong shape, another `buster`, or is older than `maxAge` is deleted, and `restore()` resolves to `false` without throwing, so a corrupt snapshot never stops the app from booting. `subscribe(listener)` calls `listener` after a restore, after each throttled save and on every online change, and returns an unsubscribe function.

To use the service with a `QueryClient` you build yourself, outside the provider, call `createOffline(client, config)`:

```ts
// scripts/warm-cache.ts
import { createOffline } from 'kitr/offline'
import { QueryClient } from 'kitr/query'
import { createMemoryStorageDriver } from 'kitr/storage'

const storage = createMemoryStorageDriver()
const client = new QueryClient()
client.setQueryData(['orders', 'list'], [{ id: 'ord_1042', customer: 'Ada', total: 129 }])

createOffline(client, { storage }).persist()
JSON.parse(storage.get('kitr:query-cache') ?? '{}').state.queries.length // => 1
```

## Follow the platform's online state

By default TanStack Query listens to the browser's `online` and `offline` events. Native shells know the network better than `navigator.onLine`, so when [Platform](/packages/platform) is installed, the provider calls `bindOnlineManager` with the `platform` service and TanStack follows the platform driver instead. You don't call it yourself in a kitr app.

Outside the provider, for example in a test, pass anything with `isOnline()` and `onOnline(listener)`:

```ts
// test/support/network.ts
import { bindOnlineManager } from 'kitr/offline'

let setNetwork: (online: boolean) => void = () => {}

bindOnlineManager({
  isOnline: () => true,
  onOnline: (listener) => {
    setNetwork = listener
    return () => {}
  },
})

export const goOffline = () => setNetwork(false)
export const goOnline = () => setNetwork(true)
```

TanStack's `onlineManager` is global, so the binding applies to every `QueryClient` in the page.

## Testing

The provider only runs when the app's environment is `client`, so pass `environment: 'client'` to `createTestApp`. Give it an in-memory storage driver in config, seed a snapshot with `createOffline`, and boot: the cache holds the seeded data before any test code runs. TanStack's `onlineManager` lets you take the app offline:

```ts
// app/features/orders/offline.test.ts
import { createOffline } from 'kitr/offline'
import offlineProvider from 'kitr/offline/provider'
import { onlineManager, QueryClient } from 'kitr/query'
import queryProvider from 'kitr/query/provider'
import { createMemoryStorageDriver } from 'kitr/storage'
import { createTestApp } from 'kitr/testing'
import { afterEach, describe, expect, it } from 'vitest'

afterEach(() => onlineManager.setOnline(true))

describe('offline orders', () => {
  it('starts from the saved snapshot', async () => {
    const storage = createMemoryStorageDriver()
    const yesterday = new QueryClient()
    yesterday.setQueryData(['orders', 'list'], [{ id: 'ord_1042', customer: 'Ada', total: 129 }])
    createOffline(yesterday, { storage, buster: '1.4.0' }).persist()

    const app = await createTestApp({
      environment: 'client',
      providers: [queryProvider, offlineProvider],
      config: { offline: { storage, buster: '1.4.0' } },
    })

    expect(app.container.use('offline').restored).toBe(true)
    expect(app.container.use('queryClient').getQueryData(['orders', 'list'])).toEqual([
      { id: 'ord_1042', customer: 'Ada', total: 129 },
    ])
  })

  it('drops a snapshot from another version', async () => {
    const storage = createMemoryStorageDriver()
    const old = new QueryClient()
    old.setQueryData(['orders', 'list'], [])
    createOffline(old, { storage, buster: '1.4.0' }).persist()

    const app = await createTestApp({
      environment: 'client',
      providers: [queryProvider, offlineProvider],
      config: { offline: { storage, buster: '1.5.0' } },
    })

    expect(app.container.use('offline').restored).toBe(false)
    expect(storage.get('kitr:query-cache')).toBeNull()
  })

  it('reports offline state', async () => {
    const app = await createTestApp({
      environment: 'client',
      providers: [queryProvider, offlineProvider],
      config: { offline: { storage: createMemoryStorageDriver() } },
    })
    const offline = app.container.use('offline')

    onlineManager.setOnline(false)
    expect(offline.isOnline()).toBe(false)
    expect(offline.pendingMutations()).toBe(0)
  })
})
```

To test that a mutation queues, build it on the client with `client.getMutationCache().build(client, { mutationKey, mutationFn })`, call `execute()` while `onlineManager.setOnline(false)`, and wait for `offline.pendingMutations()` to be `1`. Paused mutations only resume on a mounted client: call `client.mount()` in the test, which `QueryClientProvider` does in the app.

## Extend

The snapshot goes through a `StorageDriver`, the same interface [Storage](/packages/storage) uses for its native stores (see [Write a storage driver](/packages/storage#write-a-storage-driver)). Pass your own as `storage` to keep the snapshot somewhere else. The usual reason is size: [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) holds far more than the 5 MB of `localStorage`.

The offline service reads the snapshot synchronously with `get()`, so an async store must be loaded into memory first. `createAsyncStorageDriver` from `kitr/storage` does that in its `hydrate()`. This driver uses [idb-keyval](https://github.com/jakearchibald/idb-keyval):

```ts
// app/lib/idb-snapshot.ts
import { createStore, del, get, set } from 'idb-keyval'
import { createAsyncStorageDriver } from 'kitr/storage'

const store = createStore('acme-offline', 'snapshots')

export const idbSnapshotStorage = createAsyncStorageDriver({
  name: 'idb:offline',
  load: async () => {
    const snapshot = await get<string>('kitr:query-cache', store)
    return snapshot ? { 'kitr:query-cache': snapshot } : {}
  },
  write: (key, raw) => set(key, raw, store),
  erase: (key) => del(key, store),
})
```

```ts
// config/offline.ts
import { defineConfig } from 'kitr/offline'
import { env } from '#app/env'
import { idbSnapshotStorage } from '#app/lib/idb-snapshot'

export default defineConfig({
  maxAge: 24 * 60 * 60 * 1000,
  buster: env.VITE_APP_VERSION,
  storage: idbSnapshotStorage,
})
```

Nothing calls `hydrate()` on a driver passed in config, so do it in a provider listed **before** `@kitr/offline/provider` in `kitrrc.ts`. Its `boot()` finishes before the offline provider restores:

```ts
// app/providers/idb-snapshot.ts
import { defineProvider } from 'kitr/app'
import { idbSnapshotStorage } from '#app/lib/idb-snapshot'

export default defineProvider({
  name: 'idb-snapshot',
  async boot(app) {
    if (app.isClient) await idbSnapshotStorage.hydrate?.()
  },
})
```

Writes go to IndexedDB in the background after each save. A failed write is logged as `[kitr/storage] idb:offline: <error>`; pass `onError` to `createAsyncStorageDriver` to handle it yourself.

## Devtools

`kitr/offline` has no panel. With [Devtools](/packages/devtools) installed it writes to the Log panel under `offline`: `restored` with the number of queries and mutations it loaded at boot, and `persist failed` with the error when a save is refused, usually because storage is full. The restored queries show in the [Query](/packages/query) panel like any others.

## Next steps

- [API reference](/packages/offline/api)
- [TanStack Query: network mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode): how paused queries and mutations behave.
- [Query](/packages/query): the queries and mutations this package saves.
- [Storage](/packages/storage): where the snapshot lives, and native drivers on desktop and mobile.
- [Web](/packages/web): make the app installable so it opens with no connection.
