import type { NotificationOptions, NotificationPermission, NotificationsDriver } from '../index'
import { listenerSet } from './listeners'

const MAX_TIMEOUT = 2 ** 31 - 1

/**
 * Driver on the browser Notification API, with timers for scheduling. Scheduled ones are lost when
 * the page closes. Falls back to the service worker where the constructor is not allowed.
 */
export function createWebNotificationsDriver(config: { icon?: string } = {}): NotificationsDriver {
  const taps = listenerSet()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const shown = new Map<string, Notification>()
  const api = () => (typeof Notification === 'undefined' ? undefined : Notification)
  const toPermission = (p: string): NotificationPermission =>
    p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'prompt'
  const display = async (options: NotificationOptions & { id: string }) => {
    const N = api()
    if (N?.permission !== 'granted') return
    shown.get(options.id)?.close()
    const init = {
      body: options.body,
      icon: options.icon ?? config.icon,
      tag: options.channel ?? options.id,
      silent: options.silent,
      data: { id: options.id, url: options.url, data: options.data },
    }
    let n: Notification
    try {
      n = new N(options.title, init)
    } catch (error) {
      // Chrome on Android has no page notifications ("Illegal constructor"): only a service
      // worker can show one. Taps then reach the worker's notificationclick, not onTap.
      const sw = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker
      if (!sw?.controller) throw error
      await (await sw.ready).showNotification(options.title, init)
      return
    }
    n.onclick = () => {
      window.focus()
      n.close()
      taps.emit({ id: options.id, url: options.url, data: options.data })
    }
    n.onclose = () => shown.delete(options.id)
    shown.set(options.id, n)
  }
  return {
    name: 'web',
    permission: async () => (api() ? toPermission(api()!.permission) : 'unsupported'),
    request: async () => (api() ? toPermission(await api()!.requestPermission()) : 'unsupported'),
    show: (options) => display(options),
    schedule: async (options) => {
      const at = new Date(options.at).getTime()
      clearTimeout(timers.get(options.id))
      // setTimeout overflows past ~24.8 days and fires at once; wait in steps instead.
      const wait = () => {
        const delay = Math.max(0, at - Date.now())
        timers.set(
          options.id,
          setTimeout(
            () => {
              if (at - Date.now() > 0) return wait()
              timers.delete(options.id)
              void display(options).catch(() => {})
            },
            Math.min(delay, MAX_TIMEOUT),
          ),
        )
      }
      wait()
    },
    cancel: async (id) => {
      clearTimeout(timers.get(id))
      timers.delete(id)
      shown.get(id)?.close()
    },
    cancelAll: async () => {
      for (const t of timers.values()) clearTimeout(t)
      timers.clear()
      for (const n of shown.values()) n.close()
    },
    pending: async () => [...timers.keys()],
    onTap: taps.on,
  }
}
