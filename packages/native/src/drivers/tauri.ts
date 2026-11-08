import { driverUnavailable } from '@kitr/platform'
import type { Driver, DriverOptions } from '../driver'

/**
 * The native driver for the Tauri shell. Not implemented yet: it throws `E_DRIVER_UNAVAILABLE`
 * naming `@kitr/native` and `tauri` instead of quietly running the web driver in the WebView.
 * Register a driver with `app.drivers.register()`, or set `fallbackToWeb: true` in `config/native.ts`
 * to opt in to the WebView behaviour.
 */
export function createTauriDriver(_options: DriverOptions = {}): Driver {
  throw driverUnavailable('tauri', 'native')
}
