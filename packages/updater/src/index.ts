import { createDefineConfig, getDevtools, type KitrApp } from '@kitr/core'
import { runtimeOf } from '@kitr/platform'
import { selectDriver } from './driver'

export { type Driver, type DriverOptions, selectDriver } from './driver'
export { createCapacitorDriver as createCapacitorUpdaterDriver } from './drivers/capacitor'
export { createElectronDriver as createElectronUpdaterDriver } from './drivers/electron'
export { createMemoryUpdaterDriver } from './drivers/memory'
export { createTauriDriver as createTauriUpdaterDriver } from './drivers/tauri'
export { createServiceWorkerUpdaterDriver } from './drivers/web'

/**
 * One check/apply flow for new versions. On the web the driver watches the service worker
 * (`updatefound` → `waiting`) and applies by telling it to skip waiting and reloading. Desktop
 * packages register the Tauri or Electron updater; mobile ones report the store version or a
 * live-update bundle.
 */

/** Where the update flow is: `idle → checking → available → downloading → ready`, or `up-to-date` / `error`. */
export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'up-to-date'
  | 'error'

/** A version the driver found. */
export interface UpdateInfo {
  /** Its version label, such as `2.4.0` (`new` from the service-worker driver without a version). */
  version: string
  /** Release notes to show next to the update. */
  notes?: string
  /** Release date, as the driver reports it. */
  date?: string
  /** Bytes, when the driver knows. */
  size?: number
}

/** What a platform implements to find and install new versions. */
export interface UpdaterDriver {
  /** Shown in devtools, such as `service-worker` or `memory`. */
  name: string
  /** Look for a newer version. Resolves to the update or null when current. */
  check(): Promise<UpdateInfo | null>
  /** Download (when needed) and install. Usually restarts or reloads the app. */
  apply(onProgress?: (fraction: number) => void): Promise<void>
  /** Called by drivers that learn about updates on their own (service worker, background download). */
  onAvailable?(listener: (info: UpdateInfo) => void): () => void
  /** Current app version, when known. */
  currentVersion?(): Promise<string>
}

/** Options for `config/updater.ts` and `createUpdater()`. */
export interface UpdaterConfig {
  /** Replace the driver the service would pick (tests, custom shells). */
  driver?: UpdaterDriver
  /** Re-check every N milliseconds while the app is open. Default: none (check at boot only). */
  interval?: number
  /** Check as soon as the app boots. Default true. */
  checkOnBoot?: boolean
  /** Apply as soon as an update is ready, without asking. Default false. */
  auto?: boolean
  /**
   * In a native shell (Electron, Tauri, Capacitor) with no updater driver, use the service-worker
   * driver inside the WebView instead of throwing `E_DRIVER_UNAVAILABLE`. Default false.
   */
  fallbackToWeb?: boolean
}

/** A snapshot of the updater, replaced on every change. */
export interface UpdaterState {
  /** Where the flow is. */
  status: UpdateStatus
  /** The update found, or null. */
  update: UpdateInfo | null
  /** 0 to 1 while downloading. */
  progress: number
  /** Why the last check or apply failed. Cleared by the next check. */
  error: Error | null
  /** The running version, once the driver reports it. */
  currentVersion: string | null
}

/** The `updater` service: check, apply and dismiss updates, and subscribe to the state. */
export interface Updater {
  /** The active driver. */
  readonly driver: UpdaterDriver
  /** The current snapshot. */
  readonly state: UpdaterState
  /** Look for an update. Never throws: failures set `status: 'error'` and resolve to null. */
  check(): Promise<UpdateInfo | null>
  /** Install the update found. Runs once however often it is called; failures set `status: 'error'`. */
  apply(): Promise<void>
  /** Hide the prompt until the next update. */
  dismiss(): void
  /** Call `listener` after every state change; returns an unsubscribe function. */
  subscribe(listener: () => void): () => void
  /** Stop the interval and listeners. */
  stop(): void
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    updater: UpdaterConfig
  }
  interface ContainerBindings {
    updater: Updater
  }
  interface DriverTypes {
    updater: UpdaterDriver
  }
}

/** Types `config/updater.ts`. Returns the object unchanged. */
export const defineConfig = createDefineConfig<UpdaterConfig>()

/**
 * Build the `updater` service. The driver is `config.driver`, else the one registered on `app`, else
 * `selectDriver()` for the runtime (the service-worker driver in a browser, `E_DRIVER_UNAVAILABLE` in a
 * native shell unless `fallbackToWeb` is set). Starts the `interval` checks and the driver listener.
 */
export function createUpdater(config: UpdaterConfig = {}, app?: KitrApp): Updater {
  const driver =
    config.driver ??
    app?.drivers.resolve('updater') ??
    selectDriver(runtimeOf(app), { fallbackToWeb: config.fallbackToWeb })
  const log = (label: string, data?: unknown) =>
    app && getDevtools(app)?.log('updater', label, data)
  const listeners = new Set<() => void>()
  let state: UpdaterState = {
    status: 'idle',
    update: null,
    progress: 0,
    error: null,
    currentVersion: null,
  }
  const set = (patch: Partial<UpdaterState>) => {
    state = { ...state, ...patch }
    for (const l of listeners) l()
  }
  let dismissed: string | null = null
  const stops: Array<() => void> = []

  const updater: Updater = {
    driver,
    get state() {
      return state
    },
    async check() {
      // An interval tick during a download must not reset 'downloading' or 'ready' to 'checking'.
      if (state.status === 'downloading' || state.status === 'ready') return state.update
      set({ status: 'checking', error: null })
      try {
        const update = await driver.check()
        if (update && update.version !== dismissed) {
          set({ status: 'available', update })
          log('available', update)
          if (config.auto) await updater.apply()
        } else set({ status: 'up-to-date', update: null })
        return update
      } catch (error) {
        set({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) })
        log('check failed', error)
        return null
      }
    },
    async apply() {
      // Once is enough: a double click (or auto plus a click) must not install twice.
      if (!state.update || state.status === 'downloading' || state.status === 'ready') return
      set({ status: 'downloading', progress: 0 })
      try {
        await driver.apply((fraction) => set({ progress: fraction }))
        set({ status: 'ready', progress: 1 })
        log('applied', state.update)
      } catch (error) {
        set({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) })
        log('apply failed', error)
      }
    },
    dismiss() {
      dismissed = state.update?.version ?? null
      set({ status: 'up-to-date', update: null })
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    stop() {
      for (const stop of stops.splice(0)) stop()
    },
  }

  driver
    .currentVersion?.()
    .then((v) => set({ currentVersion: v }))
    .catch((error) => log('version unknown', error))
  if (driver.onAvailable)
    stops.push(
      driver.onAvailable((update) => {
        if (update.version === dismissed) return
        if (state.status === 'downloading' || state.status === 'ready') return
        set({ status: 'available', update })
        log('available', update)
        if (config.auto) void updater.apply()
      }),
    )
  if (config.interval && config.interval > 0) {
    const timer = setInterval(() => void updater.check(), config.interval)
    stops.push(() => clearInterval(timer))
  }
  return updater
}

/** The app's `updater` service, outside React. Same as `app.container.use('updater')`. */
export function useUpdater(app: KitrApp): Updater {
  return app.container.use('updater')
}
