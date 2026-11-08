import { driverUnavailable } from '@kitr/platform'
import type { Driver, DriverOptions } from '../driver'
import type { UpdateInfo } from '../index'

/** The preload bridge `exposeIpc()` from `@kitr/desktop/preload` puts on `window`. */
interface Bridge {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>
  on(channel: string, listener: (...args: unknown[]) => void): () => void
}

/**
 * The updater driver for the Electron shell, on `electron-updater` in the main process (served
 * over the `kitr:updater:*` channels of `handleKitrIpc()`). `check()` asks the update feed in
 * `electron-builder.yml`'s `publish` block, `apply()` downloads the installer, reports progress
 * and restarts into it with `quitAndInstall()`, and `onAvailable` fires when main finds an update
 * on its own. `electron-updater` is an optional peer, imported by main on first use: when it is
 * missing every method rejects with `E_DRIVER_UNAVAILABLE`. It only updates packaged apps; in
 * development `check()` resolves to null.
 *
 * Throws `E_DRIVER_UNAVAILABLE` when the preload bridge is missing (no `exposeIpc()` call).
 */
export function createElectronDriver(_options: DriverOptions = {}): Driver {
  const bridge = (globalThis as { kitrIpc?: Bridge }).kitrIpc
  if (!bridge)
    throw driverUnavailable(
      'electron',
      'updater',
      'the kitrIpc preload bridge is missing: call exposeIpc() in the preload script',
    )
  // Errors cross the process boundary as text: main marks a missing electron-updater with the code.
  const call = async (channel: string): Promise<unknown> => {
    try {
      return await bridge.invoke(channel)
    } catch (error) {
      if (error instanceof Error && error.message.includes('E_DRIVER_UNAVAILABLE'))
        throw driverUnavailable(
          'electron',
          'updater',
          'electron-updater is not installed (run `npm install electron-updater`)',
        )
      throw error
    }
  }
  return {
    name: 'electron-updater',
    check: async () => ((await call('kitr:updater:check')) as UpdateInfo | null) ?? null,
    async apply(onProgress) {
      const off = onProgress
        ? bridge.on('kitr:updater:progress', (fraction) => onProgress(fraction as number))
        : undefined
      try {
        await call('kitr:updater:download')
      } finally {
        off?.()
      }
      await call('kitr:updater:install')
    },
    onAvailable: (listener) =>
      bridge.on('kitr:updater:available', (info) => listener(info as UpdateInfo)),
    currentVersion: async () => (await bridge.invoke('kitr:app:version')) as string,
  }
}
