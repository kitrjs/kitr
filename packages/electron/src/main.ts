import { join } from 'node:path'
import type {
  BrowserWindowConstructorOptions,
  BrowserWindow as BrowserWindowType,
  IpcMain,
  IpcMainInvokeEvent,
  WebContents,
} from 'electron'
import type { IpcEvents, IpcSchema } from './ipc'

export type IpcHandlers<S extends IpcSchema> = {
  [K in keyof S]: (
    event: IpcMainInvokeEvent,
    ...args: Parameters<S[K]>
  ) => ReturnType<S[K]> | Promise<Awaited<ReturnType<S[K]>>>
}

/** Register every handler of the schema on ipcMain. Returns a function that removes them. */
export function handleIpc<S extends IpcSchema>(
  ipcMain: IpcMain,
  handlers: IpcHandlers<S>,
): () => void {
  for (const [channel, handler] of Object.entries(handlers)) ipcMain.handle(channel, handler as any)
  return () => {
    for (const channel of Object.keys(handlers)) ipcMain.removeHandler(channel)
  }
}

/** Typed sender for main → renderer events. */
export function createIpcEmitter<E extends IpcEvents>(target: () => WebContents | undefined) {
  return {
    emit<K extends keyof E & string>(channel: K, ...args: Parameters<E[K]>) {
      target()?.send(channel, ...args)
    },
  }
}

export interface MainWindowOptions extends BrowserWindowConstructorOptions {
  /** Dev server URL. electron-vite sets `ELECTRON_RENDERER_URL`; `kitr add electron` falls back to Vite's default. */
  devUrl?: string
  /** Built renderer entry, relative to the main bundle. Default `../renderer/index.html`. */
  indexHtml?: string
  /** Preload script path. Default `join(__dirname, '../preload/index.js')`. */
  preload?: string
  /** Open devtools when loading the dev URL. Default true. */
  devtools?: boolean
}

/**
 * A BrowserWindow with the secure defaults (context isolation on, node integration off,
 * sandbox on), the preload script wired, and dev-vs-built loading handled.
 */
export async function createMainWindow(
  options: MainWindowOptions = {},
): Promise<BrowserWindowType> {
  const { BrowserWindow } = await import('electron')
  const { devUrl, indexHtml, preload, devtools, webPreferences, ...rest } = options
  const dirname = typeof __dirname === 'string' ? __dirname : process.cwd()
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    ...rest,
    webPreferences: {
      preload: preload ?? join(dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      ...webPreferences,
    },
  })
  win.once('ready-to-show', () => win.show())
  const url = devUrl ?? process.env.ELECTRON_RENDERER_URL
  if (url) {
    await win.loadURL(url)
    if (devtools ?? true) win.webContents.openDevTools({ mode: 'detach' })
  } else {
    await win.loadFile(indexHtml ?? join(dirname, '../renderer/index.html'))
  }
  return win
}
