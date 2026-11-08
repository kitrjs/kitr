import { driverUnavailable } from '@kitr/platform'
import type { Driver, DriverOptions } from '../driver'

/** The preload bridge `exposeIpc()` from `@kitr/desktop/preload` puts on `window`. */
interface Bridge {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>
}

/**
 * The secure-storage driver for the Electron shell. Values are encrypted in the main process with
 * `safeStorage` (Keychain on macOS, DPAPI on Windows, the desktop's secret service on Linux) and
 * the ciphertext is kept in `kitr-secure-storage.json` in `userData`, served over the `kitr:secure:*`
 * channels of `handleKitrIpc()`. The window never sees the key. Where the OS has no vault, main
 * refuses to store and `set()` rejects, so nothing is ever kept in the clear.
 *
 * Throws `E_DRIVER_UNAVAILABLE` when the preload bridge is missing (no `exposeIpc()` call).
 */
export function createElectronDriver(_options: DriverOptions = {}): Driver {
  const bridge = (globalThis as { kitrIpc?: Bridge }).kitrIpc
  if (!bridge)
    throw driverUnavailable(
      'electron',
      'secure-storage',
      'the kitrIpc preload bridge is missing: call exposeIpc() in the preload script',
    )
  return {
    name: 'electron-safe-storage',
    secure: true,
    get: async (key) => ((await bridge.invoke('kitr:secure:get', key)) as string | null) ?? null,
    set: async (key, value) => {
      await bridge.invoke('kitr:secure:set', key, value)
    },
    remove: async (key) => {
      await bridge.invoke('kitr:secure:remove', key)
    },
    keys: async () => ((await bridge.invoke('kitr:secure:keys')) as string[]) ?? [],
  }
}
