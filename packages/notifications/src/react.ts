import { useApp } from '@kitr/react'
import { useCallback, useEffect, useState } from 'react'
import type { NotificationPermission, Notifications, NotificationTap } from './index'

/** The app's `notifications` service in a component. */
export function useNotifications(): Notifications {
  return useApp().container.use('notifications')
}

/** `{ permission, request }`: the current state and a function to ask (call it from a click). */
export function useNotificationPermission(): {
  permission: NotificationPermission | 'unknown'
  request: () => Promise<NotificationPermission>
} {
  const notifications = useNotifications()
  const [permission, setPermission] = useState<NotificationPermission | 'unknown'>('unknown')
  useEffect(() => {
    let live = true
    notifications.permission().then((p) => live && setPermission(p))
    return () => {
      live = false
    }
  }, [notifications])
  const request = useCallback(async () => {
    const p = await notifications.request()
    setPermission(p)
    return p
  }, [notifications])
  return { permission, request }
}

/** Run a handler when a notification is tapped, typically `(tap) => tap.url && navigate(tap.url)`. */
export function useNotificationTap(handler: (tap: NotificationTap) => void) {
  const notifications = useNotifications()
  useEffect(() => notifications.onTap(handler), [notifications, handler])
}
