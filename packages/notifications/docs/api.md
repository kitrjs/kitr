---
title: API reference
description: Every export of @kitr/notifications, with its signature.
order: 2
---

# API reference

Every export of `@kitr/notifications`, `@kitr/notifications/react`, `@kitr/notifications/provider`, `@kitr/notifications/driver`, `@kitr/notifications/drivers/web`, `@kitr/notifications/drivers/electron`, `@kitr/notifications/drivers/tauri`, `@kitr/notifications/drivers/capacitor`, read from the published type definitions. The [guide](/packages/notifications/guide) shows them in use.

## @kitr/notifications

### capacitorPush

```ts
function capacitorPush(): CapacitorPush;
```

Push notifications through `@capacitor/push-notifications`. Needs Firebase on Android
(`google-services.json`) and the Push Notifications capability on iOS; see the package docs.

### createCapacitorNotificationsDriver

```ts
function createCapacitorNotificationsDriver(_options?: DriverOptions): Driver;
```

Notifications on `@capacitor/local-notifications`: the OS schedules and shows them, so scheduled
ones survive the app closing (the web driver's timers do not). On Android a `channel` becomes a
notification channel, created on first use. Taps from `@capacitor/push-notifications` reach
`onTap` too when that plugin is installed; its token and listeners are in `capacitorPush()`.

### createElectronNotificationsDriver

```ts
function createElectronNotificationsDriver(_options?: DriverOptions): ElectronNotificationsDriver;
```

The notifications driver for the Electron shell. Notifications are Electron `Notification`s
shown by the main process over the `kitr:notify:*` channels of `handleKitrIpc()`: no permission
prompt on desktop, so `permission()` and `request()` answer `granted` (or `unsupported` where the
OS has no notification service). Scheduled notifications live in the main process, so they
survive a window reload but not quitting the app. Clicking one focuses the window and calls
`onTap` with the `url` and `data` it was shown with. `setBadge(count)` sets the app badge.

Throws `E_DRIVER_UNAVAILABLE` when the preload bridge is missing (no `exposeIpc()` call).

### createMemoryNotificationsDriver

```ts
function createMemoryNotificationsDriver(permission?: NotificationPermission): NotificationsDriver & {
  shown: (NotificationOptions & {
    id: string;
  })[];
  scheduled: Map<string, ScheduleOptions & {
    id: string;
  }>;
  tap(id: string): void;
};
```

For tests and the server: records what was shown, `tap(id)` simulates a tap.

### createNotifications

```ts
function createNotifications(config?: NotificationsConfig, app?: KitrApp): Notifications;
```

Build the `notifications` service. The driver is `config.driver`, else the one registered on
`app`, else `selectDriver()` for the runtime: the web driver in a browser, a memory driver (`unsupported`)
on the server, and `E_DRIVER_UNAVAILABLE` in a native shell unless `fallbackToWeb` is set.

### createTauriNotificationsDriver

```ts
function createTauriNotificationsDriver(_options?: DriverOptions): Driver;
```

The notifications driver for the Tauri shell, on `@tauri-apps/plugin-notification` (imported on
first use, an optional peer: methods reject with `E_DRIVER_UNAVAILABLE` when it is missing).
Permission is read and asked through the plugin. The desktop plugin shows a notification at once
and cannot schedule one, so `schedule()` waits in a timer inside the window (lost when the app
quits) and shows it then; on mobile the same timer applies. The plugin reports a tap only on
mobile, so `onTap` listeners fire there and stay silent on desktop.

### createWebNotificationsDriver

```ts
function createWebNotificationsDriver(config?: {
  icon?: string;
}): NotificationsDriver;
```

Driver on the browser Notification API, with timers for scheduling. Scheduled ones are lost when
the page closes. Falls back to the service worker where the constructor is not allowed.

### notificationId

```ts
function notificationId(): string;
```

A unique id such as `n-m5x2k1qz-0`, used when `show()` or `schedule()` gets none.

### selectDriver

```ts
function selectDriver(runtime: Runtime, options?: DriverOptions): Driver;
```

The notifications driver for a runtime: the browser Notification API on `web` (a memory driver
reporting `unsupported` on the server), and each native shell's own driver. A shell with no
driver yet throws `E_DRIVER_UNAVAILABLE` rather than falling back to the web one, unless
`fallbackToWeb` is set.

### useNotifications

```ts
function useNotifications(app: KitrApp): Notifications;
```

The app's `notifications` service, outside React. Same as `app.container.use('notifications')`.

### defineConfig

```ts
const defineConfig: <const C extends NotificationsConfig>(config: C) => C;
```

Types `config/notifications.ts`. Returns the object unchanged.

### CapacitorPush

```ts
interface CapacitorPush {
  /** The permission to receive push notifications. */
  permission(): Promise<NotificationPermission>;
  /** Ask for it. */
  request(): Promise<NotificationPermission>;
  /** Register with FCM or APNs and resolve to the device token to send to your server. */
  register(): Promise<string>;
  /** Called with each push that arrives while the app is open. */
  onReceived(listener: (message: PushMessage) => void): () => void;
  /** Called when a push is tapped, with its `url` (from `data.url` or `link`) when it has one. */
  onAction(listener: (tap: NotificationTap & {
    actionId: string;
  }) => void): () => void;
}
```

Remote (FCM and APNs) notifications on `@capacitor/push-notifications`.

### DriverOptions

```ts
interface DriverOptions extends SelectDriverOptions {
  /** Default icon for web notifications. */
  icon?: string;
}
```

Options of `selectDriver()`.

### ElectronNotificationsDriver

```ts
interface ElectronNotificationsDriver extends Driver {
  /** Set the app badge count (dock on macOS, launcher on Linux); 0 clears it. */
  setBadge(count: number): Promise<void>;
}
```

The Electron driver, with the dock/taskbar badge that only desktop shells have.

### NotificationOptions

```ts
interface NotificationOptions {
  /** Your own id, so the same notification can be replaced or cancelled. Default: generated. */
  id?: string;
  /** The first line. */
  title: string;
  /** The text under the title. */
  body?: string;
  /** Where a tap should take the person, e.g. `/inbox/42`. Handed to `onTap` listeners. */
  url?: string;
  /** The image beside the text. Default: `config.icon` on the web. */
  icon?: string;
  /** Platform-specific extras passed through to the driver. */
  data?: Record<string, unknown>;
  /** Group id (Android channel, web tag). */
  channel?: string;
  /** Show without sound or vibration. */
  silent?: boolean;
}
```

What to show: a title, optional body and icon, and the `url` a tap should open.

### Notifications

```ts
interface Notifications {
  /** The active driver. */
  readonly driver: NotificationsDriver;
  /** Read the permission state without asking. */
  permission(): Promise<NotificationPermission>;
  /** Ask once; resolves to the new state. Call it from a click, browsers block unprompted asks. */
  request(): Promise<NotificationPermission>;
  /** Show now. Resolves to the notification id. */
  show(options: NotificationOptions): Promise<string>;
  /** Show later. Resolves to the id, usable with `cancel()`. */
  schedule(options: ScheduleOptions): Promise<string>;
  /** Stop a scheduled notification and close it if shown. */
  cancel(id: string): Promise<void>;
  /** Cancel every scheduled notification and close shown ones. */
  cancelAll(): Promise<void>;
  /** Ids of scheduled notifications not yet delivered. */
  pending(): Promise<string[]>;
  /** A notification was tapped (the app may have been opened by it). */
  onTap(listener: (tap: NotificationTap) => void): () => void;
}
```

The `notifications` service: permission, show, schedule, cancel and taps.

### NotificationsConfig

```ts
interface NotificationsConfig {
  /** Replace the driver the service would pick (tests, custom shells). */
  driver?: NotificationsDriver;
  /** Default icon for web notifications. */
  icon?: string;
  /** Ask for permission at boot instead of waiting for the first `request()`. Default false. */
  requestOnBoot?: boolean;
  /**
   * In a native shell (Electron, Tauri, Capacitor) with no notifications driver, use the web
   * driver inside the WebView instead of throwing `E_DRIVER_UNAVAILABLE`. Default false.
   */
  fallbackToWeb?: boolean;
}
```

Options for `config/notifications.ts` and `createNotifications()`.

### NotificationsDriver

```ts
interface NotificationsDriver {
  /** Shown in devtools, such as `web` or `memory`. */
  name: string;
  /** Read the permission state without asking. */
  permission(): Promise<NotificationPermission>;
  /** Ask for permission; resolves to the new state. */
  request(): Promise<NotificationPermission>;
  /** Show now, replacing any notification with the same id. */
  show(options: NotificationOptions & {
    id: string;
  }): Promise<void>;
  /** Show at `options.at`, replacing any scheduled notification with the same id. */
  schedule(options: ScheduleOptions & {
    id: string;
  }): Promise<void>;
  /** Stop a scheduled notification and close it if shown. */
  cancel(id: string): Promise<void>;
  /** Cancel everything. Without it the service cancels each pending id. */
  cancelAll?(): Promise<void>;
  /** Ids scheduled and not yet shown. Without it the service answers `[]`. */
  pending?(): Promise<string[]>;
  /** Listen for taps; returns a function that removes the listener. */
  onTap(listener: (tap: NotificationTap) => void): () => void;
}
```

What a platform implements to show notifications. The service always passes an id.

### NotificationTap

```ts
interface NotificationTap {
  /** The id `show()` or `schedule()` resolved to. */
  id: string;
  /** The `url` the notification was shown with. */
  url?: string;
  /** The `data` the notification was shown with. */
  data?: Record<string, unknown>;
}
```

What a tap listener receives: the notification's id and the `url` and `data` it was shown with.

### PushMessage

```ts
interface PushMessage {
  id: string;
  title?: string;
  body?: string;
  data: Record<string, unknown>;
}
```

A push message, in the fields apps use.

### ScheduleOptions

```ts
interface ScheduleOptions extends NotificationOptions {
  /** When to show it: a `Date` or a timestamp in milliseconds. A past time shows it at once. */
  at: Date | number;
}
```

A notification to show later.

### Driver

```ts
type Driver = NotificationsDriver;
```

What a notifications driver is: `NotificationsDriver`, whichever runtime supplies it.

### NotificationPermission

```ts
/** Where permission stands: `prompt` until asked, `unsupported` where there is no notification API. */
type NotificationPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';
```

Where permission stands: `prompt` until asked, `unsupported` where there is no notification API.

## @kitr/notifications/react

### useNotificationPermission

```ts
function useNotificationPermission(): {
  permission: NotificationPermission | 'unknown';
  request: () => Promise<NotificationPermission>;
};
```

`{ permission, request }`: the current state and a function to ask (call it from a click).

### useNotifications

```ts
function useNotifications(): Notifications;
```

The app's `notifications` service in a component.

### useNotificationTap

```ts
function useNotificationTap(handler: (tap: NotificationTap) => void): void;
```

Run a handler when a notification is tapped, typically `(tap) => tap.url && navigate(tap.url)`.

## @kitr/notifications/provider

### notificationsProvider

```ts
const notificationsProvider: import("@kitr/core").KitrProvider;
```

Binds `notifications` to the platform driver (`notifications` capability) or the web
Notification API. With `requestOnBoot` it asks for permission as the app starts.

## @kitr/notifications/driver

### selectDriver

```ts
function selectDriver(runtime: Runtime, options?: DriverOptions): Driver;
```

The notifications driver for a runtime: the browser Notification API on `web` (a memory driver
reporting `unsupported` on the server), and each native shell's own driver. A shell with no
driver yet throws `E_DRIVER_UNAVAILABLE` rather than falling back to the web one, unless
`fallbackToWeb` is set.

### DriverOptions

```ts
interface DriverOptions extends SelectDriverOptions {
  /** Default icon for web notifications. */
  icon?: string;
}
```

Options of `selectDriver()`.

### Driver

```ts
type Driver = NotificationsDriver;
```

What a notifications driver is: `NotificationsDriver`, whichever runtime supplies it.

## @kitr/notifications/drivers/web

### createWebNotificationsDriver

```ts
function createWebNotificationsDriver(config?: {
  icon?: string;
}): NotificationsDriver;
```

Driver on the browser Notification API, with timers for scheduling. Scheduled ones are lost when
the page closes. Falls back to the service worker where the constructor is not allowed.

## @kitr/notifications/drivers/electron

### createElectronDriver

```ts
function createElectronDriver(_options?: DriverOptions): ElectronNotificationsDriver;
```

The notifications driver for the Electron shell. Notifications are Electron `Notification`s
shown by the main process over the `kitr:notify:*` channels of `handleKitrIpc()`: no permission
prompt on desktop, so `permission()` and `request()` answer `granted` (or `unsupported` where the
OS has no notification service). Scheduled notifications live in the main process, so they
survive a window reload but not quitting the app. Clicking one focuses the window and calls
`onTap` with the `url` and `data` it was shown with. `setBadge(count)` sets the app badge.

Throws `E_DRIVER_UNAVAILABLE` when the preload bridge is missing (no `exposeIpc()` call).

### ElectronNotificationsDriver

```ts
interface ElectronNotificationsDriver extends Driver {
  /** Set the app badge count (dock on macOS, launcher on Linux); 0 clears it. */
  setBadge(count: number): Promise<void>;
}
```

The Electron driver, with the dock/taskbar badge that only desktop shells have.

## @kitr/notifications/drivers/tauri

### createTauriDriver

```ts
function createTauriDriver(_options?: DriverOptions): Driver;
```

The notifications driver for the Tauri shell, on `@tauri-apps/plugin-notification` (imported on
first use, an optional peer: methods reject with `E_DRIVER_UNAVAILABLE` when it is missing).
Permission is read and asked through the plugin. The desktop plugin shows a notification at once
and cannot schedule one, so `schedule()` waits in a timer inside the window (lost when the app
quits) and shows it then; on mobile the same timer applies. The plugin reports a tap only on
mobile, so `onTap` listeners fire there and stay silent on desktop.

### numericId

```ts
function numericId(id: string): number;
```

The plugin wants a 32-bit integer id; the service's ids are strings.

## @kitr/notifications/drivers/capacitor

### capacitorPush

```ts
function capacitorPush(): CapacitorPush;
```

Push notifications through `@capacitor/push-notifications`. Needs Firebase on Android
(`google-services.json`) and the Push Notifications capability on iOS; see the package docs.

### createCapacitorDriver

```ts
function createCapacitorDriver(_options?: DriverOptions): Driver;
```

Notifications on `@capacitor/local-notifications`: the OS schedules and shows them, so scheduled
ones survive the app closing (the web driver's timers do not). On Android a `channel` becomes a
notification channel, created on first use. Taps from `@capacitor/push-notifications` reach
`onTap` too when that plugin is installed; its token and listeners are in `capacitorPush()`.

### nativeId

```ts
function nativeId(id: string): number;
```

Capacitor ids are 32-bit integers; kitr ids are strings. A stable FNV-1a hash maps one to the other.

### toPermission

```ts
function toPermission(state: string): NotificationPermission;
```

Capacitor reports `granted`, `denied`, `prompt` and `prompt-with-rationale` (Android, after a
first refusal). The last is still a question the app may ask again, so it maps to `prompt`.

### CapacitorPush

```ts
interface CapacitorPush {
  /** The permission to receive push notifications. */
  permission(): Promise<NotificationPermission>;
  /** Ask for it. */
  request(): Promise<NotificationPermission>;
  /** Register with FCM or APNs and resolve to the device token to send to your server. */
  register(): Promise<string>;
  /** Called with each push that arrives while the app is open. */
  onReceived(listener: (message: PushMessage) => void): () => void;
  /** Called when a push is tapped, with its `url` (from `data.url` or `link`) when it has one. */
  onAction(listener: (tap: NotificationTap & {
    actionId: string;
  }) => void): () => void;
}
```

Remote (FCM and APNs) notifications on `@capacitor/push-notifications`.

### PushMessage

```ts
interface PushMessage {
  id: string;
  title?: string;
  body?: string;
  data: Record<string, unknown>;
}
```

A push message, in the fields apps use.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
