import { driverUnavailable } from '@kitr/platform'
import type { Driver, DriverOptions } from '../driver'
import type { NotificationPermission, NotificationTap } from '../index'
import { listenerSet } from './listeners'

/**
 * Import one Capacitor plugin on first use, so web bundles never load it. A plugin that is not
 * installed turns into `E_DRIVER_UNAVAILABLE` naming the package to install.
 */
async function plugin<T>(pkg: string, load: () => Promise<T>): Promise<T> {
  try {
    return await load()
  } catch {
    throw driverUnavailable('capacitor', 'notifications', `install ${pkg}`)
  }
}

const local = () =>
  plugin('@capacitor/local-notifications', () => import('@capacitor/local-notifications')).then(
    (m) => m.LocalNotifications,
  )
const pushPlugin = () =>
  plugin('@capacitor/push-notifications', () => import('@capacitor/push-notifications')).then(
    (m) => m.PushNotifications,
  )

/**
 * Capacitor reports `granted`, `denied`, `prompt` and `prompt-with-rationale` (Android, after a
 * first refusal). The last is still a question the app may ask again, so it maps to `prompt`.
 */
export function toPermission(state: string): NotificationPermission {
  return state === 'granted' ? 'granted' : state === 'denied' ? 'denied' : 'prompt'
}

/** Capacitor ids are 32-bit integers; kitr ids are strings. A stable FNV-1a hash maps one to the other. */
export function nativeId(id: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) & 0x7fffffff
}

const EXTRA_ID = 'kitrId'
const EXTRA_URL = 'kitrUrl'
const EXTRA_DATA = 'kitrData'

type Channel = { id: string; name: string; importance: 1 | 2 | 3 | 4 | 5 }

function tapFromExtra(extra: unknown, fallbackId: string): NotificationTap {
  const e = (extra && typeof extra === 'object' ? extra : {}) as Record<string, unknown>
  return {
    id: typeof e[EXTRA_ID] === 'string' ? (e[EXTRA_ID] as string) : fallbackId,
    url: typeof e[EXTRA_URL] === 'string' ? (e[EXTRA_URL] as string) : undefined,
    data:
      e[EXTRA_DATA] && typeof e[EXTRA_DATA] === 'object'
        ? (e[EXTRA_DATA] as Record<string, unknown>)
        : undefined,
  }
}

/** Subscribe to a plugin event whose listener is added asynchronously; the returned function stops it. */
function subscribe(add: () => Promise<{ remove(): Promise<void> }>) {
  let handle: { remove(): Promise<void> } | undefined
  let stopped = false
  add()
    .then((h) => {
      if (stopped) void h.remove()
      else handle = h
    })
    .catch(() => {})
  return () => {
    stopped = true
    void handle?.remove()
    handle = undefined
  }
}

/**
 * Notifications on `@capacitor/local-notifications`: the OS schedules and shows them, so scheduled
 * ones survive the app closing (the web driver's timers do not). On Android a `channel` becomes a
 * notification channel, created on first use. Taps from `@capacitor/push-notifications` reach
 * `onTap` too when that plugin is installed; its token and listeners are in `capacitorPush()`.
 */
export function createCapacitorDriver(_options: DriverOptions = {}): Driver {
  const taps = listenerSet()
  const channels = new Set<string>()
  let listening = false
  const ensureChannel = async (name: string | undefined) => {
    if (!name || channels.has(name)) return
    channels.add(name)
    const channel: Channel = { id: name, name, importance: 3 }
    // Only Android has channels: iOS rejects the call, which is fine.
    await (await local()).createChannel(channel).catch(() => {})
  }
  const listen = () => {
    if (listening) return
    listening = true
    subscribe(async () =>
      (await local()).addListener('localNotificationActionPerformed', ({ notification }) =>
        taps.emit(tapFromExtra(notification.extra, String(notification.id))),
      ),
    )
    subscribe(async () =>
      (await pushPlugin()).addListener('pushNotificationActionPerformed', ({ notification }) => {
        const data = (notification.data ?? {}) as Record<string, unknown>
        const url = typeof data.url === 'string' ? data.url : notification.link
        taps.emit({ id: notification.id, url, data })
      }),
    )
  }
  const toSchema = async (
    options: {
      id: string
      title: string
      body?: string
      url?: string
      data?: Record<string, unknown>
      channel?: string
      silent?: boolean
    },
    at?: Date,
  ) => {
    await ensureChannel(options.channel)
    return {
      id: nativeId(options.id),
      title: options.title,
      body: options.body ?? '',
      channelId: options.channel,
      silent: options.silent,
      schedule: at ? { at, allowWhileIdle: true } : undefined,
      extra: { [EXTRA_ID]: options.id, [EXTRA_URL]: options.url, [EXTRA_DATA]: options.data },
    }
  }
  return {
    name: 'capacitor',
    permission: async () => toPermission((await (await local()).checkPermissions()).display),
    request: async () => toPermission((await (await local()).requestPermissions()).display),
    async show(options) {
      const notification = await toSchema(options)
      await (await local()).schedule({ notifications: [notification] })
    },
    async schedule(options) {
      const notification = await toSchema(options, new Date(options.at))
      await (await local()).schedule({ notifications: [notification] })
    },
    async cancel(id) {
      const L = await local()
      const native = nativeId(id)
      await L.cancel({ notifications: [{ id: native }] })
      await L.removeDeliveredNotificationsById({ ids: [native] })
    },
    async cancelAll() {
      const L = await local()
      await L.cancelAll()
      await L.removeAllDeliveredNotifications()
    },
    async pending() {
      const { notifications } = await (await local()).getPending()
      return notifications.map((n) => tapFromExtra(n.extra, String(n.id)).id)
    },
    onTap(listener) {
      listen()
      return taps.on(listener)
    },
  }
}

/** A push message, in the fields apps use. */
export interface PushMessage {
  id: string
  title?: string
  body?: string
  data: Record<string, unknown>
}

/** Remote (FCM and APNs) notifications on `@capacitor/push-notifications`. */
export interface CapacitorPush {
  /** The permission to receive push notifications. */
  permission(): Promise<NotificationPermission>
  /** Ask for it. */
  request(): Promise<NotificationPermission>
  /** Register with FCM or APNs and resolve to the device token to send to your server. */
  register(): Promise<string>
  /** Called with each push that arrives while the app is open. */
  onReceived(listener: (message: PushMessage) => void): () => void
  /** Called when a push is tapped, with its `url` (from `data.url` or `link`) when it has one. */
  onAction(listener: (tap: NotificationTap & { actionId: string }) => void): () => void
}

const toMessage = (n: {
  id: string
  title?: string
  body?: string
  data?: unknown
}): PushMessage => ({
  id: n.id,
  title: n.title,
  body: n.body,
  data: (n.data ?? {}) as Record<string, unknown>,
})

/**
 * Push notifications through `@capacitor/push-notifications`. Needs Firebase on Android
 * (`google-services.json`) and the Push Notifications capability on iOS; see the package docs.
 */
export function capacitorPush(): CapacitorPush {
  return {
    permission: async () => toPermission((await (await pushPlugin()).checkPermissions()).receive),
    request: async () => toPermission((await (await pushPlugin()).requestPermissions()).receive),
    async register() {
      const Push = await pushPlugin()
      return new Promise<string>((resolve, reject) => {
        const handles: Array<Promise<{ remove(): Promise<void> }>> = []
        const done = () => {
          for (const h of handles) void h.then((x) => x.remove())
        }
        handles.push(
          Push.addListener('registration', (token) => {
            done()
            resolve(token.value)
          }),
          Push.addListener('registrationError', (error) => {
            done()
            reject(new Error(error.error))
          }),
        )
        Promise.all(handles)
          .then(() => Push.register())
          .catch((error) => {
            done()
            reject(error)
          })
      })
    },
    onReceived: (listener) =>
      subscribe(async () =>
        (await pushPlugin()).addListener('pushNotificationReceived', (n) => listener(toMessage(n))),
      ),
    onAction: (listener) =>
      subscribe(async () =>
        (await pushPlugin()).addListener('pushNotificationActionPerformed', (a) => {
          const message = toMessage(a.notification)
          const url = typeof message.data.url === 'string' ? message.data.url : a.notification.link
          listener({ id: message.id, url, data: message.data, actionId: a.actionId })
        }),
      ),
  }
}
