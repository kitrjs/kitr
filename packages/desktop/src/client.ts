/**
 * One schema shared by main, preload and renderer:
 *
 *   export type Ipc = {
 *     'files.open': (path: string) => Promise<string>
 *     'app.version': () => string
 *   }
 *
 * Main: `handleIpc<Ipc>(ipcMain, { 'files.open': async (_e, path) => readFile(path, 'utf8'), ... })`
 * Preload: `exposeIpc(contextBridge, ipcRenderer)`
 * Renderer: `const ipc = createIpcClient<Ipc>()` → `await ipc.invoke('files.open', '/tmp/a')`
 */
export type IpcSchema = Record<string, (...args: any[]) => unknown>

/** Events pushed from main to renderer: `{ 'download.progress': (percent: number) => void }` */
export type IpcEvents = Record<string, (...args: any[]) => void>

export const IPC_BRIDGE_KEY = 'kitrIpc'

export interface IpcBridge {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>
  on(channel: string, listener: (...args: unknown[]) => void): () => void
  send(channel: string, ...args: unknown[]): void
}

export type IpcClient<S extends IpcSchema, E extends IpcEvents = {}> = {
  invoke<K extends keyof S & string>(
    channel: K,
    ...args: Parameters<S[K]>
  ): Promise<Awaited<ReturnType<S[K]>>>
  on<K extends keyof E & string>(
    channel: K,
    listener: (...args: Parameters<E[K]>) => void,
  ): () => void
  send(channel: string, ...args: unknown[]): void
  /** True when the preload bridge is present (running inside Electron). */
  readonly available: boolean
}

/** Renderer side: a typed client over the bridge the preload script exposed. */
export function createIpcClient<S extends IpcSchema, E extends IpcEvents = {}>(
  key = IPC_BRIDGE_KEY,
): IpcClient<S, E> {
  const bridge = (): IpcBridge | undefined => (globalThis as any)[key]
  return {
    get available() {
      return !!bridge()
    },
    invoke: (channel, ...args) => {
      const b = bridge()
      if (!b)
        return Promise.reject(
          new Error(
            `[kitr/desktop] IPC bridge "${key}" is not available (not running in Electron, or the preload script did not call exposeIpc)`,
          ),
        )
      return b.invoke(channel, ...args) as any
    },
    on: (channel, listener) => bridge()?.on(channel, listener as any) ?? (() => {}),
    send: (channel, ...args) => bridge()?.send(channel, ...args),
  }
}

/** True in an Electron renderer (checks the bridge, then the user agent). */
export function isElectron(): boolean {
  if (typeof globalThis === 'undefined') return false
  if ((globalThis as any)[IPC_BRIDGE_KEY]) return true
  return typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent)
}
