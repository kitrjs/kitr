import { driverUnavailable } from '@kitr/platform'
import type { Driver, DriverOptions } from '../driver'

/**
 * The notifications driver for the Capacitor shell. Not implemented yet: it throws `E_DRIVER_UNAVAILABLE`
 * naming `@kitr/notifications` and `capacitor` instead of quietly running the web driver in the WebView.
 * Register a driver with `app.drivers.register()`, or set `fallbackToWeb: true` in `config/notifications.ts`
 * to opt in to the WebView behaviour.
 */
export function createCapacitorDriver(_options: DriverOptions = {}): Driver {
  throw driverUnavailable('capacitor', 'notifications')
}
