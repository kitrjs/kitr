---
title: API
description: Every export of kitr/desktop, with its signature.
order: 2
---

# API

Every export of `kitr/desktop`, `kitr/desktop/client`, `kitr/desktop/provider`, `kitr/desktop/tauri`, `kitr/desktop/electron`, `kitr/desktop/electron-main`, `kitr/desktop/electron-preload`, read from the published type definitions. The [guide](/packages/desktop) shows them in use.

## kitr/desktop

### desktop

```ts
const desktop: import("@kitr/core").PlatformFactory<DesktopOptions>;
```

macOS, Windows and Linux through a Tauri or Electron shell. The native project lives in
`platforms/<name>/`; the window loads the same client build the web platform ships.

```ts
platforms: { app: desktop({ shell: 'tauri' }) }
kitr dev app        # Vite on :3200 and the native window with HMR
kitr build app      # client build into dist/<name>/client, then installers
```

### DesktopOptions

```ts
interface DesktopOptions {
  /** `tauri` (Rust shell, small binaries) or `electron` (Chromium + Node). Default `tauri`. */
  shell: DesktopShell;
  /** Dev server port the shell loads from with `kitr dev <name>`. Default 3200. */
  port: number;
  /** Window title. Default the package name. */
  title?: string;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  /** Reverse-DNS bundle id. Default `com.example.<app>`. */
  appId?: string;
  /** Open devtools in dev. Default true. */
  devtools: boolean;
}
```

### DesktopShell

```ts
type DesktopShell = 'tauri' | 'electron';
```

## kitr/desktop/client

### desktopShell

```ts
function desktopShell(): 'tauri' | 'electron' | null;
```

`'tauri' | 'electron' | null`: which desktop shell the app runs in.

### isElectron

```ts
function isElectron(): boolean;
```

True in an Electron renderer (checks the kitr preload bridge, then the user agent).

### isTauri

```ts
function isTauri(): boolean;
```

True inside a Tauri webview (checks `window.__TAURI_INTERNALS__`), false in a browser.

## kitr/desktop/provider

### electronStorageDriver

```ts
function electronStorageDriver(): StorageDriver;
```

Storage over the `kitr:storage:*` IPC channels that `handleKitrIpc` serves from main.

### tauriStoreDriver

```ts
function tauriStoreDriver(file?: string): StorageDriver;
```

`@tauri-apps/plugin-store` (`kitr.json` in the app data dir) as a kitr storage driver.

### desktopProvider

```ts
const desktopProvider: import("@kitr/core").KitrProvider;
```

Runtime provider of the desktop platform. Inside a Tauri webview it registers the `platform`
driver on the Tauri APIs and a `storage` driver on the store plugin; inside Electron it uses
the kitr IPC channels that `handleKitrIpc` serves from main. In a plain browser it does nothing.

## kitr/desktop/tauri

### commandMutation

```ts
function commandMutation<TInput, TOutput>(command: (args: TInput) => Promise<TOutput>, options?: {
  effects?: MutationContract<TInput, TOutput>['effects'];
}): Omit<MutationContract<TInput, TOutput>, 'kind'>;
```

### commandQuery

```ts
function commandQuery<TInput, TOutput>(command: (args: TInput) => Promise<TOutput>, name: string): Omit<QueryContract<TInput, TOutput>, 'kind'>;
```

A query contract over a command, for `defineQuery(commandQuery(commands.greet, 'greet'))`.

### defineCommands

```ts
function defineCommands<C extends CommandMap>(): Commands<C>;
```

Typed `invoke`. Command names are the Rust function names (snake_case), argument keys are
the Rust parameter names in camelCase, exactly as Tauri expects.

```ts
type Commands = { greet: (args: { name: string }) => string }
export const commands = defineCommands<Commands>()
await commands.greet({ name: 'kitr' })
```

### emitTauri

```ts
function emitTauri<T>(event: string, payload?: T): Promise<void>;
```

Emit to the Rust side or other windows. No-op in a browser.

### isTauri

```ts
function isTauri(): boolean;
```

True inside a Tauri webview (checks `window.__TAURI_INTERNALS__`), false in a browser.

### useTauriEvent

```ts
function useTauriEvent<T = unknown>(event: string, handler: (payload: T) => void): void;
```

Subscribe to a Tauri event (`app.emit("progress", payload)` on the Rust side).

### CommandMap

```ts
type CommandMap = Record<string, (args: any) => unknown>;
```

A map of Rust `#[tauri::command]` functions: argument object → return type.
`defineCommands<Commands>()` gives you `commands.greet({ name })` typed end to end.

### Commands

```ts
type Commands<C extends CommandMap> = {
  [K in keyof C]: Parameters<C[K]>[0] extends undefined | void ? () => Promise<Awaited<ReturnType<C[K]>>> : (args: Parameters<C[K]>[0]) => Promise<Awaited<ReturnType<C[K]>>>;
};
```

## kitr/desktop/electron

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

### IpcBridge

```ts
interface IpcBridge {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  on(channel: string, listener: (...args: unknown[]) => void): () => void;
  send(channel: string, ...args: unknown[]): void;
}
```

### IpcClient

```ts
type IpcClient<S extends IpcSchema, E extends IpcEvents = {}> = {
  invoke<K extends keyof S & string>(channel: K, ...args: Parameters<S[K]>): Promise<Awaited<ReturnType<S[K]>>>;
  on<K extends keyof E & string>(channel: K, listener: (...args: Parameters<E[K]>) => void): () => void;
  send(channel: string, ...args: unknown[]): void;
  /** True when the preload bridge is present (running inside Electron). */
  readonly available: boolean;
};
```

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

## kitr/desktop/electron-main

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

### IpcHandlers

```ts
type IpcHandlers<S extends IpcSchema> = {
  [K in keyof S]: (event: IpcMainInvokeEvent, ...args: Parameters<S[K]>) => ReturnType<S[K]> | Promise<Awaited<ReturnType<S[K]>>>;
};
```

## kitr/desktop/electron-preload

### exposeIpc

```ts
function exposeIpc(contextBridge: ContextBridge, ipcRenderer: IpcRenderer, options?: {
  key?: string;
  allow?: (channel: string) => boolean;
}): void;
```

Expose a minimal, channel-agnostic bridge. The renderer's `createIpcClient<Schema>()`
adds the types; nothing else from Node or Electron crosses the context boundary.

```ts
import { contextBridge, ipcRenderer } from 'electron'
exposeIpc(contextBridge, ipcRenderer)
```

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
