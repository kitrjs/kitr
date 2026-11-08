import { type Runtime, type SelectDriverOptions, selectRuntimeDriver } from '@kitr/platform'
import { createCapacitorDriver } from './drivers/capacitor'
import { createElectronDriver } from './drivers/electron'
import { createMemoryFilesDriver } from './drivers/memory'
import { createTauriDriver } from './drivers/tauri'
import { createWebFilesDriver } from './drivers/web'
import type { FilesDriver } from './index'

/** What a files driver is: `FilesDriver`, whichever runtime supplies it. */
export type Driver = FilesDriver

/** Options of `selectDriver()`. */
export type DriverOptions = SelectDriverOptions

/**
 * The files driver for a runtime: the File System Access API (or `<input type="file">`) on `web`,
 * a memory driver on the server, and each native shell's own dialogs. A shell with no driver yet
 * throws `E_DRIVER_UNAVAILABLE` rather than falling back to the web one, unless `fallbackToWeb` is set.
 */
export function selectDriver(runtime: Runtime, options: DriverOptions = {}): Driver {
  return selectRuntimeDriver<Driver>(
    runtime,
    {
      web: () =>
        typeof window === 'undefined' ? createMemoryFilesDriver() : createWebFilesDriver(),
      electron: () => createElectronDriver(options),
      tauri: () => createTauriDriver(options),
      capacitor: () => createCapacitorDriver(options),
    },
    options,
  )
}
