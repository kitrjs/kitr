import { type ModuleLoader, registerShellModules } from '@kitr/platform'
import { createShellProvider } from '@kitr/platform/shell'
import { createAsyncStorageDriver, type StorageDriver } from '@kitr/storage'
import { isTauri } from './client'

/**
 * The Tauri plugin packages the device drivers (`@kitr/secure-storage`, `@kitr/notifications`,
 * `@kitr/files`, `@kitr/updater`, `@kitr/native`) load by name. Each is a literal `import()` so the
 * app's bundler finds and bundles it; the provider registers them with `registerShellModules()`, so
 * the device packages never name an optional package in code a web build bundles. The Tauri
 * platform installs them all (`kitr add tauri`).
 */
// kitr-allow-module-state: immutable table of plugin loaders, registered once per process
export const tauriPluginLoaders: Record<string, ModuleLoader> = {
  '@tauri-apps/api/app': () => import('@tauri-apps/api/app'),
  '@tauri-apps/api/core': () => import('@tauri-apps/api/core'),
  '@tauri-apps/api/path': () => import('@tauri-apps/api/path'),
  '@tauri-apps/api/window': () => import('@tauri-apps/api/window'),
  '@tauri-apps/plugin-clipboard-manager': () =>
    import('@tauri-apps/plugin-clipboard-manager' as string),
  '@tauri-apps/plugin-dialog': () => import('@tauri-apps/plugin-dialog' as string),
  '@tauri-apps/plugin-fs': () => import('@tauri-apps/plugin-fs' as string),
  '@tauri-apps/plugin-notification': () => import('@tauri-apps/plugin-notification' as string),
  '@tauri-apps/plugin-opener': () => import('@tauri-apps/plugin-opener'),
  '@tauri-apps/plugin-os': () => import('@tauri-apps/plugin-os' as string),
  '@tauri-apps/plugin-process': () => import('@tauri-apps/plugin-process'),
  '@tauri-apps/plugin-stronghold': () => import('@tauri-apps/plugin-stronghold' as string),
  '@tauri-apps/plugin-updater': () => import('@tauri-apps/plugin-updater' as string),
}

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
    registerShellModules(tauriPluginLoaders)
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
