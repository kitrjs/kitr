import { type Runtime, type SelectDriverOptions, selectRuntimeDriver } from '@kitr/platform'
import { createCapacitorDriver } from './drivers/capacitor'
import { createElectronDriver } from './drivers/electron'
import { createMemoryNotificationsDriver } from './drivers/memory'
import { createTauriDriver } from './drivers/tauri'
import { createWebNotificationsDriver } from './drivers/web'
import type { NotificationsDriver } from './index'

/** What a notifications driver is: `NotificationsDriver`, whichever runtime supplies it. */
export type Driver = NotificationsDriver

/** Options of `selectDriver()`. */
export interface DriverOptions extends SelectDriverOptions {
  /** Default icon for web notifications. */
  icon?: string
}

/**
 * The notifications driver for a runtime: the browser Notification API on `web` (a memory driver
 * reporting `unsupported` on the server), and each native shell's own driver. A shell with no
 * driver yet throws `E_DRIVER_UNAVAILABLE` rather than falling back to the web one, unless
 * `fallbackToWeb` is set.
 */
export function selectDriver(runtime: Runtime, options: DriverOptions = {}): Driver {
  return selectRuntimeDriver<Driver>(
    runtime,
    {
      web: () =>
        typeof window === 'undefined'
          ? createMemoryNotificationsDriver('unsupported')
          : createWebNotificationsDriver({ icon: options.icon }),
      electron: () => createElectronDriver(options),
      tauri: () => createTauriDriver(options),
      capacitor: () => createCapacitorDriver(options),
    },
    options,
  )
}
