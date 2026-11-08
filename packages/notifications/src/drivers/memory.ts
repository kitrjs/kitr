import type {
  NotificationOptions,
  NotificationPermission,
  NotificationsDriver,
  ScheduleOptions,
} from '../index'
import { listenerSet } from './listeners'

/** For tests and the server: records what was shown, `tap(id)` simulates a tap. */
export function createMemoryNotificationsDriver(permission: NotificationPermission = 'granted') {
  const taps = listenerSet()
  const shown: Array<NotificationOptions & { id: string }> = []
  const scheduled = new Map<string, ScheduleOptions & { id: string }>()
  let state = permission
  const driver: NotificationsDriver & {
    shown: typeof shown
    scheduled: typeof scheduled
    tap(id: string): void
  } = {
    name: 'memory',
    shown,
    scheduled,
    permission: async () => state,
    request: async () => {
      if (state === 'prompt') state = 'granted'
      return state
    },
    show: async (options) => {
      shown.push(options)
    },
    schedule: async (options) => {
      scheduled.set(options.id, options)
    },
    cancel: async (id) => {
      scheduled.delete(id)
    },
    cancelAll: async () => scheduled.clear(),
    pending: async () => [...scheduled.keys()],
    onTap: taps.on,
    tap(id) {
      const n = shown.find((s) => s.id === id) ?? scheduled.get(id)
      taps.emit({ id, url: n?.url, data: n?.data })
    },
  }
  return driver
}
