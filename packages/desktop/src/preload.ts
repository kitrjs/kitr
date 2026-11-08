import type { ContextBridge, IpcRenderer, IpcRendererEvent } from 'electron'
import { IPC_BRIDGE_KEY, type IpcBridge } from './client'

/**
 * The `kitr:*` channels the window may use: what `handleKitrIpc()` serves (storage, app, shell)
 * and the device packages' calls (secure storage, notifications, files, updater, native) with the
 * events main pushes back. Any other `kitr:` name is refused, so a channel a future version adds
 * is not open to a page until the preload that ships with it lists it.
 */
// kitr-allow-module-state: immutable set of IPC channel names
export const KITR_CHANNELS: ReadonlySet<string> = new Set([
  'kitr:storage:load',
  'kitr:storage:set',
  'kitr:storage:remove',
  'kitr:app:version',
  'kitr:app:quit',
  'kitr:shell:open',
  'kitr:secure:get',
  'kitr:secure:set',
  'kitr:secure:remove',
  'kitr:secure:keys',
  'kitr:notify:permission',
  'kitr:notify:show',
  'kitr:notify:schedule',
  'kitr:notify:cancel',
  'kitr:notify:cancel-all',
  'kitr:notify:pending',
  'kitr:notify:badge',
  'kitr:notify:click',
  'kitr:notify:close',
  'kitr:files:open',
  'kitr:files:choose-save',
  'kitr:files:read',
  'kitr:files:write',
  'kitr:files:stat',
  'kitr:files:list',
  'kitr:files:reveal',
  'kitr:updater:check',
  'kitr:updater:download',
  'kitr:updater:install',
  'kitr:updater:available',
  'kitr:updater:progress',
  'kitr:native:clipboard-read',
  'kitr:native:clipboard-write',
  'kitr:native:biometrics-available',
  'kitr:native:biometrics-prompt',
  'kitr:native:info',
  'kitr:native:online',
  'kitr:native:on-battery',
  'kitr:native:power',
  'kitr:native:theme',
])

/**
 * An `allow` for `exposeIpc`: the channels the app declared (a list, or a record keyed by
 * channel so the compiler checks it against the IPC types) plus kitr's own channels (`KITR_CHANNELS`).
 */
export function allowChannels(
  channels: readonly string[] | Record<string, unknown>,
): (channel: string) => boolean {
  const allowed = new Set(Array.isArray(channels) ? channels : Object.keys(channels))
  return (channel) => KITR_CHANNELS.has(channel) || allowed.has(channel)
}

/**
 * Expose a minimal bridge. The renderer's `createIpcClient<Schema>()` adds the types; nothing
 * else from Node or Electron crosses the context boundary. Without `allow` every channel
 * crosses, so pass the declared ones:
 *
 *   import { contextBridge, ipcRenderer } from 'electron'
 *   exposeIpc(contextBridge, ipcRenderer, { allow: allowChannels(channels) })
 */
export function exposeIpc(
  contextBridge: ContextBridge,
  ipcRenderer: IpcRenderer,
  options: { key?: string; allow?: (channel: string) => boolean } = {},
) {
  const allow = options.allow ?? (() => true)
  const bridge: IpcBridge = {
    invoke: (channel, ...args) =>
      allow(channel)
        ? ipcRenderer.invoke(channel, ...args)
        : Promise.reject(new Error(`IPC channel "${channel}" is not allowed`)),
    on: (channel, listener) => {
      if (!allow(channel)) return () => {}
      const wrapped = (_event: IpcRendererEvent, ...args: unknown[]) => listener(...args)
      ipcRenderer.on(channel, wrapped)
      return () => ipcRenderer.removeListener(channel, wrapped)
    },
    send: (channel, ...args) => {
      if (allow(channel)) ipcRenderer.send(channel, ...args)
    },
  }
  contextBridge.exposeInMainWorld(options.key ?? IPC_BRIDGE_KEY, bridge)
}
