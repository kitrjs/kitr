---
title: Overview
description: Keep showing loaded data with no connection, and send queued changes when the network comes back.
order: 0
---

# Offline

A train goes into a tunnel, the warehouse wifi drops, the app is reopened on a plane. Without help, every screen turns into a spinner or an error, and anything the person did while disconnected is lost. The data was on the device a minute ago; the app just did not keep it.

`@kitr/offline` keeps a copy of the data your app already loaded and puts it back before the first render, so the app opens with the last known data and sends queued changes when the network returns.

## What it is

`@kitr/offline` saves the [query](/packages/query) cache to the device, throttled, and restores it at boot before anything renders. Mutations made with no connection pause in a queue and run when the network is back, including after a reload. `useOffline()` gives a status line the connection state and the number of queued changes. A version in config drops old snapshots when you deploy a release that changed the data shape.

It runs in the browser and in desktop and mobile shells, never on the server. It keeps **data** available offline, not the app itself: to open a web app with no connection, also make it installable with the [web](/packages/web) platform's PWA option.

## Install

```sh
kitr add offline
```

This installs `@kitr/offline`, registers the provider at the end of `providers` in `kitrrc.ts`, writes `config/offline.ts` and adds `VITE_APP_VERSION` to `app/env.ts` and `.env.example`. The guide's [Install](/packages/offline/guide#install) section lists every change.

## Quick start

Nothing changes in your queries. A query that loaded once is saved, and the next time the app starts it is in the cache before the page renders:

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

Open `/orders` with the network on and wait a second for the snapshot to be written. Close the tab, set the browser's devtools to **Offline**, and open the app again. The list shows the orders at once, with "Offline. Showing the last orders loaded." above it, instead of "Loading orders…". When the network returns, the paused refetch runs and the list updates. The guide continues from here: [Show cached data with no connection](/packages/offline/guide#show-cached-data-with-no-connection).

## Built on

`@kitr/offline` is built on [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode)'s own network mode, which pauses queries and mutations while offline, and its [dehydrate and hydrate](https://tanstack.com/query/latest/docs/framework/react/reference/hydration) functions, which turn the cache into JSON and back. The snapshot is stored through [storage](/packages/storage), so desktop and mobile apps keep it in the native store, and the online state comes from [platform](/packages/platform).

kitr adds the throttled save, the restore at boot, choosing which queries to persist, version-based and time-based invalidation, mutation defaults so paused mutations replay after a reload, and the `useOffline()` hook.

## Problems it solves

- **Spinners with no connection.** The last loaded data is restored before the first render. See [Show cached data with no connection](/packages/offline/guide#show-cached-data-with-no-connection).
- **People not knowing they are offline.** A status hook for a banner or a badge. See [Show the connection status](/packages/offline/guide#show-the-connection-status).
- **Private data left on a shared device.** Choose which queries are saved and which never touch the disk. See [Keep private data off the shared device](/packages/offline/guide#keep-private-data-off-the-shared-device).
- **Old snapshots after a deploy.** Bump the version and stale snapshots are dropped. See [Drop old snapshots when you deploy](/packages/offline/guide#drop-old-snapshots-when-you-deploy).
- **Changes lost in a tunnel.** Mutations queue while offline and run when the network returns. See [Queue changes while offline](/packages/offline/guide#queue-changes-while-offline).
- **Queued changes lost on reload.** Register mutation defaults and the queue replays after a restart. See [Replay queued changes after a reload](/packages/offline/guide#replay-queued-changes-after-a-reload).

## Further reading

- [Guide](/packages/offline/guide): install, configure and every task.
- [API reference](/packages/offline/api): every export and type.
- [TanStack Query: network mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode) and [hydration](https://tanstack.com/query/latest/docs/framework/react/reference/hydration): how paused queries behave and how the cache is serialized.
- [Query](/packages/query), [Storage](/packages/storage) and [Web](/packages/web): the cache it saves, where it saves it, and making the app itself open offline.
