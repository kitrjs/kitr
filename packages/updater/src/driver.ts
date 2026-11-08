import { type Runtime, type SelectDriverOptions, selectRuntimeDriver } from '@kitr/platform'
import { createCapacitorDriver } from './drivers/capacitor'
import { createElectronDriver } from './drivers/electron'
import { createMemoryUpdaterDriver } from './drivers/memory'
import { createTauriDriver } from './drivers/tauri'
import { createServiceWorkerUpdaterDriver } from './drivers/web'
import type { UpdaterDriver } from './index'

/** What an updater driver is: `UpdaterDriver`, whichever runtime supplies it. */
export type Driver = UpdaterDriver

/** Options of `selectDriver()`. */
export interface DriverOptions extends SelectDriverOptions {
  /** The running build's version, reported by the web driver as `<version>+` when a new worker waits. */
  version?: string
}

/**
 * The updater driver for a runtime: the service-worker driver on `web` (a memory driver on the
 * server), and each shell's own updater (electron-updater, the Tauri updater plugin, store or
 * live-update checks). A shell with no updater driver yet throws `E_DRIVER_UNAVAILABLE` rather than
 * watching a service worker that cannot update a native app, unless `fallbackToWeb` is set.
 */
export function selectDriver(runtime: Runtime, options: DriverOptions = {}): Driver {
  return selectRuntimeDriver<Driver>(
    runtime,
    {
      web: () =>
        typeof window === 'undefined'
          ? createMemoryUpdaterDriver()
          : createServiceWorkerUpdaterDriver({ version: options.version }),
      electron: () => createElectronDriver(options),
      tauri: () => createTauriDriver(options),
      capacitor: () => createCapacitorDriver(options),
    },
    options,
  )
}
