---
title: API reference
description: Every export of kitr/updater, with its signature.
order: 2
---

# API reference

Every export of `kitr/updater`, `kitr/updater/react`, `kitr/updater/provider`, `kitr/updater/driver`, `kitr/updater/drivers/web`, `kitr/updater/drivers/electron`, `kitr/updater/drivers/tauri`, `kitr/updater/drivers/capacitor`, read from the published type definitions. The [guide](/packages/updater/guide) shows them in use.

## kitr/updater

### createCapacitorUpdaterDriver

```ts
function createCapacitorUpdaterDriver(_options?: DriverOptions): Driver;
```

Updater for the Capacitor shell on `@capawesome/capacitor-app-update`, which asks the store
rather than a server of yours. Android uses Play in-app updates: a flexible update downloads in
the background with progress and restarts on `apply()`, and a high-priority update (4 or 5) or a
device that only allows it uses the immediate, full-screen flow. iOS cannot install in place, so
`apply()` opens the App Store page. The service-worker path stays web-only.

### createElectronUpdaterDriver

```ts
function createElectronUpdaterDriver(_options?: DriverOptions): Driver;
```

The updater driver for the Electron shell, on `electron-updater` in the main process (served
over the `kitr:updater:*` channels of `handleKitrIpc()`). `check()` asks the update feed in
`electron-builder.yml`'s `publish` block, `apply()` downloads the installer, reports progress
and restarts into it with `quitAndInstall()`, and `onAvailable` fires when main finds an update
on its own. `electron-updater` is an optional peer, imported by main on first use: when it is
missing every method rejects with `E_DRIVER_UNAVAILABLE`. It only updates packaged apps; in
development `check()` resolves to null.

Throws `E_DRIVER_UNAVAILABLE` when the preload bridge is missing (no `exposeIpc()` call).

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

### createTauriUpdaterDriver

```ts
function createTauriUpdaterDriver(_options?: DriverOptions): Driver;
```

The updater driver for the Tauri shell, on `@tauri-apps/plugin-updater` (find and install the
signed update `tauri.conf.json`'s `plugins.updater` points at) and `@tauri-apps/plugin-process`
(relaunch into it). Both are imported on first use and are optional peers: a missing one makes
the method that needs it reject with `E_DRIVER_UNAVAILABLE`. `apply()` reports the download as a
fraction when the server sends a content length.

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

The updater driver for the Electron shell, on `electron-updater` in the main process (served
over the `kitr:updater:*` channels of `handleKitrIpc()`). `check()` asks the update feed in
`electron-builder.yml`'s `publish` block, `apply()` downloads the installer, reports progress
and restarts into it with `quitAndInstall()`, and `onAvailable` fires when main finds an update
on its own. `electron-updater` is an optional peer, imported by main on first use: when it is
missing every method rejects with `E_DRIVER_UNAVAILABLE`. It only updates packaged apps; in
development `check()` resolves to null.

Throws `E_DRIVER_UNAVAILABLE` when the preload bridge is missing (no `exposeIpc()` call).

## kitr/updater/drivers/tauri

### createTauriDriver

```ts
function createTauriDriver(_options?: DriverOptions): Driver;
```

The updater driver for the Tauri shell, on `@tauri-apps/plugin-updater` (find and install the
signed update `tauri.conf.json`'s `plugins.updater` points at) and `@tauri-apps/plugin-process`
(relaunch into it). Both are imported on first use and are optional peers: a missing one makes
the method that needs it reject with `E_DRIVER_UNAVAILABLE`. `apply()` reports the download as a
fraction when the server sends a content length.

## kitr/updater/drivers/capacitor

### createCapacitorDriver

```ts
function createCapacitorDriver(_options?: DriverOptions): Driver;
```

Updater for the Capacitor shell on `@capawesome/capacitor-app-update`, which asks the store
rather than a server of yours. Android uses Play in-app updates: a flexible update downloads in
the background with progress and restarts on `apply()`, and a high-priority update (4 or 5) or a
device that only allows it uses the immediate, full-screen flow. iOS cannot install in place, so
`apply()` opens the App Store page. The service-worker path stays web-only.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
