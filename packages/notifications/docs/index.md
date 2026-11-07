---
title: Notifications
description: Ask for permission and show local or scheduled notifications that open the right page when tapped.
order: 1
---

# Notifications

A reminder to approve an invoice, a note that an order has shipped, a nudge before a meeting: some things should reach people even when your tab is in the background. `kitr/notifications` gives you one `notifications` service to ask for permission, show a notification now or at a set time, and find out which one was tapped so the app opens the right page.

In the browser it is built on the [Notification API](https://developer.mozilla.org/docs/Web/API/Notifications_API), with timers for scheduling. kitr adds stable ids you can cancel by, a `url` carried from the notification to its tap, a React hook for the permission state, a memory driver for tests and a driver slot for native shells.

It runs in the browser and in desktop and mobile shells; on the server the service shows nothing. It covers notifications the app shows itself. Push notifications sent from your server while the app is closed need a push service (APNs, FCM or [Web Push](https://developer.mozilla.org/docs/Web/API/Push_API)) on top.

This guide follows Acme's billing screen at `app.acme.com`: Ada turns on reminders, schedules one to approve invoice `inv_1042`, and lands on that invoice when she taps it.

## Install

```sh
kitr add notifications
```

What `kitr add` does:

- Installs `@kitr/notifications` and adds it to `packages` in `kitrrc.ts`.
- Adds `() => import('@kitr/notifications/provider')` to `providers` in `kitrrc.ts`.
- Writes `config/notifications.ts` (shown under [Configure](#configure)).
- Adds a `## kitr: notifications` section to `AGENTS.md`: `useNotificationPermission()` gives `{ permission, request }` and `request` is called from a click, `show({ title, url })` and `schedule({ ..., at })` resolve to an id for `cancel`, and taps are routed once near the router with `useNotificationTap`.

It adds no environment variables or scripts. `kitr add notifications` asks no questions, and no kit includes it. To preview the changes:

```sh
kitr add notifications --dry-run
```

`kitr remove notifications` removes the provider, the `packages` entry, the dependency, the `AGENTS.md` section and `config/notifications.ts`, then lists the files that still import `kitr/notifications`.

## Configure

`kitr add` writes this file:

```ts
// config/notifications.ts
import { defineConfig } from 'kitr/notifications'

export default defineConfig({
  icon: '/icon-192.png',
  // Ask from a click (browsers block unprompted asks); true asks at boot instead.
  requestOnBoot: false,
})
```

| Option | Default | Description |
| --- | --- | --- |
| `icon` | none | Icon for browser notifications that don't set their own. A path under `public/` or a full URL. |
| `requestOnBoot` | `false` | Ask for permission as the app starts in the browser. Browsers block or bury asks that don't follow a click, so leave it off for websites. |
| `driver` | registered, else the web driver | A `NotificationsDriver` that replaces the one the service would pick. For tests and custom shells. |

The service picks its driver in this order: `driver` from the config, a driver a provider registered under `notifications`, then the web driver in a browser, or a memory driver whose permission is `'unsupported'` on the server.

Point `icon` at a file that exists. The [Web](/packages/web) platform's PWA manifest uses `/icons/icon-192.png` by default, not the `/icon-192.png` that `kitr add` writes, so with `pwa` on you usually want `icon: '/icons/icon-192.png'`. A missing icon shows the notification with the browser's default image.

## Send your first notification

Ask for permission from a button, then show a notification:

```tsx
// app/features/invoices/notify-me.tsx
import { useNotificationPermission, useNotifications } from 'kitr/notifications/react'

export function NotifyMe() {
  const { permission, request } = useNotificationPermission()
  const notifications = useNotifications()
  if (permission === 'unsupported' || permission === 'denied') return null
  if (permission !== 'granted')
    return (
      <button type="button" onClick={request}>
        Turn on notifications
      </button>
    )
  return (
    <button
      type="button"
      onClick={() =>
        notifications.show({
          title: 'Invoice inv_1042 is due',
          body: 'Acme Corp, $1,280.00, due Friday',
          url: '/invoices/inv_1042',
        })
      }
    >
      Test a notification
    </button>
  )
}
```

Ada clicks **Turn on notifications**, the browser asks, and she allows it. The button changes to **Test a notification**; clicking it shows a system notification titled "Invoice inv_1042 is due" with Acme's icon. Routing the tap to `/invoices/inv_1042` is covered in [Open the right page when tapped](#open-the-right-page-when-tapped).

## Ask for permission

`useNotificationPermission()` returns `{ permission, request }`. `permission` is `'unknown'` on the first render and on the server, then one of four states:

| State | Meaning | What to show |
| --- | --- | --- |
| `'prompt'` | Not asked yet, or the person closed the prompt. | A button that calls `request`. |
| `'granted'` | Notifications will show. | Your reminder controls. |
| `'denied'` | Blocked. The page cannot ask again. | Nothing, or how to unblock it in the browser's site settings. |
| `'unsupported'` | No Notification API here, or the server. | Nothing. |

`request()` resolves to the new state, so you can act on the answer in the same handler:

```tsx
// app/features/invoices/enable-reminders.tsx
import { useNotificationPermission } from 'kitr/notifications/react'

export function EnableReminders({ onEnabled }: { onEnabled: () => void }) {
  const { permission, request } = useNotificationPermission()
  if (permission === 'denied')
    return <p>Reminders are blocked. Allow notifications for app.acme.com in your browser settings.</p>
  if (permission !== 'prompt') return null
  async function enable() {
    const state = await request()
    // => 'granted' or 'denied', or 'prompt' when Ada closed the prompt
    if (state === 'granted') onEnabled()
  }
  return (
    <button type="button" onClick={enable}>
      Remind me about due invoices
    </button>
  )
}
```

Call `request` from a click. Browsers ignore or quietly block permission prompts that no gesture started, and Safari requires one. Don't call it from an effect on page load; ask when the person does something that needs a notification.

For an installed app or a kiosk where an ask at start is expected, set `requestOnBoot: true`. The provider then calls `request()` as the app boots in the browser.

Outside React, `notifications.permission()` reads the state without asking.

## Show a notification now

`notifications.show(options)` resolves to the notification's id:

```ts
// app/features/orders/notify-shipped.ts
import type { Notifications } from 'kitr/notifications'

export async function notifyShipped(notifications: Notifications, orderId: string) {
  const id = await notifications.show({
    title: `Order ${orderId} has shipped`,
    body: 'Arriving Thursday at Acme HQ',
    url: `/orders/${orderId}`,
    data: { orderId },
  })
  // => 'n-m5x2k1qz-0' (generated)
  return id
}
```

| Option | Default | Description |
| --- | --- | --- |
| `title` | required | The first line. |
| `body` | none | The text under the title. |
| `url` | none | Where a tap should go, such as `/orders/ord_3001`. Handed to tap listeners. |
| `id` | generated | Your own id, to replace or cancel this notification later. |
| `icon` | `config.icon` | The image beside the text. |
| `data` | none | Extra values handed to tap listeners and passed to native drivers. |
| `channel` | the id | A group. On the web it is the notification's `tag`, so a new one in the same channel replaces the old. On Android it is the notification channel. |
| `silent` | `false` | Show it without sound or vibration. |

On the web, `show()` does nothing while permission is not `'granted'`, and still resolves to an id. Check `permission` before you rely on a notification being seen.

Use it for events that happen while the app is open, such as a realtime message saying an order shipped. When the app is closed, nothing on the device runs your code, so only a push service can notify.

## Replace a notification

Give a notification your own `id` to update it instead of stacking a second one. Showing the same id again closes the first:

```ts
// app/features/orders/orders-export.ts
import type { Notifications } from 'kitr/notifications'

export async function reportExport(notifications: Notifications, done: number, total: number) {
  await notifications.show({
    id: 'orders-export',
    title: done < total ? `Exporting orders: ${done} of ${total}` : 'Orders export ready',
    url: done < total ? undefined : '/orders/exports',
    silent: done < total,
  })
}
```

Each call replaces the last, so Ada sees one notification that ends as "Orders export ready". `channel` does the same for notifications with different ids: the browser keeps one notification per `tag`.

## Schedule a notification

`notifications.schedule(options)` takes everything `show` takes plus `at`, a `Date` or a timestamp in milliseconds, and resolves to the id:

```tsx
// app/features/invoices/remind-later.tsx
import { useNotifications } from 'kitr/notifications/react'

export function RemindLater({ invoiceId }: { invoiceId: string }) {
  const notifications = useNotifications()
  async function remind() {
    const id = await notifications.schedule({
      id: `approve-${invoiceId}`,
      title: `Approve invoice ${invoiceId}`,
      body: 'Grace is waiting on your approval',
      url: `/invoices/${invoiceId}`,
      at: Date.now() + 60 * 60 * 1000,
    })
    // => 'approve-inv_1042'
    return id
  }
  return (
    <button type="button" onClick={remind}>
      Remind me in an hour
    </button>
  )
}
```

A time in the past shows the notification straight away. Scheduling an id that is already scheduled replaces it, so `approve-inv_1042` can only fire once. An invalid `at`, such as `new Date('next week')` or `NaN`, rejects:

```ts
// app/features/invoices/bad-reminder.ts
import type { Notifications } from 'kitr/notifications'

export async function badReminder(notifications: Notifications) {
  await notifications.schedule({ title: 'Approve invoice inv_1042', at: new Date('next week') })
  // throws Error: [kitr/notifications] schedule() needs a valid `at`, got Invalid Date
}
```

> **Warning**
> On the web, scheduled notifications live in a timer inside the page. They are lost when the tab closes or reloads, and browsers slow timers in background tabs. For a reminder that must arrive, schedule it on your server and deliver it with Web Push, or use a native driver that hands it to the operating system.

The web driver waits in steps, so a reminder 40 days out does not fire early when it passes the browser's 24.8-day timer limit.

## Cancel notifications

Cancel by the id that `show` or `schedule` resolved to, list what is still waiting, or clear everything:

```ts
// app/features/invoices/approve.ts
import type { Notifications } from 'kitr/notifications'

export async function onInvoiceApproved(notifications: Notifications, invoiceId: string) {
  await notifications.cancel(`approve-${invoiceId}`)
  const waiting = await notifications.pending()
  // => ['approve-inv_1043'], the ids scheduled and not yet shown
  return waiting
}

export async function onSignOut(notifications: Notifications) {
  await notifications.cancelAll()
}
```

`cancel(id)` stops a scheduled notification and, on the web, closes it if it is on screen. `cancelAll()` does both for every notification this page showed or scheduled. Call it when someone signs out, so Linus doesn't get Ada's reminders on a shared computer. `pending()` lists only scheduled notifications that haven't fired; shown ones are not in it.

## Open the right page when tapped

`useNotificationTap(handler)` calls `handler` with `{ id, url, data }` whenever a notification is clicked. Mount it once, inside the router, so every tap navigates:

```tsx
// app/components/notification-router.tsx
import { useNotificationTap } from 'kitr/notifications/react'
import { useNavigate } from 'kitr/router'
import { useCallback } from 'react'

export function NotificationRouter() {
  const navigate = useNavigate()
  const onTap = useCallback(
    (tap: { id: string; url?: string }) => {
      if (tap.url) void navigate({ to: tap.url })
    },
    [navigate],
  )
  useNotificationTap(onTap)
  return null
}
```

```tsx
// app/document.tsx
import { HeadContent, Outlet, Scripts } from 'kitr/router'
import { NotificationRouter } from '#app/components/notification-router'

export function RootDocument() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <NotificationRouter />
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
```

Ada clicks "Approve invoice inv_1042", the browser focuses the Acme tab, closes the notification and the app moves to `/invoices/inv_1042`. Wrapping the handler in `useCallback` keeps the hook from re-subscribing on every render.

Don't mount `useNotificationTap` in each page that shows notifications: a tap on a notification from another page would then go nowhere. One listener near the router handles them all.

Outside React, `notifications.onTap(listener)` returns a function that removes the listener:

```ts
// app/features/invoices/track-taps.ts
import type { Notifications } from 'kitr/notifications'

export function trackReminderTaps(notifications: Notifications, record: (id: string) => void) {
  return notifications.onTap((tap) => {
    if (tap.id.startsWith('approve-')) record(tap.id)
  })
}
```

## Show notifications on Chrome for Android

Chrome on Android does not let a page construct a `Notification`. When the constructor throws and a [service worker](https://developer.mozilla.org/docs/Web/API/ServiceWorkerRegistration/showNotification) controls the page, the web driver shows the notification through the worker instead. Turn on `pwa` in the [Web](/packages/web) platform so the app has one:

```ts
// kitrrc.ts
import { defineKitrConfig } from 'kitr/app'
import { web } from 'kitr/web'

export default defineKitrConfig({
  // ...
  platforms: {
    site: web({ mode: 'spa', pwa: true }),
  },
})
```

Taps on those notifications reach the worker's `notificationclick` event, not `onTap`. The notification's `data` holds `{ id, url, data }`, so a custom worker can open `url`. Without a controlling service worker, `show()` on Chrome for Android rejects with the browser's `TypeError: Illegal constructor`.

## Use it outside React

Read the service from the app's container. `useNotifications(app)` from `kitr/notifications` does the same thing:

```ts
// app/features/orders/on-shipped.ts
import type { KitrApp } from 'kitr/app'
import { useNotifications } from 'kitr/notifications'

export async function onOrderShipped(app: KitrApp, orderId: string) {
  const notifications = useNotifications(app) // same as app.container.use('notifications')
  if ((await notifications.permission()) !== 'granted') return
  await notifications.show({ title: `Order ${orderId} has shipped`, url: `/orders/${orderId}` })
}
```

To build a service with no app, call `createNotifications(config)`. In a browser it uses the web driver; in Node, the memory driver with `'unsupported'` permission. When the [Devtools](/packages/devtools) provider is installed, the service logs each permission answer, show, schedule and tap under `notifications`.

## Where notifications come from

| Where it runs | Driver | Scheduled notifications |
| --- | --- | --- |
| Browser | `createWebNotificationsDriver()`, the Notification API | Fire only while the page is open. |
| Chrome for Android | The same driver, through the service worker | The same. |
| Desktop and mobile shells | The web driver inside the webview, unless a provider registers one | The same, until a native driver is registered. |
| Server | Memory driver, permission `'unsupported'` | Nothing is shown. |

Today [Desktop](/packages/desktop) (Electron), [Tauri](/packages/tauri) and [Mobile](/packages/mobile) register only `platform` and `storage` drivers. To hand notifications to the operating system, so scheduled ones fire with the app closed, register a `notifications` driver as shown under [Extend](#extend).

## Errors

| Error | When | What to do |
| --- | --- | --- |
| ``[kitr/notifications] schedule() needs a valid `at` `` | `at` is an invalid `Date` or `NaN`. | Pass a `Date` or a timestamp in milliseconds. |
| `TypeError: Illegal constructor` (browser) | Chrome for Android, with no service worker controlling the page. | Turn on `pwa` in the web platform. |

A `show()` without permission is not an error: it resolves and shows nothing. A denied permission is a state, not an exception.

## Testing

`createMemoryNotificationsDriver(permission)` records everything and shows nothing. Its permission starts at the state you pass (default `'granted'`); `request()` turns `'prompt'` into `'granted'` and leaves every other state as it is. It adds three things to the driver:

| Member | Description |
| --- | --- |
| `shown` | Every notification passed to `show`, with its id. |
| `scheduled` | A `Map` of id to the scheduled notification, emptied by `cancel` and `cancelAll`. |
| `tap(id)` | Simulates a tap on a shown or scheduled notification, calling every tap listener with its `url` and `data`. |

Hand it to the app through `config.notifications.driver`:

```tsx
// app/features/invoices/remind-later.test.tsx
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { createMemoryNotificationsDriver } from 'kitr/notifications'
import { notificationsProvider } from 'kitr/notifications/provider'
import { useNotificationTap } from 'kitr/notifications/react'
import { createTestApp } from 'kitr/testing'
import { renderWithKitr } from 'kitr/testing/react'
import { describe, expect, it, vi } from 'vitest'
import { EnableReminders } from './enable-reminders'
import { RemindLater } from './remind-later'

describe('invoice reminders', () => {
  it('asks for permission from the button', async () => {
    const driver = createMemoryNotificationsDriver('prompt')
    const app = await createTestApp({
      providers: [notificationsProvider],
      config: { notifications: { driver } },
    })
    const onEnabled = vi.fn()
    renderWithKitr(<EnableReminders onEnabled={onEnabled} />, { app })
    fireEvent.click(await screen.findByRole('button', { name: 'Remind me about due invoices' }))
    await waitFor(() => expect(onEnabled).toHaveBeenCalled())
    expect(await driver.permission()).toBe('granted')
  })

  it('schedules one reminder per invoice and routes the tap', async () => {
    const driver = createMemoryNotificationsDriver()
    const app = await createTestApp({
      providers: [notificationsProvider],
      config: { notifications: { driver } },
    })
    const opened: string[] = []
    function Taps() {
      useNotificationTap((tap) => tap.url && opened.push(tap.url))
      return null
    }
    renderWithKitr(
      <>
        <Taps />
        <RemindLater invoiceId="inv_1042" />
      </>,
      { app },
    )
    const button = screen.getByRole('button', { name: 'Remind me in an hour' })
    fireEvent.click(button)
    fireEvent.click(button)
    await waitFor(() => expect(driver.scheduled.size).toBe(1))
    expect(driver.scheduled.get('approve-inv_1042')).toMatchObject({
      title: 'Approve invoice inv_1042',
      url: '/invoices/inv_1042',
    })
    driver.tap('approve-inv_1042')
    expect(opened).toEqual(['/invoices/inv_1042'])
  })
})
```

To test code that takes the service directly, build one with `createNotifications`:

```ts
// app/features/invoices/approve.test.ts
import { createMemoryNotificationsDriver, createNotifications } from 'kitr/notifications'
import { expect, it } from 'vitest'
import { onInvoiceApproved } from './approve'

it('cancels the reminder once the invoice is approved', async () => {
  const driver = createMemoryNotificationsDriver()
  const notifications = createNotifications({ driver })
  await notifications.schedule({ id: 'approve-inv_1042', title: 'Approve', at: Date.now() + 1000 })
  await notifications.schedule({ id: 'approve-inv_1043', title: 'Approve', at: Date.now() + 1000 })
  expect(await onInvoiceApproved(notifications, 'inv_1042')).toEqual(['approve-inv_1043'])
})
```

To test the web driver itself, stub the global `Notification` class with `vi.stubGlobal('Notification', ...)` and use fake timers for `schedule`.

## Extend

A driver implements `NotificationsDriver`. The service generates ids before it calls `show` and `schedule`, so a driver always receives one:

```ts
interface NotificationsDriver {
  name: string
  permission(): Promise<NotificationPermission> // 'granted' | 'denied' | 'prompt' | 'unsupported'
  request(): Promise<NotificationPermission>
  show(options: NotificationOptions & { id: string }): Promise<void>
  schedule(options: ScheduleOptions & { id: string }): Promise<void>
  cancel(id: string): Promise<void>
  cancelAll?(): Promise<void> // optional: the service falls back to cancel() on each pending id
  pending?(): Promise<string[]> // optional: the service answers [] without it
  onTap(listener: (tap: NotificationTap) => void): () => void
}
```

This driver hands notifications to iOS and Android through [`@capacitor/local-notifications`](https://capacitorjs.com/docs/apis/local-notifications), so scheduled ones fire with the app closed. Capacitor needs whole-number ids, so the driver hashes kitr's string id and keeps the original in `extra`. Install it with `pnpm add @capacitor/local-notifications`, then create the provider with `kitr make:provider notifications_driver`:

```ts
// app/providers/notifications_driver_provider.ts
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { defineProvider } from 'kitr/app'
import type { NotificationPermission, NotificationsDriver } from 'kitr/notifications'

const numeric = (id: string) => {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return Math.abs(hash)
}
const toState = (display: string): NotificationPermission =>
  display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt'

function capacitorNotifications(): NotificationsDriver {
  const post = (o: Parameters<NotificationsDriver['show']>[0], at?: Date) =>
    LocalNotifications.schedule({
      notifications: [
        {
          id: numeric(o.id),
          title: o.title,
          body: o.body ?? '',
          channelId: o.channel,
          schedule: at ? { at } : undefined,
          extra: { id: o.id, url: o.url, data: o.data },
        },
      ],
    }).then(() => undefined)
  return {
    name: 'capacitor',
    permission: async () => toState((await LocalNotifications.checkPermissions()).display),
    request: async () => toState((await LocalNotifications.requestPermissions()).display),
    show: (o) => post(o),
    schedule: (o) => post(o, new Date(o.at)),
    cancel: (id) => LocalNotifications.cancel({ notifications: [{ id: numeric(id) }] }),
    pending: async () =>
      (await LocalNotifications.getPending()).notifications.map((n) => String(n.extra?.id ?? n.id)),
    onTap(listener) {
      const handle = LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
        const extra = event.notification.extra ?? {}
        listener({ id: extra.id ?? String(event.notification.id), url: extra.url, data: extra.data })
      })
      return () => void handle.then((h) => h.remove())
    },
  }
}

export default defineProvider({
  name: 'notifications-driver',
  register(app) {
    if (Capacitor.isNativePlatform())
      app.drivers.register('notifications', capacitorNotifications(), { platform: 'mobile' })
  },
})
```

Add `() => import('#app/providers/notifications_driver_provider')` to `providers` in `kitrrc.ts`. Inside the iOS or Android app, `notifications.driver.name` is now `'capacitor'` and Ada's reminder fires even after she closes the app; in the browser, the web driver still applies. The `NotificationsDriver`, `NotificationOptions` and `NotificationTap` types are in the [API reference](/packages/notifications/api).

## Next steps

- [API reference](/packages/notifications/api)
- [Notifications API on MDN](https://developer.mozilla.org/docs/Web/API/Notifications_API): what each browser supports.
- [Web](/packages/web): the `pwa` option that adds the service worker Chrome for Android needs.
- [Realtime](/packages/realtime): learn about a shipped order while the app is open, then show a notification.
- [Jobs](/packages/jobs): schedule reminders on the server, where they survive a closed tab.
- [Mobile](/packages/mobile): the Capacitor shell that a native driver plugs into.
