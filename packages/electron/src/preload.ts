import type { ContextBridge, IpcRenderer, IpcRendererEvent } from 'electron'
import { IPC_BRIDGE_KEY, type IpcBridge } from './ipc'

/**
 * Expose a minimal, channel-agnostic bridge. The renderer's `createIpcClient<Schema>()`
 * adds the types; nothing else from Node or Electron crosses the context boundary.
 *
 *   import { contextBridge, ipcRenderer } from 'electron'
 *   exposeIpc(contextBridge, ipcRenderer)
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
