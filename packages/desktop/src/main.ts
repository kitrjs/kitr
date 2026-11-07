import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type {
  App,
  BrowserWindowConstructorOptions,
  BrowserWindow as BrowserWindowType,
  IpcMain,
  IpcMainInvokeEvent,
  WebContents,
} from 'electron'
import type { IpcEvents, IpcSchema } from './client'

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

/** The scheme the packaged renderer is served from. Register it before `app.whenReady()`. */
export const APP_SCHEME = 'app'

/**
 * Call at the top of main.ts (before the app is ready) so `app://` behaves like https:
 * absolute asset paths, fetch, service workers and cookies all work.
 */
export function registerAppScheme(protocol: typeof import('electron').protocol) {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ])
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
}

/** Serve the built client (`dist/<name>/client`) at `app://-/` with an SPA fallback to index.html. */
export function serveClient(protocol: typeof import('electron').protocol, clientDir: string) {
  const root = resolve(clientDir)
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url)
    let path = decodeURIComponent(url.pathname)
    if (path.endsWith('/')) path += 'index.html'
    let file = normalize(join(root, path))
    if (!file.startsWith(root)) return new Response('Forbidden', { status: 403 })
    if (!existsSync(file)) {
      const shell = ['index.html', '_shell.html'].map((f) => join(root, f)).find(existsSync)
      if (!shell) return new Response('Not found', { status: 404 })
      file = shell
    }
    const body = await readFile(file)
    return new Response(body, {
      headers: { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' },
    })
  })
}

export interface MainWindowOptions extends BrowserWindowConstructorOptions {
  /** Dev server URL. kitr sets `ELECTRON_RENDERER_URL` for `kitr dev`. */
  devUrl?: string
  /** The built client directory, served through `app://`. Default `../client` next to the main bundle. */
  clientDir?: string
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
  const { BrowserWindow, protocol } = await import('electron')
  const { devUrl, clientDir, preload, devtools, webPreferences, ...rest } = options
  const dir = typeof __dirname === 'string' ? __dirname : process.cwd()
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    ...rest,
    webPreferences: {
      preload: preload ?? join(dir, '../preload/index.js'),
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
    if (!(protocol as any).isProtocolHandled?.(APP_SCHEME))
      serveClient(protocol, clientDir ?? join(dir, '../../client'))
    await win.loadURL(`${APP_SCHEME}://-/`)
  }
  return win
}

/**
 * The IPC handlers kitr's desktop provider relies on: storage (a JSON file in userData),
 * app version, open-external and quit. Call once in main.ts after `app.whenReady()`.
 */
export function handleKitrIpc(ipcMain: IpcMain, app: App, options: { storageFile?: string } = {}) {
  const file = options.storageFile ?? join(app.getPath('userData'), 'kitr-storage.json')
  let data: Record<string, string> | undefined
  const load = async () => {
    if (data) return data
    try {
      data = JSON.parse(await readFile(file, 'utf8'))
    } catch {
      data = {}
    }
    return data!
  }
  let writing = Promise.resolve()
  const save = () => {
    writing = writing.then(async () => {
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, JSON.stringify(data ?? {}, null, 2))
    })
    return writing
  }
  ipcMain.handle('kitr:storage:load', () => load())
  ipcMain.handle('kitr:storage:set', async (_e, key: string, value: string) => {
    ;(await load())[key] = value
    await save()
  })
  ipcMain.handle('kitr:storage:remove', async (_e, key: string) => {
    delete (await load())[key]
    await save()
  })
  ipcMain.handle('kitr:app:version', () => app.getVersion())
  ipcMain.handle('kitr:app:quit', () => app.quit())
  ipcMain.handle('kitr:shell:open', async (_e, url: string) => {
    const { shell } = await import('electron')
    await shell.openExternal(url)
  })
}

/** Resolve a file next to the project's package.json, for main.ts to find dist/<name>/client. */
export function projectFile(importMetaUrl: string, ...parts: string[]) {
  const require = createRequire(importMetaUrl)
  void require
  return resolve(dirname(new URL(importMetaUrl).pathname), ...parts)
}

export { pathToFileURL }
