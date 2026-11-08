import { type KitrApp, KitrError } from '@kitr/core'

/**
 * Which host the code is running in, as one value: a browser (or the server) is `web`, and the
 * three native shells are `electron`, `tauri` and `capacitor`. It answers "which driver should I
 * load?", while `platform.type` answers "what kind of place is this?" (`desktop` covers both
 * Electron and Tauri).
 */
export type Runtime = 'web' | 'electron' | 'tauri' | 'capacitor'

/** Every runtime, in the order `detectRuntime()` checks the native ones after `web`. */
// kitr-allow-module-state: immutable list of runtime names
export const runtimes: readonly Runtime[] = ['web', 'electron', 'tauri', 'capacitor']

/** The globals `detectRuntime()` reads. Pass a fake in tests; the default is `globalThis`. */
export interface RuntimeScope {
  /** Tauri puts its internals on `window`. */
  __TAURI_INTERNALS__?: unknown
  /** The bridge the Electron preload script exposes (`exposeIpc()`). */
  kitrIpc?: unknown
  /** The Capacitor runtime global. */
  Capacitor?: { isNativePlatform?(): boolean }
  /** Node's `process`, present in Electron's main process and in Node-integrated renderers. */
  process?: { versions?: { electron?: string } }
  navigator?: { userAgent?: string }
  /** When the scope is a worker or test global that holds a separate `window`, the checks look there first. */
  window?: RuntimeScope
}

/**
 * Detect the runtime: Tauri by `window.__TAURI_INTERNALS__`, Capacitor by
 * `Capacitor.isNativePlatform()`, Electron by the preload bridge, `process.versions.electron` or an
 * `Electron/` user agent. Everything else, including the server, is `web`. Safe to call anywhere:
 * it only reads globals.
 */
export function detectRuntime(scope: RuntimeScope = globalThis as RuntimeScope): Runtime {
  const w = scope.window ?? scope
  if ('__TAURI_INTERNALS__' in w || '__TAURI_INTERNALS__' in scope) return 'tauri'
  const capacitor = w.Capacitor ?? scope.Capacitor
  if (typeof capacitor?.isNativePlatform === 'function' && capacitor.isNativePlatform())
    return 'capacitor'
  if (
    w.kitrIpc ||
    scope.kitrIpc ||
    scope.process?.versions?.electron ||
    /electron/i.test(w.navigator?.userAgent ?? scope.navigator?.userAgent ?? '')
  )
    return 'electron'
  return 'web'
}

/**
 * The runtime an app is in: the `platform` service's when it is registered (the platform packages
 * set it from their shell), else `detectRuntime()`. Device packages call this to pick a driver.
 */
export function runtimeOf(app?: Pick<KitrApp, 'container'>): Runtime {
  if (app?.container.has('platform')) return app.container.use('platform').runtime
  return detectRuntime()
}

/** The error code `driverUnavailable()` carries, for `error.code === DRIVER_UNAVAILABLE` checks. */
export const DRIVER_UNAVAILABLE = 'E_DRIVER_UNAVAILABLE'

/**
 * The error a device package throws when its driver for a native shell is not implemented (or
 * its plugin is not installed): it names the runtime and the package so the fix is obvious. Never
 * a silent fallback to the web driver; apps that want the WebView behaviour pass `fallbackToWeb`.
 */
export function driverUnavailable(
  runtime: Exclude<Runtime, 'web'>,
  pkg: string,
  detail?: string,
): KitrError {
  const label = `@kitr/${pkg}`
  return new KitrError(
    DRIVER_UNAVAILABLE,
    `${label} has no ${runtime} driver${detail ? `: ${detail}` : ''}. ` +
      `Register one with app.drivers.register(), or set fallbackToWeb: true in config/${pkg}.ts to use the web driver inside the ${runtime} WebView.`,
    { status: 501, data: { runtime, package: label } },
  )
}

/** Whether `error` is a `driverUnavailable()` error. */
export function isDriverUnavailable(error: unknown): error is KitrError {
  return error instanceof KitrError && error.code === DRIVER_UNAVAILABLE
}

/** Options every device package's `selectDriver()` accepts. */
export interface SelectDriverOptions {
  /**
   * Use the web driver when the native shell has no driver of its own. Off by default: a native
   * shell without a driver throws `E_DRIVER_UNAVAILABLE` instead of silently running web code in a WebView.
   */
  fallbackToWeb?: boolean
}

/** One driver factory per runtime. `web` always works; the others may throw `driverUnavailable()`. */
export type RuntimeDrivers<D> = Record<Runtime, () => D>

/**
 * Pick the driver for `runtime` from a table of factories. `web` calls its factory; a native
 * runtime calls its own, and when that throws `E_DRIVER_UNAVAILABLE` the error propagates unless
 * `fallbackToWeb` is set. Any other error propagates untouched.
 */
export function selectRuntimeDriver<D>(
  runtime: Runtime,
  drivers: RuntimeDrivers<D>,
  options: SelectDriverOptions = {},
): D {
  if (runtime === 'web') return drivers.web()
  try {
    return drivers[runtime]()
  } catch (error) {
    if (options.fallbackToWeb && isDriverUnavailable(error)) return drivers.web()
    throw error
  }
}
