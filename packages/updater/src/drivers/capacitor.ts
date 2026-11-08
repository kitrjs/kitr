import type { AppUpdateInfo } from '@capawesome/capacitor-app-update'
import { driverUnavailable } from '@kitr/platform'
import type { Driver, DriverOptions } from '../driver'

/** Updates at or above this Play Store priority (0 to 5) are installed with the blocking immediate flow. */
const IMMEDIATE_PRIORITY = 4

/**
 * Import the update plugin (and Capacitor's platform check) on first use, so web bundles never
 * load them. A plugin that is not installed turns into `E_DRIVER_UNAVAILABLE`.
 */
async function load() {
  try {
    const [update, core] = await Promise.all([
      import('@capawesome/capacitor-app-update'),
      import('@capacitor/core'),
    ])
    return { ...update, platform: () => core.Capacitor.getPlatform() }
  } catch {
    throw driverUnavailable('capacitor', 'updater', 'install @capawesome/capacitor-app-update')
  }
}

/**
 * Updater for the Capacitor shell on `@capawesome/capacitor-app-update`, which asks the store
 * rather than a server of yours. Android uses Play in-app updates: a flexible update downloads in
 * the background with progress and restarts on `apply()`, and a high-priority update (4 or 5) or a
 * device that only allows it uses the immediate, full-screen flow. iOS cannot install in place, so
 * `apply()` opens the App Store page. The service-worker path stays web-only.
 */
export function createCapacitorDriver(_options: DriverOptions = {}): Driver {
  let info: AppUpdateInfo | undefined
  return {
    name: 'capacitor',
    async check() {
      const { AppUpdate, AppUpdateAvailability } = await load()
      info = await AppUpdate.getAppUpdateInfo()
      if (info.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) return null
      return {
        version: info.availableVersionName ?? info.availableVersionCode ?? 'new',
        date: info.availableVersionReleaseDate,
      }
    },
    async apply(onProgress) {
      const plugin = await load()
      const { AppUpdate, FlexibleUpdateInstallStatus, AppUpdateResultCode } = plugin
      if (plugin.platform() !== 'android') {
        await AppUpdate.openAppStore()
        return
      }
      const current = info ?? (await AppUpdate.getAppUpdateInfo())
      const immediate = current.immediateUpdateAllowed === true
      const flexible = current.flexibleUpdateAllowed === true
      if (immediate && ((current.updatePriority ?? 0) >= IMMEDIATE_PRIORITY || !flexible)) {
        // Play shows its own full-screen flow and restarts the app when done.
        await AppUpdate.performImmediateUpdate()
        return
      }
      if (!flexible) {
        await AppUpdate.openAppStore()
        return
      }
      let settle!: { resolve(downloaded: boolean): void; reject(error: Error): void }
      const done = new Promise<boolean>((resolve, reject) => {
        settle = { resolve, reject }
      })
      done.catch(() => {}) // a failure before we start waiting is reported by the start call
      const handle = await AppUpdate.addListener('onFlexibleUpdateStateChange', (state) => {
        if (state.totalBytesToDownload && state.bytesDownloaded !== undefined)
          onProgress?.(Math.min(1, state.bytesDownloaded / state.totalBytesToDownload))
        if (state.installStatus === FlexibleUpdateInstallStatus.DOWNLOADED) settle.resolve(true)
        else if (state.installStatus === FlexibleUpdateInstallStatus.CANCELED) settle.resolve(false)
        else if (state.installStatus === FlexibleUpdateInstallStatus.FAILED)
          settle.reject(new Error('@kitr/updater: the Play Store update failed to download'))
      })
      try {
        const result = await AppUpdate.startFlexibleUpdate()
        if (result.code === AppUpdateResultCode.CANCELED) return
        if (result.code !== AppUpdateResultCode.OK)
          throw new Error(`@kitr/updater: the Play Store update did not start (code ${result.code})`)
        if (!(await done)) return
        onProgress?.(1)
        await AppUpdate.completeFlexibleUpdate()
      } finally {
        await handle.remove()
      }
    },
    async currentVersion() {
      const { AppUpdate } = await load()
      return (await AppUpdate.getAppUpdateInfo()).currentVersionName
    },
  }
}
