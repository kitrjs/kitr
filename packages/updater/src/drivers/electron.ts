import { driverUnavailable } from '@kitr/platform'
import type { Driver, DriverOptions } from '../driver'

/**
 * The updater driver for the Electron shell. Not implemented yet: it throws `E_DRIVER_UNAVAILABLE`
 * naming `@kitr/updater` and `electron` instead of quietly running the web driver in the WebView.
 * Register a driver with `app.drivers.register()`, or set `fallbackToWeb: true` in `config/updater.ts`
 * to opt in to the WebView behaviour.
 */
export function createElectronDriver(_options: DriverOptions = {}): Driver {
  throw driverUnavailable('electron', 'updater')
}
