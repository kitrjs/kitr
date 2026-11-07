import { defineProvider } from '@kitr/core'
import type { PlatformDriver } from '@kitr/platform'
import { createAsyncStorageDriver, type StorageDriver } from '@kitr/storage'
import { isElectron, isTauri } from './client'
import { IPC_BRIDGE_KEY, type IpcBridge } from './electron'

/**
 * Runtime provider of the desktop platform. Inside a Tauri webview it registers the `platform`
 * driver on the Tauri APIs and a `storage` driver on the store plugin; inside Electron it uses
 * the kitr IPC channels that `handleKitrIpc` serves from main. In a plain browser it does nothing.
 */
export const desktopProvider = defineProvider({
  name: 'desktop',
  register(app) {
    if (isTauri()) {
      app.drivers.register('platform', tauriPlatformDriver(), { platform: 'desktop' })
      app.drivers.register('storage', tauriStoreDriver(), { platform: 'desktop' })
    } else if (isElectron()) {
      app.drivers.register('platform', electronPlatformDriver(), { platform: 'desktop' })
      app.drivers.register('storage', electronStorageDriver(), { platform: 'desktop' })
    }
  },
})

export default desktopProvider

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

function bridge(): IpcBridge | undefined {
  return (globalThis as any)[IPC_BRIDGE_KEY]
}

function electronPlatformDriver(): PlatformDriver {
  return {
    type: 'desktop',
    native: true,
    os: desktopOs,
    standalone: () => true,
    appVersion: async () => (await bridge()?.invoke('kitr:app:version')) as string,
    onAppState: (listener) => {
      const handler = () => listener(document.visibilityState === 'visible')
      document.addEventListener('visibilitychange', handler)
      return () => document.removeEventListener('visibilitychange', handler)
    },
    openExternal: async (url) => {
      await bridge()?.invoke('kitr:shell:open', url)
    },
    exit: async () => {
      await bridge()?.invoke('kitr:app:quit')
    },
  }
}

/** Storage over the `kitr:storage:*` IPC channels that `handleKitrIpc` serves from main. */
export function electronStorageDriver(): StorageDriver {
  return createAsyncStorageDriver({
    name: 'electron:ipc',
    load: async () =>
      ((await bridge()?.invoke('kitr:storage:load')) as Record<string, string>) ?? {},
    write: async (key, value) => {
      await bridge()?.invoke('kitr:storage:set', key, value)
    },
    erase: async (key) => {
      await bridge()?.invoke('kitr:storage:remove', key)
    },
  })
}
