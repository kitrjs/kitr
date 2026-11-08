import { createDefineConfig, getDevtools, type KitrApp } from '@kitr/core'
import { runtimeOf } from '@kitr/platform'
import { selectDriver } from './driver'

export { type Driver, type DriverOptions, selectDriver } from './driver'
export {
  type CapacitorPush,
  capacitorPush,
  createCapacitorDriver as createCapacitorNotificationsDriver,
  type PushMessage,
} from './drivers/capacitor'
export {
  createElectronDriver as createElectronNotificationsDriver,
  type ElectronNotificationsDriver,
} from './drivers/electron'
export { createMemoryNotificationsDriver } from './drivers/memory'
export { createTauriDriver as createTauriNotificationsDriver } from './drivers/tauri'
export { createWebNotificationsDriver } from './drivers/web'

/**
 * Local notifications with one API: ask for permission, show one now or at a time, and learn
 * which one was tapped so the app can open the right page. Platform packages register a
 * `NotificationsDriver`; the web driver uses the Notification API and a timer for scheduling.
 */

/** Where permission stands: `prompt` until asked, `unsupported` where there is no notification API. */
export type NotificationPermission = 'granted' | 'denied' | 'prompt' | 'unsupported'

/** What to show: a title, optional body and icon, and the `url` a tap should open. */
export interface NotificationOptions {
  /** Your own id, so the same notification can be replaced or cancelled. Default: generated. */
  id?: string
  /** The first line. */
  title: string
  /** The text under the title. */
  body?: string
  /** Where a tap should take the person, e.g. `/inbox/42`. Handed to `onTap` listeners. */
  url?: string
  /** The image beside the text. Default: `config.icon` on the web. */
  icon?: string
  /** Platform-specific extras passed through to the driver. */
  data?: Record<string, unknown>
  /** Group id (Android channel, web tag). */
  channel?: string
  /** Show without sound or vibration. */
  silent?: boolean
}

/** A notification to show later. */
export interface ScheduleOptions extends NotificationOptions {
  /** When to show it: a `Date` or a timestamp in milliseconds. A past time shows it at once. */
  at: Date | number
}

/** What a tap listener receives: the notification's id and the `url` and `data` it was shown with. */
export interface NotificationTap {
  /** The id `show()` or `schedule()` resolved to. */
  id: string
  /** The `url` the notification was shown with. */
  url?: string
  /** The `data` the notification was shown with. */
  data?: Record<string, unknown>
}

/** What a platform implements to show notifications. The service always passes an id. */
export interface NotificationsDriver {
  /** Shown in devtools, such as `web` or `memory`. */
  name: string
  /** Read the permission state without asking. */
  permission(): Promise<NotificationPermission>
  /** Ask for permission; resolves to the new state. */
  request(): Promise<NotificationPermission>
  /** Show now, replacing any notification with the same id. */
  show(options: NotificationOptions & { id: string }): Promise<void>
  /** Show at `options.at`, replacing any scheduled notification with the same id. */
  schedule(options: ScheduleOptions & { id: string }): Promise<void>
  /** Stop a scheduled notification and close it if shown. */
  cancel(id: string): Promise<void>
  /** Cancel everything. Without it the service cancels each pending id. */
  cancelAll?(): Promise<void>
  /** Ids scheduled and not yet shown. Without it the service answers `[]`. */
  pending?(): Promise<string[]>
  /** Listen for taps; returns a function that removes the listener. */
  onTap(listener: (tap: NotificationTap) => void): () => void
}

/** Options for `config/notifications.ts` and `createNotifications()`. */
export interface NotificationsConfig {
  /** Replace the driver the service would pick (tests, custom shells). */
  driver?: NotificationsDriver
  /** Default icon for web notifications. */
  icon?: string
  /** Ask for permission at boot instead of waiting for the first `request()`. Default false. */
  requestOnBoot?: boolean
  /**
   * In a native shell (Electron, Tauri, Capacitor) with no notifications driver, use the web
   * driver inside the WebView instead of throwing `E_DRIVER_UNAVAILABLE`. Default false.
   */
  fallbackToWeb?: boolean
}

/** The `notifications` service: permission, show, schedule, cancel and taps. */
export interface Notifications {
  /** The active driver. */
  readonly driver: NotificationsDriver
  /** Read the permission state without asking. */
  permission(): Promise<NotificationPermission>
  /** Ask once; resolves to the new state. Call it from a click, browsers block unprompted asks. */
  request(): Promise<NotificationPermission>
  /** Show now. Resolves to the notification id. */
  show(options: NotificationOptions): Promise<string>
  /** Show later. Resolves to the id, usable with `cancel()`. */
  schedule(options: ScheduleOptions): Promise<string>
  /** Stop a scheduled notification and close it if shown. */
  cancel(id: string): Promise<void>
  /** Cancel every scheduled notification and close shown ones. */
  cancelAll(): Promise<void>
  /** Ids of scheduled notifications not yet delivered. */
  pending(): Promise<string[]>
  /** A notification was tapped (the app may have been opened by it). */
  onTap(listener: (tap: NotificationTap) => void): () => void
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    notifications: NotificationsConfig
  }
  interface ContainerBindings {
    notifications: Notifications
  }
  interface DriverTypes {
    notifications: NotificationsDriver
  }
}

/** Types `config/notifications.ts`. Returns the object unchanged. */
export const defineConfig = createDefineConfig<NotificationsConfig>()

let counter = 0 // kitr-allow-module-state: only makes ids unique; sharing it between apps cannot collide
/** A unique id such as `n-m5x2k1qz-0`, used when `show()` or `schedule()` gets none. */
export function notificationId(): string {
  return `n-${Date.now().toString(36)}-${(counter++).toString(36)}`
}

/**
 * Build the `notifications` service. The driver is `config.driver`, else the one registered on
 * `app`, else `selectDriver()` for the runtime: the web driver in a browser, a memory driver (`unsupported`)
 * on the server, and `E_DRIVER_UNAVAILABLE` in a native shell unless `fallbackToWeb` is set.
 */
export function createNotifications(
  config: NotificationsConfig = {},
  app?: KitrApp,
): Notifications {
  const driver =
    config.driver ??
    app?.drivers.resolve('notifications') ??
    selectDriver(runtimeOf(app), { icon: config.icon, fallbackToWeb: config.fallbackToWeb })
  const log = (label: string, data?: unknown) =>
    app && getDevtools(app)?.log('notifications', label, data)
  return {
    driver,
    permission: () => driver.permission(),
    async request() {
      const state = await driver.request()
      log('permission', state)
      return state
    },
    async show(options) {
      const id = options.id ?? notificationId()
      await driver.show({ ...options, id })
      log('show', { id, title: options.title })
      return id
    },
    async schedule(options) {
      if (Number.isNaN(new Date(options.at).getTime()))
        throw new Error(
          `[kitr/notifications] schedule() needs a valid \`at\`, got ${String(options.at)}`,
        )
      const id = options.id ?? notificationId()
      await driver.schedule({ ...options, id })
      log('schedule', { id, at: new Date(options.at).toISOString() })
      return id
    },
    cancel: (id) => driver.cancel(id),
    cancelAll: async () => {
      if (driver.cancelAll) return driver.cancelAll()
      for (const id of (await driver.pending?.()) ?? []) await driver.cancel(id)
    },
    pending: async () => (await driver.pending?.()) ?? [],
    onTap: (listener) =>
      driver.onTap((tap) => {
        log('tap', tap)
        listener(tap)
      }),
  }
}

/** The app's `notifications` service, outside React. Same as `app.container.use('notifications')`. */
export function useNotifications(app: KitrApp): Notifications {
  return app.container.use('notifications')
}
