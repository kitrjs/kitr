import { type Runtime, type SelectDriverOptions, selectRuntimeDriver } from '@kitr/platform'
import { createCapacitorDriver } from './drivers/capacitor'
import { createElectronDriver } from './drivers/electron'
import { createTauriDriver } from './drivers/tauri'
import {
  webBiometrics,
  webCamera,
  webClipboard,
  webGeolocation,
  webHaptics,
  webShare,
} from './drivers/web'
import type {
  BiometricsDriver,
  CameraDriver,
  ClipboardDriver,
  GeolocationDriver,
  HapticsDriver,
  ShareDriver,
} from './index'

/**
 * What one runtime supplies for the `native` service: a driver per capability, or `null` where
 * the runtime has none (the capability then reports `supported: false`).
 */
export interface Driver {
  /** Where the drivers come from, shown as the capability's `name`: `web`, `electron`, `tauri`, `capacitor`. */
  name: string
  clipboard: ClipboardDriver | null
  share: ShareDriver | null
  haptics: HapticsDriver | null
  geolocation: GeolocationDriver | null
  camera: CameraDriver | null
  biometrics: BiometricsDriver | null
}

/** Options of `selectDriver()`. */
export type DriverOptions = SelectDriverOptions

/** The browser drivers: each is `null` where its API is missing, and all are `null` on the server. */
function webDrivers(): Driver {
  return {
    name: 'web',
    clipboard: webClipboard(),
    share: webShare(),
    haptics: webHaptics(),
    geolocation: webGeolocation(),
    camera: webCamera(),
    biometrics: webBiometrics(),
  }
}

/**
 * The capability drivers for a runtime: the browser APIs on `web`, and each native shell's own
 * (Capacitor plugins, Electron dialogs, Tauri plugins). A shell with no drivers yet throws
 * `E_DRIVER_UNAVAILABLE` rather than falling back to the web ones, unless `fallbackToWeb` is set.
 */
export function selectDriver(runtime: Runtime, options: DriverOptions = {}): Driver {
  return selectRuntimeDriver<Driver>(
    runtime,
    {
      web: webDrivers,
      electron: () => createElectronDriver(options),
      tauri: () => createTauriDriver(options),
      capacitor: () => createCapacitorDriver(options),
    },
    options,
  )
}
