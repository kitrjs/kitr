import { driverUnavailable, loadShellModule } from '@kitr/platform'
import type { Driver, DriverOptions } from '../driver'
import type { UpdateInfo } from '../index'

/** What `@tauri-apps/plugin-updater`'s `check()` resolves to. */
interface TauriUpdate {
  version: string
  date?: string
  body?: string
  downloadAndInstall(
    onEvent?: (event: {
      event: 'Started' | 'Progress' | 'Finished'
      data?: { contentLength?: number; chunkLength?: number }
    }) => void,
  ): Promise<void>
}
interface UpdaterPlugin {
  check(): Promise<TauriUpdate | null>
}
interface ProcessPlugin {
  relaunch(): Promise<void>
}
interface AppApi {
  getVersion(): Promise<string>
}

const missing = (pkg: string, detail: string) =>
  driverUnavailable(
    'tauri',
    'updater',
    `${pkg} is not installed (run \`npm install ${pkg}\`, ${detail})`,
  )

async function plugin<T>(name: string, detail: string): Promise<T> {
  try {
    return await loadShellModule<T>(name)
  } catch {
    throw missing(name, detail)
  }
}

/**
 * The updater driver for the Tauri shell, on `@tauri-apps/plugin-updater` (find and install the
 * signed update `tauri.conf.json`'s `plugins.updater` points at) and `@tauri-apps/plugin-process`
 * (relaunch into it). Both are imported on first use and are optional peers: a missing one makes
 * the method that needs it reject with `E_DRIVER_UNAVAILABLE`. `apply()` reports the download as a
 * fraction when the server sends a content length.
 */
export function createTauriDriver(_options: DriverOptions = {}): Driver {
  let found: TauriUpdate | null = null
  const updater = () =>
    plugin<UpdaterPlugin>(
      '@tauri-apps/plugin-updater',
      'add tauri-plugin-updater in src-tauri, allow updater:default and set plugins.updater in tauri.conf.json',
    )
  const info = (update: TauriUpdate): UpdateInfo => ({
    version: update.version,
    notes: update.body,
    date: update.date,
  })
  return {
    name: 'tauri-updater',
    async check() {
      found = await (await updater()).check()
      return found ? info(found) : null
    },
    async apply(onProgress) {
      found ??= await (await updater()).check()
      if (!found) return
      let total = 0
      let received = 0
      await found.downloadAndInstall((event) => {
        if (event.event === 'Started') total = event.data?.contentLength ?? 0
        else if (event.event === 'Progress') {
          received += event.data?.chunkLength ?? 0
          if (total) onProgress?.(Math.min(1, received / total))
        } else onProgress?.(1)
      })
      const { relaunch } = await plugin<ProcessPlugin>(
        '@tauri-apps/plugin-process',
        'add tauri-plugin-process in src-tauri and allow process:allow-restart',
      )
      await relaunch()
    },
    currentVersion: async () =>
      (await plugin<AppApi>('@tauri-apps/api/app', 'it ships with @tauri-apps/api')).getVersion(),
  }
}
