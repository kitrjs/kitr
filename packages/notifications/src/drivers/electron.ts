import { driverUnavailable } from '@kitr/platform'
import type { Driver, DriverOptions } from '../driver'
import type { NotificationPermission, NotificationTap } from '../index'

/** The preload bridge `exposeIpc()` from `@kitr/desktop/preload` puts on `window`. */
interface Bridge {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>
  on(channel: string, listener: (...args: unknown[]) => void): () => void
}

/** The Electron driver, with the dock/taskbar badge that only desktop shells have. */
export interface ElectronNotificationsDriver extends Driver {
  /** Set the app badge count (dock on macOS, launcher on Linux); 0 clears it. */
  setBadge(count: number): Promise<void>
}

/**
 * The notifications driver for the Electron shell. Notifications are Electron `Notification`s
 * shown by the main process over the `kitr:notify:*` channels of `handleKitrIpc()`: no permission
 * prompt on desktop, so `permission()` and `request()` answer `granted` (or `unsupported` where the
 * OS has no notification service). Scheduled notifications live in the main process, so they
 * survive a window reload but not quitting the app. Clicking one focuses the window and calls
 * `onTap` with the `url` and `data` it was shown with. `setBadge(count)` sets the app badge.
 *
 * Throws `E_DRIVER_UNAVAILABLE` when the preload bridge is missing (no `exposeIpc()` call).
 */
export function createElectronDriver(_options: DriverOptions = {}): ElectronNotificationsDriver {
  const bridge = (globalThis as { kitrIpc?: Bridge }).kitrIpc
  if (!bridge)
    throw driverUnavailable(
      'electron',
      'notifications',
      'the kitrIpc preload bridge is missing: call exposeIpc() in the preload script',
    )
  const taps = new Set<(tap: NotificationTap) => void>()
  let stop: (() => void) | undefined
  const permission = async () =>
    (await bridge.invoke('kitr:notify:permission')) as NotificationPermission
  return {
    name: 'electron',
    permission,
    request: permission,
    async show(options) {
      await bridge.invoke('kitr:notify:show', pick(options))
    },
    async schedule(options) {
      await bridge.invoke('kitr:notify:schedule', {
        ...pick(options),
        at: new Date(options.at).getTime(),
      })
    },
    async cancel(id) {
      await bridge.invoke('kitr:notify:cancel', id)
    },
    async cancelAll() {
      await bridge.invoke('kitr:notify:cancel-all')
    },
    pending: async () => ((await bridge.invoke('kitr:notify:pending')) as string[]) ?? [],
    onTap(listener) {
      taps.add(listener)
      stop ??= bridge.on('kitr:notify:click', (tap) => {
        for (const l of taps) l(tap as NotificationTap)
      })
      return () => {
        taps.delete(listener)
        if (!taps.size && stop) {
          stop()
          stop = undefined
        }
      }
    },
    async setBadge(count) {
      await bridge.invoke('kitr:notify:badge', count)
    },
  }
}

/** What crosses the process boundary: structured-cloneable fields only. */
function pick(options: {
  id: string
  title: string
  body?: string
  silent?: boolean
  url?: string
  data?: Record<string, unknown>
}) {
  return {
    id: options.id,
    title: options.title,
    body: options.body,
    silent: options.silent,
    url: options.url,
    data: options.data,
  }
}
