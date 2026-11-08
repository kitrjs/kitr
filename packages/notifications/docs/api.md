---
title: API reference
description: Every export of kitr/notifications, with its signature.
order: 2
---

# API reference

Every export of `kitr/notifications`, `kitr/notifications/react`, `kitr/notifications/provider`, read from the published type definitions. The [guide](/packages/notifications) shows them in use.

## kitr/notifications

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
`app`, else the web driver in a browser or a memory driver (`unsupported`) on the server.

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

### ScheduleOptions

```ts
interface ScheduleOptions extends NotificationOptions {
  /** When to show it: a `Date` or a timestamp in milliseconds. A past time shows it at once. */
  at: Date | number;
}
```

A notification to show later.

### NotificationPermission

```ts
/** Where permission stands: `prompt` until asked, `unsupported` where there is no notification API. */
type NotificationPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';
```

Where permission stands: `prompt` until asked, `unsupported` where there is no notification API.

## kitr/notifications/react

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

## kitr/notifications/provider

### notificationsProvider

```ts
const notificationsProvider: import("@kitr/core").KitrProvider;
```

Binds `notifications` to the platform driver (`notifications` capability) or the web
Notification API. With `requestOnBoot` it asks for permission as the app starts.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
