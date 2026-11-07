---
title: Notifications
description: Ask for permission and show local or scheduled notifications that open the right page when tapped.
order: 1
---

# Notifications

One `notifications` service for local notifications: permission, show now, show at a time, and a tap listener that carries the `url` you attached so the app opens the right page. Native drivers come from the mobile and desktop packages; the web driver uses the Notification API.

## Install

```sh
kitr add notifications
```

```ts
// config/notifications.ts
import { defineConfig } from 'kitr/notifications'

export default defineConfig({
  icon: '/icon-192.png',
  requestOnBoot: false, // ask from a click instead; browsers block unprompted asks
})
```

## In a component

```tsx
import { useNavigate } from 'kitr/router'
import { useNotificationPermission, useNotifications, useNotificationTap } from 'kitr/notifications/react'

function Reminders() {
  const { permission, request } = useNotificationPermission()
  const notifications = useNotifications()
  const navigate = useNavigate()
  useNotificationTap((tap) => tap.url && navigate({ to: tap.url }))

  if (permission !== 'granted') return <button onClick={request}>Enable reminders</button>
  return (
    <button onClick={() => notifications.schedule({ title: 'Stand up', url: '/today', at: Date.now() + 30 * 60_000 })}>
      Remind me in 30 minutes
    </button>
  )
}
```

`show()` and `schedule()` resolve to an id you can `cancel()`. On the web, scheduled notifications live as long as the page; native drivers hand them to the OS so they fire with the app closed.

## Drivers

Platform packages register under the `notifications` capability. Tests pass `createMemoryNotificationsDriver()` and call `driver.tap(id)` to simulate a tap.
