---
title: API
description: Every export of kitr/desktop, with its signature.
order: 2
---

# API

Every export of `kitr/desktop`, `kitr/desktop/client`, `kitr/desktop/main`, `kitr/desktop/preload`, `kitr/desktop/provider`, read from the published type definitions. The [guide](/packages/desktop) shows them in use.

## kitr/desktop

### desktop

```ts
const desktop: import("@kitr/core").PlatformFactory<DesktopOptions>;
```

macOS, Windows and Linux through an Electron shell: Chromium and Node ship inside the app, so
it renders the same everywhere. The main and preload processes live in `platforms/<name>/`;
the window loads the same client build the web platform ships. For a smaller binary on the
OS webview, use `kitr/tauri` instead.

```ts
platforms: { app: desktop({ title: 'Acme' }) }
kitr dev app        # Vite on :3200 and the Electron window with HMR
kitr build app      # client build into dist/<name>/client, then installers
```

### DesktopOptions

```ts
interface DesktopOptions {
  /** Dev server port the window loads from with `kitr dev <name>`. Default 3200. */
  port: number;
  /** Window title. Default the package name. */
  title?: string;
  /** Initial window width in pixels. Default 1200. */
  width: number;
  /** Initial window height in pixels. Default 800. */
  height: number;
  /** Smallest width the user can resize the window to. */
  minWidth?: number;
  /** Smallest height the user can resize the window to. */
  minHeight?: number;
  /** Reverse-DNS bundle id. Default `com.example.<app>`. */
  appId?: string;
  /** Open devtools in dev. Default true. */
  devtools: boolean;
}
```

Options of `desktop()` in `kitrrc.ts`. Every option but `port` is written into the scaffolded
`main.ts` and `electron-builder.yml` by `kitr add`; edit those files to change them later.

## kitr/desktop/client

### createIpcClient

```ts
function createIpcClient<S extends IpcSchema, E extends IpcEvents = {}>(key?: string): IpcClient<S, E>;
```

Renderer side: a typed client over the bridge the preload script exposed.

### isElectron

```ts
function isElectron(): boolean;
```

True in an Electron renderer (checks the bridge, then the user agent).

### IPC_BRIDGE_KEY

```ts
const IPC_BRIDGE_KEY = "kitrIpc";
```

The `window` property the preload script exposes the bridge under, and the client reads by default.

### IpcBridge

```ts
interface IpcBridge {
  /** Call a handler in the main process and resolve with its return value. */
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  /** Listen to a channel the main process sends on. Returns the unsubscribe function. */
  on(channel: string, listener: (...args: unknown[]) => void): () => void;
  /** Send a one-way message to `ipcMain.on()` listeners, with no reply. */
  send(channel: string, ...args: unknown[]): void;
}
```

The untyped bridge `exposeIpc()` puts on `window`; `createIpcClient()` wraps it with your schema's types.

### IpcClient

```ts
type IpcClient<S extends IpcSchema, E extends IpcEvents = {}> = {
  /** Call a command declared in the schema. Rejects when the bridge is missing or the handler throws. */
  invoke<K extends keyof S & string>(channel: K, ...args: Parameters<S[K]>): Promise<Awaited<ReturnType<S[K]>>>;
  /** Listen to an event pushed from main. Returns the unsubscribe function; a no-op outside Electron. */
  on<K extends keyof E & string>(channel: K, listener: (...args: Parameters<E[K]>) => void): () => void;
  /** Send a one-way, untyped message to `ipcMain.on()` listeners. Does nothing outside Electron. */
  send(channel: string, ...args: unknown[]): void;
  /** True when the preload bridge is present (running inside Electron). */
  readonly available: boolean;
};
```

The typed client `createIpcClient<Schema, Events>()` returns for the renderer.

### IpcEvents

```ts
type IpcEvents = Record<string, (...args: any[]) => void>;
```

Events pushed from main to renderer: `{ 'download.progress': (percent: number) => void }`

### IpcSchema

```ts
type IpcSchema = Record<string, (...args: any[]) => unknown>;
```

One schema shared by main, preload and renderer:

```ts
export type Ipc = {
  'files.open': (path: string) => Promise<string>
  'app.version': () => string
}
```
Main: `handleIpc<Ipc>(ipcMain, { 'files.open': async (_e, path) => readFile(path, 'utf8'), ... })`
Preload: `exposeIpc(contextBridge, ipcRenderer)`
Renderer: `const ipc = createIpcClient<Ipc>()` → `await ipc.invoke('files.open', '/tmp/a')`

## kitr/desktop/main

Re-exports `node` unchanged, plus the following.

### createIpcEmitter

```ts
function createIpcEmitter<E extends IpcEvents>(target: () => WebContents | undefined): {
  emit<K extends keyof E & string>(channel: K, ...args: Parameters<E[K]>): void;
};
```

Typed sender for main → renderer events.

### createMainWindow

```ts
function createMainWindow(options?: MainWindowOptions): Promise<BrowserWindow>;
```

A BrowserWindow with the secure defaults (context isolation on, node integration off,
sandbox on), the preload script wired, and dev-vs-built loading handled.

### handleIpc

```ts
function handleIpc<S extends IpcSchema>(ipcMain: IpcMain, handlers: IpcHandlers<S>): () => void;
```

Register every handler of the schema on ipcMain. Returns a function that removes them.

### handleKitrIpc

```ts
function handleKitrIpc(ipcMain: IpcMain, app: App, options?: {
  storageFile?: string;
}): void;
```

The IPC handlers kitr's desktop provider relies on: storage (a JSON file in userData),
app version, open-external and quit. Call once in main.ts after `app.whenReady()`.

### projectFile

```ts
function projectFile(importMetaUrl: string, ...parts: string[]): string;
```

Resolve a file next to the project's package.json, for main.ts to find dist/<name>/client.

### registerAppScheme

```ts
function registerAppScheme(protocol: typeof import('electron').protocol): void;
```

Call at the top of main.ts (before the app is ready) so `app://` behaves like https:
absolute asset paths, fetch, service workers and cookies all work.

### serveClient

```ts
function serveClient(protocol: typeof import('electron').protocol, clientDir: string): void;
```

Serve the built client (`dist/<name>/client`) at `app://-/` with an SPA fallback to index.html.

### APP_SCHEME

```ts
const APP_SCHEME = "app";
```

The scheme the packaged renderer is served from. Register it before `app.whenReady()`.

### MainWindowOptions

```ts
interface MainWindowOptions extends BrowserWindowConstructorOptions {
  /** Dev server URL. kitr sets `ELECTRON_RENDERER_URL` for `kitr dev`. */
  devUrl?: string;
  /** The built client directory, served through `app://`. Default `../client` next to the main bundle. */
  clientDir?: string;
  /** Preload script path. Default `join(__dirname, '../preload/index.js')`. */
  preload?: string;
  /** Open devtools when loading the dev URL. Default true. */
  devtools?: boolean;
}
```

Options of `createMainWindow()`: every `BrowserWindow` option plus where to load the app from.

### IpcHandlers

```ts
type IpcHandlers<S extends IpcSchema> = {
  [K in keyof S]: (event: IpcMainInvokeEvent, ...args: Parameters<S[K]>) => ReturnType<S[K]> | Promise<Awaited<ReturnType<S[K]>>>;
};
```

One main-process handler per channel of the schema: Electron's invoke event, then the channel's arguments.

## kitr/desktop/preload

### allowChannels

```ts
function allowChannels(channels: readonly string[] | Record<string, unknown>): (channel: string) => boolean;
```

An `allow` for `exposeIpc`: the channels the app declared (a list, or a record keyed by
channel so the compiler checks it against the IPC types) plus kitr's own `kitr:*` channels.

### exposeIpc

```ts
function exposeIpc(contextBridge: ContextBridge, ipcRenderer: IpcRenderer, options?: {
  key?: string;
  allow?: (channel: string) => boolean;
}): void;
```

Expose a minimal bridge. The renderer's `createIpcClient<Schema>()` adds the types; nothing
else from Node or Electron crosses the context boundary. Without `allow` every channel
crosses, so pass the declared ones:

```ts
import { contextBridge, ipcRenderer } from 'electron'
exposeIpc(contextBridge, ipcRenderer, { allow: allowChannels(channels) })
```

## kitr/desktop/provider

### electronStorageDriver

```ts
function electronStorageDriver(): StorageDriver;
```

Storage over the `kitr:storage:*` IPC channels that `handleKitrIpc` serves from main.

### desktopProvider

```ts
const desktopProvider: import("@kitr/core").KitrProvider;
```

Runtime provider of the desktop platform. Inside Electron it registers the `platform` and
`storage` drivers on the kitr IPC channels that `handleKitrIpc` serves from main. In a plain
browser it does nothing, so the web build of the same app keeps working.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
