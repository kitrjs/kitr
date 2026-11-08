import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
} from 'node:path'
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

/** One main-process handler per channel of the schema: Electron's invoke event, then the channel's arguments. */
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

/** Options of `createMainWindow()`: every `BrowserWindow` option plus where to load the app from. */
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
 * The directory of the app's built main bundle: where package.json `main` points. This module
 * is loaded from node_modules, so its own `__dirname` is not the app's.
 */
function mainDirectory(appPath: string): string {
  try {
    const pkg = JSON.parse(readFileSync(join(appPath, 'package.json'), 'utf8')) as { main?: string }
    if (pkg.main) return dirname(resolve(appPath, pkg.main))
  } catch {
    // no readable package.json: fall through
  }
  return typeof __dirname === 'string' ? __dirname : process.cwd()
}

/**
 * A BrowserWindow with the secure defaults (context isolation on, node integration off,
 * sandbox on), the preload script wired, and dev-vs-built loading handled.
 */
export async function createMainWindow(
  options: MainWindowOptions = {},
): Promise<BrowserWindowType> {
  const { BrowserWindow, protocol, app } = await import('electron')
  const { devUrl, clientDir, preload, devtools, webPreferences, ...rest } = options
  const dir = mainDirectory(app.getAppPath())
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

/** URL schemes `kitr:shell:open` hands to the operating system. Anything else is refused. */
export const EXTERNAL_PROTOCOLS: readonly string[] = ['http:', 'https:', 'mailto:', 'tel:']

/** Options of `handleKitrIpc()`. */
export interface KitrIpcOptions {
  /** The JSON file storage items are kept in. Default `kitr-storage.json` in `userData`. */
  storageFile?: string
  /** The file secure-storage ciphertext is kept in. Default `kitr-secure-storage.json` in `userData`. */
  secureFile?: string
  /** URL schemes `openExternal` may open. Default `EXTERNAL_PROTOCOLS`. */
  externalProtocols?: readonly string[]
}

/** Send `channel` to every open window. */
async function broadcast(channel: string, ...args: unknown[]) {
  const { BrowserWindow } = await import('electron')
  for (const win of BrowserWindow.getAllWindows())
    if (!win.isDestroyed()) win.webContents.send(channel, ...args)
}

/** Refuse a URL whose scheme is not on the list, so a compromised page cannot launch `file:` or custom handlers. */
function checkExternal(url: string, allowed: readonly string[]) {
  let protocol: string
  try {
    protocol = new URL(url).protocol
  } catch {
    throw new Error(`kitr/desktop: "${url}" is not a URL`)
  }
  if (!allowed.includes(protocol))
    throw new Error(`kitr/desktop: opening ${protocol} links is not allowed`)
}

/**
 * The IPC handlers kitr's desktop provider and the device packages rely on: storage (a JSON file
 * in userData), app version, open-external and quit, then secure storage, notifications, files,
 * the updater and the native helpers (see `handleKitrDevices()`). Call once in main.ts after
 * `app.whenReady()`. Returns a function that removes the device handlers and their timers.
 */
export function handleKitrIpc(ipcMain: IpcMain, app: App, options: KitrIpcOptions = {}) {
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
    checkExternal(url, options.externalProtocols ?? EXTERNAL_PROTOCOLS)
    const { shell } = await import('electron')
    await shell.openExternal(url)
  })
  return handleKitrDevices(ipcMain, app, options)
}

/** Whether `path` is `root` or inside it. */
function within(root: string, path: string) {
  const rel = relative(root, path)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/** A file or folder the person picked; the shape `kitr:files:*` returns. */
interface Entry {
  path: string
  name: string
  size: number
  isDirectory: boolean
}

async function entryOf(path: string): Promise<Entry> {
  const info = await stat(path)
  return { path, name: basename(path), size: info.size, isDirectory: info.isDirectory() }
}

type Filters = Array<{ name: string; extensions: string[] }>
type NotifyPayload = {
  id: string
  title: string
  body?: string
  silent?: boolean
  url?: string
  data?: unknown
}

/**
 * The device handlers behind `@kitr/secure-storage`, `@kitr/notifications`, `@kitr/files`,
 * `@kitr/updater` and `@kitr/native`, all on `kitr:*` channels the preload script lets through.
 * `handleKitrIpc()` calls it; call it yourself only to skip the storage and app handlers.
 * Returns a function that removes every handler and timer.
 *
 * Nothing here gives the window Node: secure storage writes ciphertext only (and refuses to store
 * when the OS has no vault), files are read and written only at paths the person chose in a
 * dialog this session, and `electron-updater` is imported only when the updater is used.
 */
export function handleKitrDevices(ipcMain: IpcMain, app: App, options: KitrIpcOptions = {}) {
  const channels: string[] = []
  const handle = (channel: string, fn: (event: IpcMainInvokeEvent, ...args: any[]) => unknown) => {
    channels.push(channel)
    ipcMain.handle(channel, fn)
  }

  /* ---------------------------------------------------------------- secure storage */
  const secureFile = options.secureFile ?? join(app.getPath('userData'), 'kitr-secure-storage.json')
  let secrets: Record<string, string> | undefined
  const loadSecrets = async () => {
    if (secrets) return secrets
    try {
      secrets = JSON.parse(await readFile(secureFile, 'utf8'))
    } catch {
      secrets = {}
    }
    return secrets!
  }
  let secretWrites = Promise.resolve()
  const saveSecrets = () => {
    secretWrites = secretWrites.then(async () => {
      await mkdir(dirname(secureFile), { recursive: true })
      await writeFile(secureFile, JSON.stringify(secrets ?? {}, null, 2), { mode: 0o600 })
    })
    return secretWrites
  }
  // safeStorage needs the OS vault. On Linux without a keyring it falls back to a hard-coded
  // password, which is not a vault: refuse to store rather than pretend.
  const vault = async () => {
    const { safeStorage } = await import('electron')
    const weak = safeStorage.getSelectedStorageBackend?.() === 'basic_text'
    if (!safeStorage.isEncryptionAvailable() || weak)
      throw new Error(
        'kitr/desktop: the operating system has no secret vault (safeStorage); secrets are not stored',
      )
    return safeStorage
  }
  handle('kitr:secure:get', async (_e, key: string) => {
    const stored = (await loadSecrets())[key]
    if (stored === undefined) return null
    try {
      return (await vault()).decryptString(Buffer.from(stored, 'base64'))
    } catch {
      return null
    }
  })
  handle('kitr:secure:set', async (_e, key: string, value: string) => {
    const safe = await vault()
    ;(await loadSecrets())[key] = safe.encryptString(value).toString('base64')
    await saveSecrets()
  })
  handle('kitr:secure:remove', async (_e, key: string) => {
    delete (await loadSecrets())[key]
    await saveSecrets()
  })
  handle('kitr:secure:keys', async () => Object.keys(await loadSecrets()))

  /* ---------------------------------------------------------------- notifications */
  const shown = new Map<string, import('electron').Notification>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const MAX_TIMEOUT = 2 ** 31 - 1
  const display = async (payload: NotifyPayload) => {
    const { Notification, BrowserWindow } = await import('electron')
    if (!Notification.isSupported()) return
    shown.get(payload.id)?.close()
    const notification = new Notification({
      title: payload.title,
      body: payload.body,
      silent: payload.silent,
    })
    notification.on('click', () => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win) {
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
      }
      void broadcast('kitr:notify:click', { id: payload.id, url: payload.url, data: payload.data })
    })
    notification.on('close', () => {
      if (shown.get(payload.id) === notification) shown.delete(payload.id)
      void broadcast('kitr:notify:close', { id: payload.id })
    })
    shown.set(payload.id, notification)
    notification.show()
  }
  handle('kitr:notify:permission', async () => {
    const { Notification } = await import('electron')
    return Notification.isSupported() ? 'granted' : 'unsupported'
  })
  handle('kitr:notify:show', (_e, payload: NotifyPayload) => display(payload))
  handle('kitr:notify:schedule', (_e, payload: NotifyPayload & { at: number }) => {
    clearTimeout(timers.get(payload.id))
    // setTimeout overflows past ~24.8 days and fires at once; wait in steps instead.
    const wait = () => {
      timers.set(
        payload.id,
        setTimeout(
          () => {
            if (payload.at - Date.now() > 0) return wait()
            timers.delete(payload.id)
            void display(payload)
          },
          Math.min(Math.max(0, payload.at - Date.now()), MAX_TIMEOUT),
        ),
      )
    }
    wait()
  })
  handle('kitr:notify:cancel', (_e, id: string) => {
    clearTimeout(timers.get(id))
    timers.delete(id)
    shown.get(id)?.close()
    shown.delete(id)
  })
  handle('kitr:notify:cancel-all', () => {
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
    for (const notification of shown.values()) notification.close()
    shown.clear()
  })
  handle('kitr:notify:pending', () => [...timers.keys()])
  handle('kitr:notify:badge', (_e, count: number) => {
    app.setBadgeCount(Math.max(0, Math.floor(count)))
  })

  /* ---------------------------------------------------------------- files */
  // Paths the person picked in a dialog (or saved to) this session: the only ones read and written.
  const granted = new Set<string>()
  const mayAccess = (path: string) => {
    const target = resolve(path)
    for (const root of granted) if (within(root, target)) return target
    throw new Error(`kitr/desktop: ${path} was not chosen in a dialog; refusing to access it`)
  }
  handle(
    'kitr:files:open',
    async (
      _e,
      o: { title?: string; filters?: Filters; multiple?: boolean; directory?: boolean },
    ) => {
      const { dialog } = await import('electron')
      const result = await dialog.showOpenDialog({
        title: o.title,
        filters: o.filters?.length ? o.filters : undefined,
        properties: [
          o.directory ? 'openDirectory' : 'openFile',
          ...(o.multiple ? (['multiSelections'] as const) : []),
        ],
      })
      if (result.canceled) return []
      for (const path of result.filePaths) granted.add(resolve(path))
      return Promise.all(result.filePaths.map(entryOf))
    },
  )
  handle(
    'kitr:files:choose-save',
    async (_e, o: { name: string; title?: string; filters?: Filters }) => {
      const { dialog } = await import('electron')
      const result = await dialog.showSaveDialog({
        title: o.title,
        defaultPath: o.name,
        filters: o.filters?.length ? o.filters : undefined,
      })
      if (result.canceled || !result.filePath) return null
      granted.add(resolve(result.filePath))
      return result.filePath
    },
  )
  handle(
    'kitr:files:read',
    async (_e, path: string) => new Uint8Array(await readFile(mayAccess(path))),
  )
  handle('kitr:files:write', async (_e, path: string, bytes: Uint8Array) => {
    await writeFile(mayAccess(path), bytes)
  })
  handle('kitr:files:stat', async (_e, path: string) => entryOf(mayAccess(path)))
  handle('kitr:files:list', async (_e, path: string) => {
    const dir = mayAccess(path)
    return Promise.all((await readdir(dir)).map((name) => entryOf(join(dir, name))))
  })
  handle('kitr:files:reveal', async (_e, path: string) => {
    const { shell } = await import('electron')
    const error = await shell.openPath(mayAccess(path))
    if (error) throw new Error(error)
  })

  /* ---------------------------------------------------------------- updater */
  interface UpdateInfoLike {
    version: string
    releaseNotes?: string | Array<{ note?: string | null }> | null
    releaseDate?: string
    files?: Array<{ size?: number }>
  }
  interface UpdaterLike {
    autoDownload: boolean
    on(event: string, listener: (...args: any[]) => void): unknown
    checkForUpdates(): Promise<{ isUpdateAvailable?: boolean; updateInfo: UpdateInfoLike } | null>
    downloadUpdate(): Promise<unknown>
    quitAndInstall(): void
  }
  const toUpdate = (info: UpdateInfoLike) => ({
    version: info.version,
    notes:
      typeof info.releaseNotes === 'string'
        ? info.releaseNotes
        : Array.isArray(info.releaseNotes)
          ? info.releaseNotes.map((n) => n.note ?? '').join('\n')
          : undefined,
    date: info.releaseDate,
    size: info.files?.[0]?.size,
  })
  let updater: UpdaterLike | undefined
  const getUpdater = async (): Promise<UpdaterLike> => {
    if (updater) return updater
    let mod: { autoUpdater?: UpdaterLike; default?: { autoUpdater?: UpdaterLike } }
    try {
      mod = (await import('electron-updater' as string)) as typeof mod
    } catch {
      throw new Error(
        'E_DRIVER_UNAVAILABLE: electron-updater is not installed; add it to the app with `npm install electron-updater`',
      )
    }
    const auto = (mod.autoUpdater ?? mod.default?.autoUpdater) as UpdaterLike
    auto.autoDownload = false
    auto.on('update-available', (info: UpdateInfoLike) =>
      broadcast('kitr:updater:available', toUpdate(info)),
    )
    auto.on('download-progress', (p: { percent: number }) =>
      broadcast('kitr:updater:progress', p.percent / 100),
    )
    updater = auto
    return auto
  }
  handle('kitr:updater:check', async () => {
    const result = await (await getUpdater()).checkForUpdates()
    return result?.isUpdateAvailable ? toUpdate(result.updateInfo) : null
  })
  handle('kitr:updater:download', async () => {
    await (await getUpdater()).downloadUpdate()
  })
  handle('kitr:updater:install', async () => {
    ;(await getUpdater()).quitAndInstall()
  })

  /* ---------------------------------------------------------------- native */
  handle('kitr:native:clipboard-read', async () => (await import('electron')).clipboard.readText())
  handle('kitr:native:clipboard-write', async (_e, text: string) => {
    ;(await import('electron')).clipboard.writeText(text)
  })
  const touchId = async () => {
    const { systemPreferences } = await import('electron')
    return process.platform === 'darwin' && systemPreferences.canPromptTouchID()
      ? systemPreferences
      : null
  }
  handle('kitr:native:biometrics-available', async () => (await touchId()) !== null)
  handle('kitr:native:biometrics-prompt', async (_e, reason?: string) => {
    const prefs = await touchId()
    if (!prefs) return false
    try {
      await prefs.promptTouchID(reason || 'confirm it is you')
      return true
    } catch {
      return false
    }
  })
  handle('kitr:native:info', async () => {
    const { net, nativeTheme } = await import('electron')
    return {
      platform: process.platform,
      version: app.getVersion(),
      online: net.isOnline(),
      dark: nativeTheme.shouldUseDarkColors,
    }
  })
  handle('kitr:native:online', async () => (await import('electron')).net.isOnline())
  handle('kitr:native:on-battery', async () =>
    (await import('electron')).powerMonitor.isOnBatteryPower(),
  )
  const disposers: Array<() => void> = []
  void import('electron').then(({ powerMonitor, nativeTheme }) => {
    const events = [
      ['suspend', 'suspend'],
      ['resume', 'resume'],
      ['on-battery', 'battery'],
      ['on-ac', 'ac'],
    ] as const
    for (const [event, kind] of events) {
      const listener = () => void broadcast('kitr:native:power', kind)
      powerMonitor.on(event as 'suspend', listener)
      disposers.push(() => powerMonitor.removeListener(event as 'suspend', listener))
    }
    const theme = () => void broadcast('kitr:native:theme', nativeTheme.shouldUseDarkColors)
    nativeTheme.on('updated', theme)
    disposers.push(() => nativeTheme.removeListener('updated', theme))
  })

  return () => {
    for (const channel of channels) ipcMain.removeHandler(channel)
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
    for (const dispose of disposers.splice(0)) dispose()
  }
}

/** Resolve a file next to the project's package.json, for main.ts to find dist/<name>/client. */
export function projectFile(importMetaUrl: string, ...parts: string[]) {
  const require = createRequire(importMetaUrl)
  void require
  return resolve(dirname(new URL(importMetaUrl).pathname), ...parts)
}

export { pathToFileURL }
