import { defineProvider } from '@kitr/core'
import type { PlatformDriver } from '@kitr/platform'
import { createAsyncStorageDriver, type StorageDriver } from '@kitr/storage'
import { IPC_BRIDGE_KEY, type IpcBridge, isElectron } from './client'

/**
 * Runtime provider of the desktop platform. Inside Electron it registers the `platform` and
 * `storage` drivers on the kitr IPC channels that `handleKitrIpc` serves from main. In a plain
 * browser it does nothing, so the web build of the same app keeps working.
 */
export const desktopProvider = defineProvider({
  name: 'desktop',
  register(app) {
    if (!isElectron()) return
    app.drivers.register('platform', electronPlatformDriver(), { platform: 'desktop' })
    app.drivers.register('storage', electronStorageDriver(), { platform: 'desktop' })
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
