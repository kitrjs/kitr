---
title: Overview
description: Ask for permission and show local or scheduled notifications that open the right page when tapped.
order: 0
---

# Notifications

## What it is

`@kitr/notifications` asks for permission, shows a notification now or later, replaces or cancels one by id, and tells you which one was tapped so the app opens the right page.

Runs in the browser and in desktop and mobile shells. Push from your server while the app is closed needs a push service on top.

## Install

```sh
kitr add notifications
```

Adds `@kitr/notifications`, its provider and `config/notifications.ts`. [Every change](/packages/notifications/guide#install).

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

Click **Turn on notifications** and allow it. Then **Test a notification** shows a system notification with the app's icon. Next in the guide: [Send your first notification](/packages/notifications/guide#send-your-first-notification).

## Built on

kitr adds stable ids, a `url` carried to the tap, the permission and tap hooks, a memory driver and the `NotificationsDriver` interface.

## Problems it solves

- **Asking for permission at the wrong moment.** [Ask for permission](/packages/notifications/guide#ask-for-permission).
- **Duplicate notifications.** [Replace a notification](/packages/notifications/guide#replace-a-notification).
- **Reminders for later.** [Schedule a notification](/packages/notifications/guide#schedule-a-notification).
- **Taps that open the home page.** [Open the right page when tapped](/packages/notifications/guide#open-the-right-page-when-tapped).
- **Nothing showing on Android.** [Show notifications on Chrome for Android](/packages/notifications/guide#show-notifications-on-chrome-for-android).

## Further reading

- [Guide](/packages/notifications/guide).
- [API reference](/packages/notifications/api).
- [Notifications API on MDN](https://developer.mozilla.org/docs/Web/API/Notifications_API) and [Push API on MDN](https://developer.mozilla.org/docs/Web/API/Push_API).
- [Web](/packages/web), [Jobs](/packages/jobs) and [Realtime](/packages/realtime).
