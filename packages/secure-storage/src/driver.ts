import { type Runtime, type SelectDriverOptions, selectRuntimeDriver } from '@kitr/platform'
import type { StorageDriver } from '@kitr/storage'
import { createCapacitorDriver } from './drivers/capacitor'
import { createElectronDriver } from './drivers/electron'
import { createMemorySecureStorageDriver } from './drivers/memory'
import { createTauriDriver } from './drivers/tauri'
import { createWebSecureStorageDriver } from './drivers/web'
import type { SecureStorageDriver } from './index'

/** What a secure-storage driver is: `SecureStorageDriver`, whichever runtime supplies it. */
export type Driver = SecureStorageDriver

/** Options of `selectDriver()`. */
export interface DriverOptions extends SelectDriverOptions {
  /** Where the web fallback keeps its ciphertext. Default: the app's local storage driver. */
  storage?: StorageDriver
}

/**
 * The secure-storage driver for a runtime: the AES-GCM web fallback on `web` (a memory driver on
 * the server), and each shell's OS vault (Keychain, Keystore, safeStorage, keyring). A shell with
 * no vault driver yet throws `E_DRIVER_UNAVAILABLE` rather than quietly encrypting into WebView
 * storage, unless `fallbackToWeb` is set.
 */
export function selectDriver(runtime: Runtime, options: DriverOptions = {}): Driver {
  return selectRuntimeDriver<Driver>(
    runtime,
    {
      web: () =>
        typeof window === 'undefined'
          ? createMemorySecureStorageDriver()
          : createWebSecureStorageDriver(options.storage),
      electron: () => createElectronDriver(options),
      tauri: () => createTauriDriver(options),
      capacitor: () => createCapacitorDriver(options),
    },
    options,
  )
}
