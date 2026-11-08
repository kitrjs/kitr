import { driverUnavailable, loadShellModule } from '@kitr/platform'
import type { Driver, DriverOptions } from '../driver'
import type { NotificationPermission, NotificationTap } from '../index'

/** The part of `@tauri-apps/plugin-notification` the driver uses. */
interface NotificationPlugin {
  isPermissionGranted(): Promise<boolean>
  requestPermission(): Promise<'granted' | 'denied' | 'default'>
  sendNotification(options: {
    id?: number
    title: string
    body?: string
    icon?: string
    silent?: boolean
    extra?: Record<string, unknown>
  }): void
  cancel?(ids: number[]): Promise<void>
  removeActive?(notifications: Array<{ id: number }>): Promise<void>
  onAction?(
    listener: (notification: { extra?: Record<string, unknown> }) => void,
  ): Promise<{ unregister(): Promise<void> }>
}

const MAX_TIMEOUT = 2 ** 31 - 1

/** The plugin wants a 32-bit integer id; the service's ids are strings. */
export function numericId(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (Math.imul(hash, 31) + id.charCodeAt(i)) | 0
  return hash
}

/**
 * The notifications driver for the Tauri shell, on `@tauri-apps/plugin-notification` (imported on
 * first use, an optional peer: methods reject with `E_DRIVER_UNAVAILABLE` when it is missing).
 * Permission is read and asked through the plugin. The desktop plugin shows a notification at once
 * and cannot schedule one, so `schedule()` waits in a timer inside the window (lost when the app
 * quits) and shows it then; on mobile the same timer applies. The plugin reports a tap only on
 * mobile, so `onTap` listeners fire there and stay silent on desktop.
 */
export function createTauriDriver(_options: DriverOptions = {}): Driver {
  let plugin: Promise<NotificationPlugin> | undefined
  const load = () =>
    (plugin ??= loadShellModule<NotificationPlugin>('@tauri-apps/plugin-notification').catch(() => {
      plugin = undefined
      throw driverUnavailable(
        'tauri',
        'notifications',
        '@tauri-apps/plugin-notification is not installed (run `npm install @tauri-apps/plugin-notification`, add tauri-plugin-notification in src-tauri and allow notification:default)',
      )
    }))
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const toPermission = (state: string): NotificationPermission =>
    state === 'granted' ? 'granted' : state === 'denied' ? 'denied' : 'prompt'
  const display = async (options: {
    id: string
    title: string
    body?: string
    icon?: string
    silent?: boolean
    url?: string
    data?: Record<string, unknown>
  }) => {
    const p = await load()
    p.sendNotification({
      id: numericId(options.id),
      title: options.title,
      body: options.body,
      icon: options.icon,
      silent: options.silent,
      extra: { id: options.id, url: options.url, data: options.data },
    })
  }
  return {
    name: 'tauri',
    async permission() {
      return (await (await load()).isPermissionGranted()) ? 'granted' : 'prompt'
    },
    async request() {
      const p = await load()
      if (await p.isPermissionGranted()) return 'granted'
      return toPermission(await p.requestPermission())
    },
    show: display,
    async schedule(options) {
      await load()
      const at = new Date(options.at).getTime()
      clearTimeout(timers.get(options.id))
      // setTimeout overflows past ~24.8 days and fires at once; wait in steps instead.
      const wait = () => {
        timers.set(
          options.id,
          setTimeout(
            () => {
              if (at - Date.now() > 0) return wait()
              timers.delete(options.id)
              void display(options).catch(() => {})
            },
            Math.min(Math.max(0, at - Date.now()), MAX_TIMEOUT),
          ),
        )
      }
      wait()
    },
    async cancel(id) {
      clearTimeout(timers.get(id))
      timers.delete(id)
      const p = await load()
      // Mobile only: desktop has no way to withdraw a notification that was shown.
      await p.removeActive?.([{ id: numericId(id) }]).catch(() => {})
      await p.cancel?.([numericId(id)]).catch(() => {})
    },
    async cancelAll() {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    },
    pending: async () => [...timers.keys()],
    onTap(listener) {
      let off: (() => Promise<void>) | undefined
      let stopped = false
      void load()
        .then((p) => p.onAction?.((n) => listener((n.extra ?? {}) as unknown as NotificationTap)))
        .then((registration) => {
          if (!registration) return
          if (stopped) void registration.unregister()
          else off = () => registration.unregister()
        })
        .catch(() => {})
      return () => {
        stopped = true
        void off?.()
      }
    },
  }
}
