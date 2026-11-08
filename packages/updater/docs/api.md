---
title: API
description: Every export of kitr/updater, with its signature.
order: 2
---

# API

Every export of `kitr/updater`, `kitr/updater/react`, `kitr/updater/provider`, `kitr/updater/driver`, `kitr/updater/drivers/web`, `kitr/updater/drivers/electron`, `kitr/updater/drivers/tauri`, `kitr/updater/drivers/capacitor`, read from the published type definitions. The [guide](/packages/updater) shows them in use.

## kitr/updater

### createMemoryUpdaterDriver

```ts
function createMemoryUpdaterDriver(options?: {
  version?: string;
  next?: UpdateInfo | null;
}): {
  name: string;
  next: UpdateInfo | null;
  applied: UpdateInfo[];
  check: () => Promise<UpdateInfo | null>;
  apply: (onProgress?: (f: number) => void) => Promise<void>;
  onAvailable(listener: (info: UpdateInfo) => void): () => void;
  announce(info: UpdateInfo): void;
  currentVersion: () => Promise<string>;
};
```

For tests and the server: set `next` to simulate an available update.

### createServiceWorkerUpdaterDriver

```ts
function createServiceWorkerUpdaterDriver(options?: {
  version?: string;
}): UpdaterDriver;
```

Service-worker driver: an update is "available" when a new worker is waiting; applying tells it
to skip waiting and reloads. `version` is the running build; the update is reported as `<version>+`.

### createUpdater

```ts
function createUpdater(config?: UpdaterConfig, app?: KitrApp): Updater;
```

Build the `updater` service. The driver is `config.driver`, else the one registered on `app`, else
`selectDriver()` for the runtime (the service-worker driver in a browser, `E_DRIVER_UNAVAILABLE` in a
native shell unless `fallbackToWeb` is set). Starts the `interval` checks and the driver listener.

### selectDriver

```ts
function selectDriver(runtime: Runtime, options?: DriverOptions): Driver;
```

The updater driver for a runtime: the service-worker driver on `web` (a memory driver on the
server), and each shell's own updater (electron-updater, the Tauri updater plugin, store or
live-update checks). A shell with no updater driver yet throws `E_DRIVER_UNAVAILABLE` rather than
watching a service worker that cannot update a native app, unless `fallbackToWeb` is set.

### useUpdater

```ts
function useUpdater(app: KitrApp): Updater;
```

The app's `updater` service, outside React. Same as `app.container.use('updater')`.

### defineConfig

```ts
const defineConfig: <const C extends UpdaterConfig>(config: C) => C;
```

Types `config/updater.ts`. Returns the object unchanged.

### DriverOptions

```ts
interface DriverOptions extends SelectDriverOptions {
  /** The running build's version, reported by the web driver as `<version>+` when a new worker waits. */
  version?: string;
}
```

Options of `selectDriver()`.

### UpdateInfo

```ts
interface UpdateInfo {
  /** Its version label, such as `2.4.0` (`new` from the service-worker driver without a version). */
  version: string;
  /** Release notes to show next to the update. */
  notes?: string;
  /** Release date, as the driver reports it. */
  date?: string;
  /** Bytes, when the driver knows. */
  size?: number;
}
```

A version the driver found.

### Updater

```ts
interface Updater {
  /** The active driver. */
  readonly driver: UpdaterDriver;
  /** The current snapshot. */
  readonly state: UpdaterState;
  /** Look for an update. Never throws: failures set `status: 'error'` and resolve to null. */
  check(): Promise<UpdateInfo | null>;
  /** Install the update found. Runs once however often it is called; failures set `status: 'error'`. */
  apply(): Promise<void>;
  /** Hide the prompt until the next update. */
  dismiss(): void;
  /** Call `listener` after every state change; returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** Stop the interval and listeners. */
  stop(): void;
}
```

The `updater` service: check, apply and dismiss updates, and subscribe to the state.

### UpdaterConfig

```ts
interface UpdaterConfig {
  /** Replace the driver the service would pick (tests, custom shells). */
  driver?: UpdaterDriver;
  /** Re-check every N milliseconds while the app is open. Default: none (check at boot only). */
  interval?: number;
  /** Check as soon as the app boots. Default true. */
  checkOnBoot?: boolean;
  /** Apply as soon as an update is ready, without asking. Default false. */
  auto?: boolean;
  /**
   * In a native shell (Electron, Tauri, Capacitor) with no updater driver, use the service-worker
   * driver inside the WebView instead of throwing `E_DRIVER_UNAVAILABLE`. Default false.
   */
  fallbackToWeb?: boolean;
}
```

Options for `config/updater.ts` and `createUpdater()`.

### UpdaterDriver

```ts
interface UpdaterDriver {
  /** Shown in devtools, such as `service-worker` or `memory`. */
  name: string;
  /** Look for a newer version. Resolves to the update or null when current. */
  check(): Promise<UpdateInfo | null>;
  /** Download (when needed) and install. Usually restarts or reloads the app. */
  apply(onProgress?: (fraction: number) => void): Promise<void>;
  /** Called by drivers that learn about updates on their own (service worker, background download). */
  onAvailable?(listener: (info: UpdateInfo) => void): () => void;
  /** Current app version, when known. */
  currentVersion?(): Promise<string>;
}
```

What a platform implements to find and install new versions.

### UpdaterState

```ts
interface UpdaterState {
  /** Where the flow is. */
  status: UpdateStatus;
  /** The update found, or null. */
  update: UpdateInfo | null;
  /** 0 to 1 while downloading. */
  progress: number;
  /** Why the last check or apply failed. Cleared by the next check. */
  error: Error | null;
  /** The running version, once the driver reports it. */
  currentVersion: string | null;
}
```

A snapshot of the updater, replaced on every change.

### Driver

```ts
type Driver = UpdaterDriver;
```

What an updater driver is: `UpdaterDriver`, whichever runtime supplies it.

### UpdateStatus

```ts
/** Where the update flow is: `idle → checking → available → downloading → ready`, or `up-to-date` / `error`. */
type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'up-to-date' | 'error';
```

Where the update flow is: `idle → checking → available → downloading → ready`, or `up-to-date` / `error`.

## kitr/updater/react

### useUpdate

```ts
function useUpdate(): {
  available: boolean;
  check: () => Promise<UpdateInfo | null>;
  apply: () => Promise<void>;
  dismiss: () => void;
  status: UpdateStatus;
  update: UpdateInfo | null;
  progress: number;
  error: Error | null;
  currentVersion: string | null;
};
```

`{ status, update, progress, check, apply, dismiss }` for an "update ready" banner.
Hydration-safe: the server and first render see `idle`.

### useUpdater

```ts
function useUpdater(): Updater;
```

The app's `updater` service in a component. Only bound in the browser.

## kitr/updater/provider

### updaterProvider

```ts
const updaterProvider: import("@kitr/core").KitrProvider;
```

Binds `updater` to the platform updater (`updater` capability) or the service-worker driver,
checks at boot and on the configured interval, and stops at shutdown.

## kitr/updater/driver

### selectDriver

```ts
function selectDriver(runtime: Runtime, options?: DriverOptions): Driver;
```

The updater driver for a runtime: the service-worker driver on `web` (a memory driver on the
server), and each shell's own updater (electron-updater, the Tauri updater plugin, store or
live-update checks). A shell with no updater driver yet throws `E_DRIVER_UNAVAILABLE` rather than
watching a service worker that cannot update a native app, unless `fallbackToWeb` is set.

### DriverOptions

```ts
interface DriverOptions extends SelectDriverOptions {
  /** The running build's version, reported by the web driver as `<version>+` when a new worker waits. */
  version?: string;
}
```

Options of `selectDriver()`.

### Driver

```ts
type Driver = UpdaterDriver;
```

What an updater driver is: `UpdaterDriver`, whichever runtime supplies it.

## kitr/updater/drivers/web

### createServiceWorkerUpdaterDriver

```ts
function createServiceWorkerUpdaterDriver(options?: {
  version?: string;
}): UpdaterDriver;
```

Service-worker driver: an update is "available" when a new worker is waiting; applying tells it
to skip waiting and reloads. `version` is the running build; the update is reported as `<version>+`.

## kitr/updater/drivers/electron

### createElectronDriver

```ts
function createElectronDriver(_options?: DriverOptions): Driver;
```

The updater driver for the Electron shell. Not implemented yet: it throws `E_DRIVER_UNAVAILABLE`
naming `@kitr/updater` and `electron` instead of quietly running the web driver in the WebView.
Register a driver with `app.drivers.register()`, or set `fallbackToWeb: true` in `config/updater.ts`
to opt in to the WebView behaviour.

## kitr/updater/drivers/tauri

### createTauriDriver

```ts
function createTauriDriver(_options?: DriverOptions): Driver;
```

The updater driver for the Tauri shell. Not implemented yet: it throws `E_DRIVER_UNAVAILABLE`
naming `@kitr/updater` and `tauri` instead of quietly running the web driver in the WebView.
Register a driver with `app.drivers.register()`, or set `fallbackToWeb: true` in `config/updater.ts`
to opt in to the WebView behaviour.

## kitr/updater/drivers/capacitor

### createCapacitorDriver

```ts
function createCapacitorDriver(_options?: DriverOptions): Driver;
```

The updater driver for the Capacitor shell. Not implemented yet: it throws `E_DRIVER_UNAVAILABLE`
naming `@kitr/updater` and `capacitor` instead of quietly running the web driver in the WebView.
Register a driver with `app.drivers.register()`, or set `fallbackToWeb: true` in `config/updater.ts`
to opt in to the WebView behaviour.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
