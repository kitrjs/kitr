import { createShellProvider } from '@kitr/platform/shell'
import { createAsyncStorageDriver, type StorageDriver } from '@kitr/storage'
import { isTauri } from './client'

/**
 * Runtime provider of the Tauri platform. Inside a Tauri webview it registers the `platform`
 * driver on the Tauri APIs and a `storage` driver on the store plugin. In a plain browser it
 * does nothing, so the web build of the same app keeps working. The shared shell behaviour
 * (detection, registration, app state, devtools) is `createShellProvider()`.
 */
export const tauriProvider = createShellProvider({
  name: 'tauri',
  platform: 'tauri',
  type: 'desktop',
  runtime: 'tauri',
  detect: isTauri,
  driver: () => ({
    appVersion: () => import('@tauri-apps/api/app').then((m) => m.getVersion()),
    openExternal: (url) =>
      import('@tauri-apps/plugin-opener')
        .then((m) => m.openUrl(url))
        .catch(() => {
          window.open(url, '_blank', 'noopener')
        }),
    exit: () =>
      import('@tauri-apps/plugin-process').then((m) => m.exit(0)).catch(() => window.close()),
  }),
  register: (app) => {
    app.drivers.register('storage', tauriStoreDriver(), { platform: 'tauri' })
  },
})

export default tauriProvider

/** `@tauri-apps/plugin-store` (`kitr.json` in the app data dir) as a kitr storage driver. */
export function tauriStoreDriver(file = 'kitr.json'): StorageDriver {
  const store = () => import('@tauri-apps/plugin-store').then((m) => new m.LazyStore(file))
  return createAsyncStorageDriver({
    name: 'tauri:store',
    async load() {
      const s = await store()
      const out: Record<string, string> = {}
      for (const [key, value] of await s.entries()) if (typeof value === 'string') out[key] = value
      return out
    },
    write: (key, value) =>
      store().then(async (s) => {
        await s.set(key, value)
        await s.save()
      }),
    erase: (key) =>
      store().then(async (s) => {
        await s.delete(key)
        await s.save()
      }),
  })
}
