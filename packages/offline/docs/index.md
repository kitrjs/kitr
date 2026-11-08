---
title: Offline
description: Keep showing loaded data with no connection, and send queued changes when the network comes back.
order: 1
---

# Offline

A train goes into a tunnel, the warehouse wifi drops, the app is reopened on a plane. Without help, every screen turns into a spinner or an error. `@kitr/offline` keeps a copy of the data your app already loaded and puts it back before the first render. Changes made with no connection wait in a queue and are sent when the network returns.

> [!SUMMARY]
> Keeps showing loaded data with no connection and sends queued changes when the network comes back. Add it with `kitr add offline`; the overview is at [/packages/offline](/packages/offline).

It is built on [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode)'s network mode and [hydration](https://tanstack.com/query/latest/docs/framework/react/reference/hydration), and stores the snapshot through [Storage](/packages/storage). It runs in the browser and in desktop and mobile shells, never on the server. The examples follow Linus, who takes an order on a tablet in a basement with no signal.

## When to use it

Use it to keep **server data** loaded with [Query](/packages/query) usable with no connection, with no change to your queries. It keeps data, not the app itself: to open a web app offline, also turn on the [Web](/packages/web) platform's PWA option. For values the device owns, such as preferences and drafts, use [Storage](/packages/storage); the snapshot here is a cache that can expire and be cleared.

## Install

```sh
kitr add offline
```

<details>
<summary>Everything kitr add changes</summary>

What `kitr add` does:

- Installs `@kitr/offline` and adds it to `packages` in `kitrrc.ts`.
- Adds `() => import('@kitr/offline/provider')` to the end of `providers` in `kitrrc.ts`.
- Writes `config/offline.ts` (shown under [Configure](#configure)).
- Adds `VITE_APP_VERSION` to the public variables in `app/env.ts` as `e.string({ default: '0.0.0' })`, and `VITE_APP_VERSION=0.0.0` to `.env.example` (and to `.env` when it exists).
- Adds a `## kitr: offline` section to `AGENTS.md`: successful queries are persisted and restored before the first render, mutations made offline pause and replay on reconnect, named mutations replay even after a restart, give any other mutation a `mutationKey` and `setMutationDefaults` and an optimistic `onMutate`, and use `useOffline()` from `@kitr/offline/react` for a status line.

No kit includes it. `kitr add offline` adds [Query](/packages/query) and [Storage](/packages/storage) first when the project lacks them, and is refused in a server-only project.

`kitr remove offline` removes the provider, the `packages` entry, the dependency and the `AGENTS.md` section, deletes `config/offline.ts`, and lists the files that still import `@kitr/offline`. It leaves `VITE_APP_VERSION`, Query and Storage in place.

</details>

## Configure

`kitr add offline` writes this file:

```ts
// config/offline.ts
import { defineConfig } from '@kitr/offline'
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

Set `VITE_APP_VERSION` when you build, so every release drops the last one's snapshots:

```sh
VITE_APP_VERSION=$(git rev-parse --short HEAD) kitr build
```

The provider runs only in the `client` environment. At boot it restores the snapshot, so the cache is filled before your first render.

### Keep queries in memory as long as the snapshot

> [!WARNING] Raise gcTime
> TanStack Query drops a query from memory five minutes after its last component unmounts, and a dropped query is not in the next snapshot. Raise `gcTime` in `config/query.ts` to match `maxAge`:

```ts
// config/query.ts
import { defineConfig } from '@kitr/query'

export default defineConfig({
  staleTime: 30_000,
  defaultOptions: {
    queries: { gcTime: 24 * 60 * 60 * 1000 },
  },
})
```

## Show cached data with no connection

Nothing changes in your queries. A query that loaded once is saved, and the next time the app starts it is in the cache before the page renders:

```ts
// app/routes.ts
r.page('/orders', { lazy: () => import('./pages/orders') })
```

```tsx
// app/pages/orders.tsx
import { queryFrom, useQuery } from '@kitr/query'

interface Order {
  id: string
  customer: string
  total: number
}

export const ordersQuery = queryFrom({
  key: () => ['orders', 'list'],
  fetch: async (_input, { signal }): Promise<Order[]> => {
    const res = await fetch('https://api.acme.com/orders', { signal })
    return (await res.json()) as Order[]
  },
})

export default function OrdersPage() {
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

Open `/orders` online, wait a second for the snapshot to be written, then reopen the app offline (as an installed PWA, or in a desktop or mobile shell). The list shows at once with the offline notice. The provider restored the snapshot, so `isPending` is `false`; TanStack then paused the refetch instead of failing it (`fetchStatus` is `'paused'`) and runs it when the network returns.

## Show the connection status

`useOffline()` from `@kitr/offline/react` gives a component the network state, the number of changes waiting to be sent, and whether the cache came from a snapshot:

```tsx
// app/components/connection-status.tsx
import { useOffline } from '@kitr/offline/react'

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

Put `<ConnectionStatus />` in the layout so it shows on every page.

## Choose what to save

`include` gets each successful query's key and decides whether it goes in the snapshot. Leave out data that is cheap to refetch, changes every second, or shouldn't stay on the device:

```ts
// config/offline.ts
import { defineConfig } from '@kitr/offline'
import { env } from '#app/env'

const neverSaved = new Set(['search', 'notifications', 'billing'])

export default defineConfig({
  maxAge: 24 * 60 * 60 * 1000,
  include: (key) => !neverSaved.has(String(key[0])),
  buster: env.VITE_APP_VERSION,
})
```

Here `['orders', 'list']` is saved and `['search', 'Grace']` is not. Keep snapshots small: every save writes the whole snapshot as one string, and `localStorage` holds about 5 MB per origin. A failed write is logged as `persist failed` and the app keeps running.

## Keep private data off the shared device

The snapshot is plain JSON that anyone with the device can read. Clear it, and the in-memory cache, when someone signs out:

```tsx
// app/components/sign-out-button.tsx
import { useQueryClient } from '@kitr/query'
import { useOffline } from '@kitr/offline/react'

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

> [!WARNING] Clear the cache first
> `clear()` deletes the snapshot, but the next cache change saves a new one, so an uncleared cache is written straight back.

> [!WARNING] No secrets in the snapshot
> Leave tokens and card numbers out with `include`, and keep tokens in [Secure storage](/packages/secure-storage).

## Drop old snapshots when you deploy

When a release changes the shape of your data, `buster` stops old snapshots reaching new code: a snapshot saved with another `buster` is deleted at boot. The generated config uses `VITE_APP_VERSION`:

```ts
// app/env.ts
import { createEnv, env as e } from '@kitr/kitr/env'

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

> [!WARNING] Queued changes are dropped too
> Paused mutations in a busted snapshot are deleted with it. Change mutation inputs only when you can afford to lose queued changes, or keep the old `buster`.

## Expire snapshots after a time

`maxAge` is measured from the last save. A snapshot older than `maxAge` is deleted at boot instead of restored:

```ts
// config/offline.ts
import { defineConfig } from '@kitr/offline'
import { env } from '#app/env'

export default defineConfig({
  // A field team works for a week between syncs.
  maxAge: 7 * 24 * 60 * 60 * 1000,
  buster: env.VITE_APP_VERSION,
})
```

An app used every day never hits `maxAge`; it matters for an app left closed. Match `gcTime` to the new `maxAge`, as [Configure](#keep-queries-in-memory-as-long-as-the-snapshot) shows. Restored data keeps its fetch time, so it is refetched as soon as it is stale and the network is up.

## Queue changes while offline

TanStack Query pauses a mutation that starts with no connection, and the provider saves paused mutations in the snapshot. Give each mutation a `mutationKey`, so it can be replayed after a reload, and an optimistic `onMutate`, so the screen shows the change while it waits:

```ts
// app/hooks/orders/use-create-order.ts
import { mutationFrom, useMutation, useQueryClient } from '@kitr/query'

export interface Order {
  id: string
  customer: string
  total: number
}

export const createOrder = mutationFrom({
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
  return useMutation(createOrder, {
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
// app/components/orders/new-order-button.tsx
import { useCreateOrder } from '#app/hooks/orders/use-create-order'

export function NewOrderButton() {
  const createOrder = useCreateOrder()
  return (
    <button type="button" onClick={() => createOrder.mutate({ customer: 'Grace', total: 240 })}>
      New order for Grace
    </button>
  )
}
```

Offline, the order appears in the list at once, `createOrder.isPaused` is `true` and the status line shows one change waiting. When the network returns, TanStack sends the request and the `effects` refetch the list.

> [!WARNING] Don't retry by hand
> The mutation is already queued; a retry with `setTimeout` sends the order twice.

## Replay queued changes after a reload

A mutation restored from a snapshot is data only: its function didn't survive the reload. Named mutations need nothing from you: `useMutation('orders.create')` is keyed by its name, and the provider gives every mutation in the operation registry (each `defineMutation` from [actions](/packages/actions)) its function and effects again.

For an unnamed mutation, register its function for the `mutationKey` with TanStack's [`setMutationDefaults`](https://tanstack.com/query/latest/docs/reference/QueryClient#queryclientsetmutationdefaults), in the `register()` of a provider:

```ts
// app/providers/offline-mutations.ts
import { defineProvider } from '@kitr/kitr/app'
import { createOrder } from '#app/hooks/orders/use-create-order'

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
import { defineKitrConfig } from '@kitr/kitr/app'

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

`createOrder.options({ queryClient })` returns the mutation function and the cache effects. `resumePausedMutations()` sends restored mutations as soon as the app starts online.

> [!WARNING] Set defaults in register()
> Not in `boot()` or a component: by then the mutation was restored without a function and fails with `No mutationFn found`.

## Save and restore by hand

The provider saves one second after the last cache change, and right away when the page is hidden or closed. Outside React, the `offline` service gives you the same controls:

```ts
// app/lib/sync/sync-now.ts
import { useOffline } from '@kitr/offline'
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

`restore()` resolves to `true` when it loaded a snapshot. A corrupt, mismatched or expired snapshot is deleted and `restore()` resolves to `false` without throwing. To use the service with a `QueryClient` you build yourself, call `createOffline(client, config)`:

```ts
// scripts/warm-cache.ts
import { createOffline } from '@kitr/offline'
import { QueryClient } from '@kitr/query'
import { createMemoryStorageDriver } from '@kitr/storage'

const storage = createMemoryStorageDriver()
const client = new QueryClient()
client.setQueryData(['orders', 'list'], [{ id: 'ord_1042', customer: 'Ada', total: 129 }])

createOffline(client, { storage }).persist()
JSON.parse(storage.get('kitr:query-cache') ?? '{}').state.queries.length // => 1
```

## Follow the platform's online state

When [Platform](/packages/platform) is installed, the provider makes TanStack follow the platform's network state, which native shells know better than the browser's events. In a test, pass anything with `isOnline()` and `onOnline(listener)` to `bindOnlineManager`:

```ts
// test/support/network.ts
import { bindOnlineManager } from '@kitr/offline'

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

## Testing

Pass `environment: 'client'` to `createTestApp`, an in-memory storage driver in config, and a snapshot seeded with `createOffline`. TanStack's `onlineManager` takes the app offline:

```ts
// app/lib/orders/offline.test.ts
import { createOffline } from '@kitr/offline'
import offlineProvider from '@kitr/offline/provider'
import { onlineManager, QueryClient } from '@kitr/query'
import queryProvider from '@kitr/query/provider'
import { createMemoryStorageDriver } from '@kitr/storage'
import { createTestApp } from '@kitr/testing'
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

To test that a mutation queues, build it with `client.getMutationCache().build(...)`, call `execute()` while `onlineManager.setOnline(false)`, and wait for `offline.pendingMutations()` to be `1`. Call `client.mount()` so paused mutations can resume.

## Extend

Pass your own `StorageDriver` as `storage` (see [Write a storage driver](/packages/storage#write-a-storage-driver)) to keep the snapshot elsewhere, usually because [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) holds far more than `localStorage`. The service reads synchronously, so `createAsyncStorageDriver` loads the store into memory in `hydrate()`. This driver uses [idb-keyval](https://github.com/jakearchibald/idb-keyval):

```ts
// app/lib/idb-snapshot.ts
import { createStore, del, get, set } from 'idb-keyval'
import { createAsyncStorageDriver } from '@kitr/storage'

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
import { defineConfig } from '@kitr/offline'
import { env } from '#app/env'
import { idbSnapshotStorage } from '#app/lib/idb-snapshot'

export default defineConfig({
  maxAge: 24 * 60 * 60 * 1000,
  buster: env.VITE_APP_VERSION,
  storage: idbSnapshotStorage,
})
```

Nothing calls `hydrate()` on a config driver, so do it in a provider listed **before** `@kitr/offline/provider` in `kitrrc.ts`:

```ts
// app/providers/idb-snapshot.ts
import { defineProvider } from '@kitr/kitr/app'
import { idbSnapshotStorage } from '#app/lib/idb-snapshot'

export default defineProvider({
  name: 'idb-snapshot',
  async boot(app) {
    if (app.isClient) await idbSnapshotStorage.hydrate?.()
  },
})
```

A failed write is logged; pass `onError` to `createAsyncStorageDriver` to handle it yourself.

## Devtools

With [Devtools](/packages/devtools) installed, the Log panel shows `restored` at boot and `persist failed` when a save is refused, usually because storage is full.

## Next steps

- [API reference](/packages/offline/api): every export with its signature.
- [Query](/packages/query): the queries and mutations this package saves.
- [Web](/packages/web): make the app installable so it opens with no connection.
