import { driverUnavailable } from '@kitr/platform'
import type { Driver, DriverOptions } from '../driver'

/**
 * The secure-storage driver for the Electron shell. Not implemented yet: it throws `E_DRIVER_UNAVAILABLE`
 * naming `@kitr/secure-storage` and `electron` instead of quietly running the web driver in the WebView.
 * Register a driver with `app.drivers.register()`, or set `fallbackToWeb: true` in `config/secure-storage.ts`
 * to opt in to the WebView behaviour.
 */
export function createElectronDriver(_options: DriverOptions = {}): Driver {
  throw driverUnavailable('electron', 'secure-storage')
}
