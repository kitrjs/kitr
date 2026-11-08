---
title: Overview
description: Keep showing loaded data with no connection, and send queued changes when the network comes back.
order: 0
---

# Offline

## What it is

`@kitr/offline` saves the [query](/packages/query) cache to the device and restores it at boot, so the app shows data with no connection. Changes made offline queue up and run when the network is back. `useOffline()` drives a status line.

Runs in the browser and in native shells. It keeps data offline, not the app itself: for that, use the [web](/packages/web) platform's PWA option too.

## Install

```sh
kitr add offline
```

Adds `@kitr/offline`, its provider, `config/offline.ts` and `VITE_APP_VERSION` in `.env.example`. [Every change](/packages/offline/guide#install).

## Quick start

Nothing changes in your queries. A query that loaded once is restored before the page renders:

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

Load `/orders` online, go offline, reopen the app. The list shows at once with "Offline. Showing the last orders loaded." When the network returns, it refreshes. Next in the guide: [Show cached data with no connection](/packages/offline/guide#show-cached-data-with-no-connection).

## Built on

kitr adds the throttled save, the restore at boot, versioned snapshots, mutation replay after a reload and `useOffline()`.

## Problems it solves

- **Spinners with no connection.** [Show cached data with no connection](/packages/offline/guide#show-cached-data-with-no-connection).
- **People not knowing they are offline.** [Show the connection status](/packages/offline/guide#show-the-connection-status).
- **Private data left on a shared device.** [Keep private data off the shared device](/packages/offline/guide#keep-private-data-off-the-shared-device).
- **Old snapshots after a deploy.** [Drop old snapshots when you deploy](/packages/offline/guide#drop-old-snapshots-when-you-deploy).
- **Changes lost in a tunnel.** [Queue changes while offline](/packages/offline/guide#queue-changes-while-offline).
- **Queued changes lost on reload.** [Replay queued changes after a reload](/packages/offline/guide#replay-queued-changes-after-a-reload).

## Further reading

- [Guide](/packages/offline/guide).
- [API reference](/packages/offline/api).
- [TanStack Query: network mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode) and [hydration](https://tanstack.com/query/latest/docs/framework/react/reference/hydration).
- [Query](/packages/query), [Storage](/packages/storage) and [Web](/packages/web).
