import { createShellProvider } from '@kitr/platform/shell'
import { createAsyncStorageDriver, type StorageDriver } from '@kitr/storage'
import { IPC_BRIDGE_KEY, type IpcBridge, isElectron } from './client'

function bridge(): IpcBridge | undefined {
  return (globalThis as Record<string, unknown>)[IPC_BRIDGE_KEY] as IpcBridge | undefined
}

/**
 * Runtime provider of the desktop platform. Inside Electron it registers the `platform` and
 * `storage` drivers on the kitr IPC channels that `handleKitrIpc` serves from main. In a plain
 * browser it does nothing, so the web build of the same app keeps working. The shared shell
 * behaviour (detection, registration, app state, devtools) is `createShellProvider()`.
 */
export const desktopProvider = createShellProvider({
  name: 'desktop',
  platform: 'desktop',
  type: 'desktop',
  runtime: 'electron',
  detect: isElectron,
  bridge,
  driver: (shell) => ({
    appVersion: async () => (await shell.invoke('kitr:app:version')) as string,
    openExternal: async (url) => {
      await shell.invoke('kitr:shell:open', url)
    },
    exit: async () => {
      await shell.invoke('kitr:app:quit')
    },
  }),
  register: (app) => {
    app.drivers.register('storage', electronStorageDriver(), { platform: 'desktop' })
  },
})

export default desktopProvider

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
