import type { ContextBridge, IpcRenderer, IpcRendererEvent } from 'electron'
import { IPC_BRIDGE_KEY, type IpcBridge } from './client'

/**
 * An `allow` for `exposeIpc`: the channels the app declared (a list, or a record keyed by
 * channel so the compiler checks it against the IPC types) plus kitr's own `kitr:*` channels.
 */
export function allowChannels(
  channels: readonly string[] | Record<string, unknown>,
): (channel: string) => boolean {
  const allowed = new Set(Array.isArray(channels) ? channels : Object.keys(channels))
  return (channel) => channel.startsWith('kitr:') || allowed.has(channel)
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
