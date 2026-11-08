---
title: Overview
description: Ask for permission and show local or scheduled notifications that open the right page when tapped.
order: 0
---

# Notifications

A reminder to approve an invoice, a note that an order has shipped, a nudge before a meeting: some things should reach people even when your tab is in the background. The browser's Notification API gives you the popup. It does not give you stable ids, scheduling, or a way to know which notification was tapped and where the app should go.

`@kitr/notifications` adds those, with one service that works the same in the browser and in native shells.

## What it is

`@kitr/notifications` is a `notifications` service to ask for permission, show a notification now or at a set time, replace or cancel one by id, and find out which one was tapped so the app opens the right page. React hooks give you the permission state and the tap. A memory driver makes it testable, and a driver slot lets a native shell plug in the operating system's own notifications.

It runs in the browser and in desktop and mobile shells; on the server the service shows nothing. It covers notifications the app shows itself. Push notifications sent from your server while the app is closed need a push service (APNs, FCM or Web Push) on top.

## Install

```sh
kitr add notifications
```

This installs `@kitr/notifications`, registers the provider in `kitrrc.ts` and writes `config/notifications.ts`. The guide's [Install](/packages/notifications/guide#install) section lists every change.

## Quick start

Ask for permission from a button, then show a notification:

```tsx
// app/features/invoices/notify-me.tsx
import { useNotificationPermission, useNotifications } from '@kitr/notifications/react'

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

Ada clicks **Turn on notifications**, the browser asks, and she allows it. The button changes to **Test a notification**; clicking it shows a system notification titled "Invoice inv_1042 is due" with the app's icon. In the desktop and mobile shells the same component runs on the web driver until you register a native one. The guide continues from here: [Send your first notification](/packages/notifications/guide#send-your-first-notification).

## Built on

In the browser, `@kitr/notifications` is built on the [Notification API](https://developer.mozilla.org/docs/Web/API/Notifications_API), with timers for scheduling and the service worker from the [web](/packages/web) platform's PWA option where Chrome for Android requires it. kitr adds stable ids you can cancel by, a `url` carried from the notification to its tap, `useNotificationPermission` and `useNotificationTap`, the memory driver and the `NotificationsDriver` interface.

## Problems it solves

- **Asking for permission at the wrong moment.** Ask from a button the person understands, and read the state with a hook. See [Ask for permission](/packages/notifications/guide#ask-for-permission).
- **Duplicate notifications.** Showing again with the same id replaces the old one. See [Replace a notification](/packages/notifications/guide#replace-a-notification).
- **Reminders for later.** Schedule a notification for a time, and cancel it if the task is done early. See [Schedule a notification](/packages/notifications/guide#schedule-a-notification).
- **Taps that open the home page.** Each notification carries a `url`, and the tap hook navigates there. See [Open the right page when tapped](/packages/notifications/guide#open-the-right-page-when-tapped).
- **Nothing showing on Android.** Chrome for Android needs a service worker; the guide shows the PWA setup. See [Show notifications on Chrome for Android](/packages/notifications/guide#show-notifications-on-chrome-for-android).

## Further reading

- [Guide](/packages/notifications/guide): install, configure and every task.
- [API reference](/packages/notifications/api): every export and type.
- [Notifications API on MDN](https://developer.mozilla.org/docs/Web/API/Notifications_API) and [Push API on MDN](https://developer.mozilla.org/docs/Web/API/Push_API): what each browser supports, and what server push needs.
- [Web](/packages/web), [Jobs](/packages/jobs) and [Realtime](/packages/realtime): the service worker, server-side reminders, and the events that trigger a notification.
