import { defineProvider } from '@kitr/core'
import type { PlatformDriver } from '@kitr/platform'
import { createAsyncStorageDriver, type StorageDriver } from '@kitr/storage'
import { isTauri } from './client'

/**
 * Runtime provider of the Tauri platform. Inside a Tauri webview it registers the `platform`
 * driver on the Tauri APIs and a `storage` driver on the store plugin. In a plain browser it
 * does nothing, so the web build of the same app keeps working.
 */
export const tauriProvider = defineProvider({
  name: 'tauri',
  register(app) {
    if (!isTauri()) return
    app.drivers.register('platform', tauriPlatformDriver(), { platform: 'tauri' })
    app.drivers.register('storage', tauriStoreDriver(), { platform: 'tauri' })
  },
})

export default tauriProvider

function desktopOs(): string {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  if (/mac os/i.test(ua)) return 'macos'
  if (/windows/i.test(ua)) return 'windows'
  if (/linux/i.test(ua)) return 'linux'
  return 'unknown'
}

function tauriPlatformDriver(): PlatformDriver {
  return {
    type: 'desktop',
    native: true,
    os: desktopOs,
    standalone: () => true,
    appVersion: () => import('@tauri-apps/api/app').then((m) => m.getVersion()),
    onAppState: (listener) => {
      const handler = () => listener(document.visibilityState === 'visible')
      document.addEventListener('visibilitychange', handler)
      return () => document.removeEventListener('visibilitychange', handler)
    },
    openExternal: (url) =>
      import('@tauri-apps/plugin-opener')
        .then((m) => m.openUrl(url))
        .catch(() => {
          window.open(url, '_blank', 'noopener')
        }),
    exit: () =>
      import('@tauri-apps/plugin-process').then((m) => m.exit(0)).catch(() => window.close()),
  }
}

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
