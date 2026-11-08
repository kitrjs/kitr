---
title: Desktop
description: Ship the same app to Windows, macOS and Linux in an Electron shell: Chromium ships with the app, so it renders the same everywhere.
order: 1
---

# Desktop

Some teams want the app in the dock or the Start menu: a window that opens offline and saves files where users choose. `@kitr/desktop` wraps the same `app/` you ship to the browser in an [Electron](https://www.electronjs.org/docs/latest) window and gives you a typed channel between the window and the Node.js process behind it.

> [!SUMMARY]
> Ship the same app to Windows, macOS and Linux in an Electron shell. Add it with `kitr add desktop app`; the overview is at [/packages/desktop](/packages/desktop).

Electron bundles its own Chromium and Node.js, so the app behaves the same on every machine. kitr adds:

- `kitr dev` with hot reload through [electron-vite](https://electron-vite.org/), and `kitr build` for installers through [electron-builder](https://www.electron.build/).
- One TypeScript type describing every call between the window and the main process.
- `@kitr/desktop/provider`, which moves [platform](/packages/platform) and [storage](/packages/storage) to their Electron drivers.

The code runs in three places: `@kitr/desktop/client` in the window (standing aside in a plain browser), `@kitr/desktop/main` in Electron's main process, and `@kitr/desktop/preload` between the two.

The examples ship the Acme orders app to the desktop: a warehouse team checks orders, saves invoices as PDF files and watches sync progress, with the code the browser runs at `app.acme.com`.

## When to use it

Use `@kitr/desktop` for most desktop apps. Chromium ships inside the app, so every user runs the page your team tested, and the main process is plain Node.js, so any npm package works.

Use [Tauri](/packages/tauri) when download size matters more than identical rendering: it uses the system webview, which differs between platforms, and needs Rust to build. Your app code stays the same either way.

## Install

Add a desktop platform named `app`:

```sh
kitr add desktop app
```

`desktop` is the platform type and `app` is the name you address it by (`kitr dev app`); without a name it uses `app`. A name starts with a letter and holds letters, digits, `-` and `_`.

<details>
<summary>Everything kitr add changes</summary>

What `kitr add desktop app` does:

- Installs `@kitr/desktop` and adds it to `packages` in `kitrrc.ts`.
- Adds the packages the platform needs when they are missing, each with its own setup: [Router](/packages/router) (and [React](/packages/react) before it), [Platform](/packages/platform), which writes `config/platform.ts`, and [Storage](/packages/storage), which writes `config/storage.ts` and `app/storage.ts`.
- Installs `electron`, `electron-vite` and `electron-builder` as dev dependencies.
- Adds `() => import('@kitr/desktop/provider')` to `providers` in `kitrrc.ts`.
- Writes `app: desktop({...})` into `platforms` in `kitrrc.ts`, with the flags you passed as options, and adds `import { desktop } from '@kitr/desktop'`.
- Sets the `dev`, `build` and `start` scripts in `package.json` to `kitr dev`, `kitr build` and `kitr start`.
- Writes `platforms/app/ipc.ts`, `main.ts`, `preload.ts`, `electron.vite.config.ts` and `electron-builder.yml`, and `app/ipc.ts` for the window. Files that already exist are kept.
- Sets `"main"` in `package.json` to `dist/app/electron/main/index.js`, so Electron and electron-builder find the built main process.
- Adds a `kitr: platform app` section to `AGENTS.md`: how to run and build, where IPC is declared and implemented, and to keep context isolation and the sandbox on.

</details>

`@kitr/desktop` asks no questions. Platform options are flags on the same command, named as in the options table under Configure:

```sh
kitr add desktop app --title "Acme Orders" --width 1280 --height 860 --appId com.acme.orders
```

| Flag | Default | Effect |
| --- | --- | --- |
| `--port` | `3200` | Dev server port the window loads from. |
| `--title` | the package name | Window title and product name. |
| `--width`, `--height` | `1200`, `800` | Initial window size. |
| `--minWidth`, `--minHeight` | | Smallest window size. |
| `--appId` | `com.example.<app>` | Reverse-DNS bundle identifier. |
| `--no-devtools` | | Do not open devtools in development. |
| `--no-scaffold` | | Register the platform without writing `platforms/app/` or `app/ipc.ts`. |
| `--no-install` | | Edit `package.json` without running the package manager. |
| `--dry-run` | | Print what would change. |

The `desktop` kit has an `app` desktop platform next to a `site` web platform and a home page that calls the typed IPC:

```sh
kitr new acme-orders --kit desktop
```

<details>
<summary>Removing the platform</summary>

`kitr platforms remove app` takes the platform out of `kitrrc.ts` (with the last one, also the `desktop` import and provider line). It leaves `platforms/app/` for you to delete. `kitr remove desktop` does this for every desktop platform and removes `@kitr/desktop`; the Electron dev dependencies and the `"main"` field stay.

</details>

## Configure

`@kitr/desktop` has no config file in `config/`. Its options live on the `desktop()` call in `kitrrc.ts`:

```ts
// kitrrc.ts
import { defineKitrConfig } from 'kitr/app'
import { desktop } from '@kitr/desktop'
import { web } from '@kitr/web'

export default defineKitrConfig({
  packages: ['@kitr/react', '@kitr/router', '@kitr/platform', '@kitr/storage', '@kitr/web', '@kitr/desktop'],
  providers: [
    () => import('@kitr/platform/provider'),
    () => import('@kitr/storage/provider'),
    () => import('@kitr/web/provider'),
    () => import('@kitr/desktop/provider'),
  ],
  platforms: {
    site: web({ mode: 'spa' }),
    app: desktop({ title: 'Acme Orders', width: 1280, height: 860, appId: 'com.acme.orders' }),
  },
})
```

| Option | Default | Description |
| --- | --- | --- |
| `port` | `3200` | Port of the Vite dev server the window loads with `kitr dev app`. Read on every run. |
| `title` | the package name | Window title, and `productName` in `electron-builder.yml`. `acme-orders` becomes `Acme Orders`. |
| `width` | `1200` | Initial window width in pixels. |
| `height` | `800` | Initial window height in pixels. |
| `minWidth` | | Smallest width the user can resize to. |
| `minHeight` | | Smallest height the user can resize to. |
| `appId` | `com.example.<app>` | Reverse-DNS bundle identifier in `electron-builder.yml`. The default lower-cases the title and keeps letters and digits: `Acme Orders` gives `com.example.acmeorders`. |
| `devtools` | `true` | Open Chromium devtools, detached, when the window loads the dev server. |

> [!WARNING] Edit the scaffolded files
> Every option except `port` is written into `platforms/app/main.ts` and `electron-builder.yml` by `kitr add`. Changing it in `kitrrc.ts` later does not rewrite them: edit the files, or delete one and run `kitr platforms scaffold app`.

With `title: 'Acme Orders'` and `appId: 'com.acme.orders'`, the packaging config is:

```yaml
# platforms/app/electron-builder.yml
appId: com.acme.orders
productName: Acme Orders
directories:
  output: dist/app/release
files:
  - dist/app/client/**
  - dist/app/electron/**
  - package.json
mac:
  category: public.app-category.productivity
win:
  target: nsis
linux:
  target: AppImage
```

and the build config for the two Node-side bundles:

```ts
// platforms/app/electron.vite.config.ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

/** Main and preload only. The renderer is the kitr client build in dist/app/client. */
export default defineConfig({
  main: {
    root: __dirname,
    plugins: [externalizeDepsPlugin()],
    build: { lib: { entry: 'main.ts' }, outDir: '../../dist/app/electron/main' },
  },
  preload: {
    root: __dirname,
    plugins: [externalizeDepsPlugin()],
    build: { lib: { entry: 'preload.ts' }, outDir: '../../dist/app/electron/preload' },
  },
})
```

The window itself is the kitr client build in `dist/app/client`, built by Vite with the kitr Vite plugin.

| Variable | Used for |
| --- | --- |
| `KITR_APP_<OPTION>` | Overrides one option for one run of the CLI: `KITR_APP_PORT=3300 kitr dev app`. The platform name is upper-cased. |
| `ELECTRON_RENDERER_URL` | Set by `kitr dev app` to the dev server URL. `createMainWindow()` loads it instead of the built client. |
| `KITR_PLATFORM` | Set to `app` by `kitr dev` and `kitr build`, so the Vite plugin builds this platform into `dist/app`. |
| `CSC_LINK`, `CSC_KEY_PASSWORD` | Read by electron-builder to sign installers. See "Sign the installers". |

Read or change one option with `kitr config app`, `kitr config app port 3300` or `kitr config app minWidth --unset`.

## Open your first window

Run the desktop platform:

```sh
kitr dev app
```

kitr starts Vite, waits until it answers, then starts Electron. The window opens on your app with devtools beside it, and edits update in place.

The scaffold already declared two commands in `platforms/app/ipc.ts` and wrote a typed client for the window:

```ts
// app/ipc.ts
import { createIpcClient } from '@kitr/desktop/client'
import type { Ipc, IpcPush } from '../platforms/app/ipc'

/** Typed renderer-side client. `ipc.available` is false in a plain browser, so the web build still runs. */
export const ipc = createIpcClient<Ipc, IpcPush>()
```

Show the app version from the main process in the footer:

```tsx
// app/components/app-version.tsx
import { useEffect, useState } from 'react'
import { ipc } from '#app/ipc'

export function AppVersion() {
  const [version, setVersion] = useState<string>()
  useEffect(() => {
    if (ipc.available) void ipc.invoke('app.version').then(setVersion)
  }, [])
  return <small>{version ? `Acme Orders ${version}` : 'Acme Orders on the web'}</small>
}
```

In Electron the footer reads `Acme Orders 0.1.0`, the `version` from `package.json`; in the browser (`kitr dev site`) it reads `Acme Orders on the web`.

## Declare an IPC command

Every call from the window to the main process is declared once in `platforms/app/ipc.ts`: the key is the channel name and the value is the function signature. Main, preload and the window import this one file, so a typo or wrong argument is a type error.

```ts
// platforms/app/ipc.ts
/**
 * The IPC contract shared by main, preload and the renderer. Add a command here and to
 * `channels`, implement it in main.ts, call it from the app with `ipc.invoke('...')`.
 */
export type Ipc = {
  'app.version': () => string
  'dialog.openFile': (filters?: Array<{ name: string; extensions: string[] }>) => string | null
  'invoices.save': (invoice: { id: string; customer: string; pdf: Uint8Array }) => string | null
}

/** Events pushed from main to the renderer. */
export type IpcPush = {
  'app.focus': (focused: boolean) => void
  'orders.syncProgress': (percent: number) => void
}

/** Every channel above, at run time: preload lets only these (and kitr:*) through. */
export const channels = {
  'app.version': true,
  'dialog.openFile': true,
  'invoices.save': true,
  'app.focus': true,
  'orders.syncProgress': true,
} satisfies Record<keyof Ipc | keyof IpcPush, true>
```

`channels` is the same list at run time, for the preload's [allow list](#limit-which-channels-reach-the-window). Name channels `<area>.<verb>`; `kitr:` names are reserved.

Arguments and results must be plain data: objects, arrays, strings, numbers, dates, `Uint8Array` and `Map` work; functions and class instances do not.

## Implement a command in the main process

`handleIpc<Ipc>(ipcMain, handlers)` registers one handler per channel; each gets Electron's `IpcMainInvokeEvent`, then the window's arguments. TypeScript requires a handler for every channel in `Ipc`.

```ts
// platforms/app/main.ts
import { writeFile } from 'node:fs/promises'
import { app, BrowserWindow, dialog, ipcMain, protocol } from 'electron'
import { createIpcEmitter, createMainWindow, handleIpc, handleKitrIpc, registerAppScheme } from '@kitr/desktop/main'
import type { Ipc, IpcPush } from './ipc'

const window = { title: 'Acme Orders', width: 1280, height: 860 }

registerAppScheme(protocol)

const push = createIpcEmitter<IpcPush>(() => BrowserWindow.getAllWindows()[0]?.webContents)

handleIpc<Ipc>(ipcMain, {
  'app.version': () => app.getVersion(),
  'dialog.openFile': async (_event, filters) => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  },
  'invoices.save': async (_event, invoice) => {
    const result = await dialog.showSaveDialog({
      title: `Save invoice for ${invoice.customer}`,
      defaultPath: `${invoice.id}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (result.canceled || !result.filePath) return null
    await writeFile(result.filePath, invoice.pdf)
    return result.filePath
  },
})

app.whenReady().then(async () => {
  handleKitrIpc(ipcMain, app)
  const win = await createMainWindow({ ...window, devtools: true })
  win.on('focus', () => push.emit('app.focus', true))
  win.on('blur', () => push.emit('app.focus', false))
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createMainWindow(window)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

This is the scaffolded `main.ts` with an `invoices.save` handler added. When a handler throws, the promise in the window rejects with Electron's message.

> [!WARNING]
> Typed arguments are not trusted arguments. The main process can read and write any file, so check paths and sizes in the handler as you would on a server.

## Call the main process from a component

`ipc.invoke(channel, ...args)` resolves with the handler's return value; the channel name autocompletes and arguments are checked against `Ipc`:

```tsx
// app/components/invoices/save-invoice-button.tsx
import { useState } from 'react'
import { ipc } from '#app/ipc'

export function SaveInvoiceButton({ id, customer }: { id: string; customer: string }) {
  const [savedTo, setSavedTo] = useState<string | null>(null)
  const [error, setError] = useState<string>()

  async function save() {
    const res = await fetch(`/api/invoices/${id}.pdf`)
    const pdf = new Uint8Array(await res.arrayBuffer())
    try {
      setSavedTo(await ipc.invoke('invoices.save', { id, customer, pdf }))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (!ipc.available) return <a href={`/api/invoices/${id}.pdf`} download>Download invoice</a>
  return (
    <>
      <button type="button" onClick={save}>Save invoice as PDF</button>
      {savedTo ? <p>Saved to {savedTo}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </>
  )
}
```

The button opens the native save dialog with `inv_2041.pdf` filled in; cancelling leaves `savedTo` as `null`. In the browser the component renders a plain download link.

## Push events from the main process

Some things start in the main process, like sync progress. Declare them in `IpcPush`, send with `createIpcEmitter<IpcPush>()` in main, and listen with `ipc.on()` in the window.

```ts
// platforms/app/sync.ts
import { BrowserWindow } from 'electron'
import { createIpcEmitter } from '@kitr/desktop/main'
import type { IpcPush } from './ipc'

const push = createIpcEmitter<IpcPush>(() => BrowserWindow.getAllWindows()[0]?.webContents)

export async function syncOrders(batches: string[][]) {
  for (const [index, batch] of batches.entries()) {
    await fetch('https://app.acme.com/api/orders/sync', { method: 'POST', body: JSON.stringify(batch) })
    push.emit('orders.syncProgress', Math.round(((index + 1) / batches.length) * 100))
  }
}
```

`createIpcEmitter(target)` takes a function that finds the current window at send time; with no window, `emit()` does nothing. `ipc.on()` returns the unsubscribe function, which fits `useEffect`:

```tsx
// app/components/orders/sync-progress.tsx
import { useEffect, useState } from 'react'
import { ipc } from '#app/ipc'

export function SyncProgress() {
  const [percent, setPercent] = useState(0)
  useEffect(() => ipc.on('orders.syncProgress', setPercent), [])
  return <progress max={100} value={percent}>{percent}%</progress>
}
```

Outside Electron, `ipc.on()` returns a no-op unsubscribe, so the effect is safe in the browser.

## Send a message without waiting for an answer

`ipc.send(channel, ...args)` fires a one-way message, such as a log line. It is not typed against `Ipc`; listen with Electron's `ipcMain.on()` in main.

```ts
// app/lib/orders/log-view.ts
import { ipc } from '#app/ipc'

export function logOrderViewed(orderId: string) {
  ipc.send('orders.viewed', orderId)
}
```

```ts
// platforms/app/main.ts
import { ipcMain } from 'electron'

ipcMain.on('orders.viewed', (_event, orderId: string) => {
  console.log(`[acme] order ${orderId} viewed`)
})
// logOrderViewed('ord_1042') => prints "[acme] order ord_1042 viewed" in the terminal running kitr dev
```


## Keep the web build working

The same `app/` ships to the browser, where there is no Electron. Two checks:

| Check | True when |
| --- | --- |
| `ipc.available` | The preload bridge is present, so `invoke()` will reach main. |
| `isElectron()` | The bridge is present, or the user agent contains `Electron`. |

Check `ipc.available` before calling the main process. Without the bridge, `ipc.invoke()` rejects, `ipc.on()` returns a no-op and `ipc.send()` does nothing. Use `isElectron()` for anything that only depends on running in the shell:

```tsx
// app/components/title-bar.tsx
import { isElectron } from '@kitr/desktop/client'

export function TitleBar() {
  // Electron draws the window title; the browser tab shows document.title instead.
  if (isElectron()) return null
  return <header className="border-b px-4 py-2 font-semibold">Acme Orders</header>
}
```

For behaviour that is not specific to Electron, such as opening links or reading the app version, use the [platform service](/packages/platform); it answers the same way in Tauri and on phones.

> [!WARNING]
> Don't import `electron` in `app/`: the window runs sandboxed and the import fails at run time. Everything the window needs from Node goes through an IPC command.

## Limit which channels reach the window

`exposeIpc(contextBridge, ipcRenderer)` in the preload puts a bridge at `window.kitrIpc` with `invoke`, `on` and `send`; nothing else from Node crosses into the page. The scaffolded preload passes `allow` to forward only the channels `ipc.ts` declares:

```ts
// platforms/app/preload.ts
import { contextBridge, ipcRenderer } from 'electron'
import { allowChannels, exposeIpc } from '@kitr/desktop/preload'
import { channels } from './ipc'

// Only the channels declared in ipc.ts (and kitr's own kitr:* channels) reach the renderer.
exposeIpc(contextBridge, ipcRenderer, { allow: allowChannels(channels) })
```

`allowChannels()` takes the `channels` record or an array and always lets the `KITR_CHANNELS` through, which the provider's storage, platform and device drivers use. `allow` also takes any `(channel) => boolean`; a hand-written one must keep `KITR_CHANNELS`. Any other channel rejects with `IPC channel "fs.readAnything" is not allowed`.

> [!WARNING] The allow list is your boundary
> If the window ever loads content you did not write, only the allow list protects the main process. Keep it to the channels the app uses, and keep the scaffold's `contextIsolation: true`, `sandbox: true` and `nodeIntegration: false`.

To expose the bridge under another name, pass the same key to both sides:

```ts
// app/admin-ipc.ts
import { createIpcClient } from '@kitr/desktop/client'
import type { AdminIpc } from '../platforms/app/admin-ipc'

// preload: exposeIpc(contextBridge, ipcRenderer, { key: 'acmeAdminIpc' })
export const adminIpc = createIpcClient<AdminIpc>('acmeAdminIpc')
```

`isElectron()` and the provider only look for the default `kitrIpc` key, so keep that bridge too.

## Unregister handlers

`handleIpc()` returns a function that removes every handler it registered, for features you switch off at run time:

```ts
// platforms/app/admin.ts
import { ipcMain } from 'electron'
import { handleIpc } from '@kitr/desktop/main'
import type { AdminIpc } from './admin-ipc'

let stop: (() => void) | undefined

export function enableAdminTools() {
  stop = handleIpc<AdminIpc>(ipcMain, {
    'teams.list': async () => [{ id: 'team_1', name: 'Warehouse', lead: 'Grace' }],
  })
}

export function disableAdminTools() {
  stop?.()
}
```

> [!WARNING]
> Electron allows one handler per channel. Registering a channel twice throws, so remove the old handlers first.

## Configure the main window

`createMainWindow(options)` creates a `BrowserWindow` with secure defaults, wires the preload and loads the right URL. It takes every [`BrowserWindow` option](https://www.electronjs.org/docs/latest/api/structures/browser-window-options) plus four of its own:

| Option | Default | Description |
| --- | --- | --- |
| `devUrl` | `process.env.ELECTRON_RENDERER_URL` | URL to load in development. `kitr dev` sets the variable. |
| `clientDir` | `../../client` next to the main bundle | The built client, served at `app://-/` when there is no dev URL. |
| `preload` | `../preload/index.js` next to the main bundle | The built preload script. |
| `devtools` | `true` | Open devtools, detached, when loading the dev URL. Never in a build. |
| `width`, `height` | `1200`, `800` | Any `BrowserWindow` option is passed through. |
| `show` | `false` | The window is shown on `ready-to-show`, so it never flashes white. |
| `webPreferences` | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` | Merged over the defaults. |

A second window for one order, with a fixed size and a title bar that blends into the page on macOS:

```ts
// platforms/app/order-window.ts
import { createMainWindow } from '@kitr/desktop/main'

export async function openOrderWindow(orderId: string) {
  const win = await createMainWindow({
    title: `Order ${orderId}`,
    width: 720,
    height: 640,
    resizable: false,
    titleBarStyle: 'hiddenInset',
  })
  await win.loadURL(win.webContents.getURL().replace(/\/?$/, `/orders/${orderId}`))
  return win
}
```

It resolves after the first page loads. Pass `clientDir` and `preload` if you change `outDir` in `electron.vite.config.ts`.

## Serve the built client

In a build there is no dev server, so the window loads `app://-/` and the main process answers from `dist/app/client`. Two functions make that work, and `createMainWindow()` calls the second for you:

- `registerAppScheme(protocol)` makes `app://` behave like `https://` for asset paths, `fetch()`, cookies and service workers. Call it at the top of `main.ts`, before `app.whenReady()`.
- `serveClient(protocol, clientDir)` answers `app://` requests from the folder. A path with no file falls back to `index.html`, so client routes like `app://-/orders/ord_1042` load the app; a path that climbs out of the folder gets `403`.

Call `serveClient()` yourself only when you load the client without `createMainWindow()`:

```ts
// platforms/app/main.ts
import { join } from 'node:path'
import { app, BrowserWindow, protocol } from 'electron'
import { APP_SCHEME, registerAppScheme, serveClient } from '@kitr/desktop/main'

registerAppScheme(protocol)

app.whenReady().then(async () => {
  serveClient(protocol, join(__dirname, '../../client'))
  const win = new BrowserWindow({ width: 1280, height: 860 })
  await win.loadURL(`${APP_SCHEME}://-/orders`)
})
```

Requests to `https://app.acme.com/api/...` go to the network as usual; only `app://` is served from disk.

## Keep data on the user's machine

[Storage](/packages/storage) items persist in a JSON file in Electron's [`userData`](https://www.electronjs.org/docs/latest/api/app#appgetpathname) folder, not Chromium's `localStorage`. You declare and read them as on the web:

```ts
// app/storage.ts
import { defineStorage } from '@kitr/storage'

export const ordersView = defineStorage('orders-view', {
  default: { status: 'open' as 'open' | 'paid' | 'shipped', pageSize: 25 },
})
```

The provider's `electronStorageDriver()` loads every value at boot and writes changes in the background; `handleKitrIpc(ipcMain, app)` in `main.ts` serves them and writes `kitr-storage.json`. Pass a third argument to pick the file:

```ts
// platforms/app/main.ts
import { join } from 'node:path'
import { app, ipcMain } from 'electron'
import { handleKitrIpc } from '@kitr/desktop/main'

app.whenReady().then(() => {
  handleKitrIpc(ipcMain, app, { storageFile: join(app.getPath('userData'), 'acme-orders.json') })
})
```

> [!WARNING]
> Without `handleKitrIpc()` in `main.ts`, reads find nothing and every write logs a "No handler registered" error.

On macOS the default file is `~/Library/Application Support/Acme Orders/kitr-storage.json`. A missing or invalid file starts the store empty.

## Run the device packages in Electron

[Secure storage](/packages/secure-storage), [Notifications](/packages/notifications), [Files](/packages/files), [Updater](/packages/updater) and [Native](/packages/native) each have an Electron driver. The same `handleKitrIpc(ipcMain, app)` call that serves storage serves all of them, with `nodeIntegration` off:

| Package | Main-process work | Channels |
| --- | --- | --- |
| `secure-storage` | `safeStorage` encrypts; ciphertext in `kitr-secure-storage.json` in `userData` | `kitr:secure:get`, `set`, `remove`, `keys` |
| `notifications` | `Notification`, timers for scheduled ones, `app.setBadgeCount`; click and close are pushed back | `kitr:notify:permission`, `show`, `schedule`, `cancel`, `cancel-all`, `pending`, `badge`; `kitr:notify:click`, `close` |
| `files` | `dialog.showOpenDialog` and `showSaveDialog`, then `fs/promises` on the paths they returned | `kitr:files:open`, `choose-save`, `read`, `write`, `stat`, `list`, `reveal` |
| `updater` | `electron-updater`: check, download with progress, `quitAndInstall` | `kitr:updater:check`, `download`, `install`; `kitr:updater:available`, `progress` |
| `native` | `clipboard`, Touch ID, `net.isOnline()`, `nativeTheme`, `powerMonitor`, `shell.openExternal` | `kitr:native:*`, `kitr:shell:open`; `kitr:native:theme`, `power` |

The window gets only what it earned: files are touched only at paths a dialog returned, secure storage refuses to store without an operating system vault, and `openExternal` opens only `http:`, `https:`, `mailto:` and `tel:` links. Options go in the third argument:

```ts
// platforms/app/main.ts
import { join } from 'node:path'
import { app, ipcMain } from 'electron'
import { handleKitrIpc } from '@kitr/desktop/main'

app.whenReady().then(() => {
  const stop = handleKitrIpc(ipcMain, app, {
    storageFile: join(app.getPath('userData'), 'acme-orders.json'),
    secureFile: join(app.getPath('userData'), 'acme-vault.json'),
    externalProtocols: ['https:', 'mailto:', 'acme:'],
  })
  app.on('will-quit', stop) // removes the handlers, timers and power listeners
})
```

<details>
<summary>Device handlers and electron-updater</summary>

`handleKitrIpc()` returns a function that removes the device handlers. To register only those, call `handleKitrDevices(ipcMain, app, options)`. `electron-updater` is imported when the updater is first used; `kitr add desktop` and `kitr add updater` add it to `dependencies`, where electron-builder packs it.

</details>

## Use the platform service on the desktop

The provider registers a `desktop` driver for [Platform](/packages/platform), so platform code works in Electron without `isElectron()` checks:

| Member | In Electron |
| --- | --- |
| `type` | `'desktop'` |
| `native`, `standalone` | `true` |
| `os` | `'macos'`, `'windows'`, `'linux'` or `'unknown'`, from the user agent |
| `appVersion()` | `app.getVersion()` from main, through `kitr:app:version` |
| `openExternal(url)` | Opens the system browser with `shell.openExternal()`, through `kitr:shell:open` |
| `exit()` | Quits with `app.quit()`, through `kitr:app:quit` |
| `onAppState(fn)` | `true` when the page is visible, `false` when the window is minimised or hidden |

```tsx
// app/components/help-menu.tsx
import { usePlatform } from '@kitr/platform/react'

export function HelpMenu() {
  const platform = usePlatform()
  return (
    <nav>
      <button type="button" onClick={() => void platform.openExternal('https://status.acme.com')}>
        Service status
      </button>
      {platform.is('desktop') ? (
        <button type="button" onClick={() => void platform.exit()}>Quit Acme Orders</button>
      ) : null}
    </nav>
  )
}
```

In Electron, "Service status" opens the default browser and "Quit Acme Orders" closes the app; in the browser the first opens a tab and the second is not rendered. They need `handleKitrIpc()` in `main.ts`, which the scaffold calls.

## Build installers

`kitr build app` builds everything and packages the app for the machine you run it on:

```sh
kitr build app
```

It runs three steps in order and stops at the first failure:

1. `vite build`: the client into `dist/app/client`.
2. `electron-vite build -c platforms/app/electron.vite.config.ts`: main and preload into `dist/app/electron`.
3. `electron-builder --config platforms/app/electron-builder.yml`: installers into `dist/app/release`.

The scaffolded `electron-builder.yml` makes an NSIS installer on Windows, a `.dmg` on macOS and an `AppImage` on Linux, versioned from `package.json`.

Two flags shorten the build:

```sh
kitr build app --no-pack   # client, main and preload only; no electron-builder
kitr build app --dir       # an unpacked app in dist/app/release, no installer
```

`--no-pack` is the fast check that everything compiles. `--dir` makes an unpacked folder you can run directly, quicker than an installer when testing packaging.

## Run the production build locally

`kitr start app` runs `electron .`, which starts the built main process from `"main"` in `package.json` and loads the built client over `app://`:

```sh
kitr build app --no-pack
kitr start app
```

This is the app your users get, without installing it. If the window stays blank, check that `"main"` is `dist/app/electron/main/index.js`; `kitr doctor` warns when it is not.

## Package for another operating system

electron-builder packages for the OS it runs on. To pick targets, edit `platforms/app/electron-builder.yml` with any [electron-builder option](https://www.electron.build/configuration):

```yaml
# platforms/app/electron-builder.yml
appId: com.acme.orders
productName: Acme Orders
directories:
  output: dist/app/release
files:
  - dist/app/client/**
  - dist/app/electron/**
  - package.json
mac:
  category: public.app-category.business
  target: [dmg, zip]
win:
  target: [nsis, portable]
linux:
  target: [AppImage, deb]
  category: Office
```

`kitr build app` passes only `--config` and `--dir` to electron-builder. For one OS, or for flags kitr does not forward, build the code with kitr and run electron-builder yourself:

```sh
kitr build app --no-pack
pnpm exec electron-builder --config platforms/app/electron-builder.yml --win --x64
```

Building a macOS app needs a Mac. CI runners for each OS are the reliable route; see the [multi-platform build guide](https://www.electron.build/multi-platform-build).

## Sign the installers

Unsigned apps trigger Gatekeeper on macOS and SmartScreen on Windows. electron-builder signs during packaging when it finds a certificate in the environment `kitr build` passes through:

```sh
export CSC_LINK=./certs/acme-developer-id.p12
export CSC_KEY_PASSWORD="$ACME_CERT_PASSWORD"
kitr build app
```

`CSC_LINK` is a path, URL or base64 of the `.p12`/`.pfx` certificate, and `CSC_KEY_PASSWORD` its password. macOS notarization also needs Apple credentials; see electron-builder's [code signing](https://www.electron.build/code-signing) and [macOS](https://www.electron.build/mac) pages.

> [!WARNING]
> Never commit the certificate or its password. Keep both in your CI's secret store and set them only on the release job.

## Switch to Tauri

App code does not change between the two desktop platforms. The native side does: IPC commands in `platforms/app/main.ts` become Rust commands, and `ipc.invoke()` calls become `commands.<name>()` from `@kitr/tauri/client`:

```sh
kitr platforms remove app
kitr add tauri app
```

Port each handler to a `#[tauri::command]` in `platforms/app/src-tauri/src/lib.rs`, as the [Tauri](/packages/tauri) guide shows, then remove `@kitr/desktop`. Storage values do not move between Electron's `kitr-storage.json` and Tauri's `kitr.json`.

## Commands

The desktop platform answers these commands:

| Command | What it does |
| --- | --- |
| `kitr add desktop <name>` | Adds a desktop platform: installs Electron's toolchain, writes `platforms.<name>`, adds router, platform and storage, scaffolds `platforms/<name>/`. |
| `kitr dev <name>` | Starts Vite on `port` and Electron through electron-vite against it. Flag: `--port`. |
| `kitr build <name>` | Runs `vite build`, `electron-vite build` and `electron-builder`. Flags: `--no-pack`, `--dir`. |
| `kitr start <name>` | Runs `electron .`, which starts the built main process. |
| `kitr config <name> [option] [value]` | Reads or sets an option in `kitrrc.ts`. `--unset` removes one. |
| `kitr platforms` | Lists every platform with its options. |
| `kitr platforms scaffold <name>` | Writes the scaffolded files that are missing. Existing files are kept. |
| `kitr platforms remove <name>` | Takes the platform out of `kitrrc.ts`, with its import and provider when it was the last desktop platform. |

Any option is also a flag on `dev`, `build` and `start` for one run: `kitr dev app --port 3300`.

`kitr doctor` checks each desktop platform and reports:

- an error for each missing dev dependency: `electron`, `electron-vite`, `electron-builder`. Fix: `pnpm add -D <package>`. `electron-updater` is not checked: it is only needed once you use the updater.
- an error when `platforms/app/main.ts` is missing. Fix: `kitr platforms scaffold app`.
- a warning when `"main"` in `package.json` is not `dist/app/electron/main/index.js`.

## Errors

| Message | When | What to do |
| --- | --- | --- |
| `[@kitr/desktop] IPC bridge "kitrIpc" is not available (not running in Electron, or the preload script did not call exposeIpc)` | `ipc.invoke()` ran in a browser, or the preload script did not run. | Check `ipc.available` first. In Electron, check that `preload.ts` calls `exposeIpc()` and the `preload` path is right. |
| `IPC channel "<channel>" is not allowed` | The preload `allow` function rejected the channel. | Add the channel to the allow list. |
| `Error invoking remote method '<channel>': Error: No handler registered for '<channel>'` | No `handleIpc()` handler for the channel, or it was removed. | Implement it in `main.ts`. For `kitr:*` channels, call `handleKitrIpc()`. |
| `Error invoking remote method '<channel>': <error>` | The handler in main threw. | Read the error after the colon; it is the one main threw. |
| `@kitr/desktop: the operating system has no secret vault (safeStorage); secrets are not stored` | `secureStorage.set()` on a machine with no keychain, or on Linux with only the `basic_text` backend. | Install and unlock GNOME Keyring or KWallet. Nothing was written. |
| `@kitr/desktop: <path> was not chosen in a dialog; refusing to access it` | A files call named a path no open or save dialog returned this session. | Let the person pick it with `files.open()` or `files.save()`. |
| `@kitr/desktop: opening <scheme> links is not allowed` | `openExternal()` got a URL other than http, https, mailto or tel. | Pass `externalProtocols` to `handleKitrIpc()` to allow a scheme of your own. |
| `Attempted to register a second handler for '<channel>'` | `handleIpc()` registered a channel that already has a handler. | Call the dispose function from the first `handleIpc()` first. |
| `Platform name "<name>" must be a short identifier (site, api, app, phone...)` | `kitr add desktop` got a name with spaces or symbols. | Use letters, digits, `-` and `_`. |
| `desktop has no option "<flag>" (options: port, title, width, height, minWidth, minHeight, appId, devtools)` | `kitr add desktop` got an unknown flag. | Use one of the listed options; names are camelCase. |
| `electron-builder --config <path> exited with code 1` | Packaging failed. | Read electron-builder's output above it: usually a missing icon, signing or a target the OS cannot build. |

## Testing

Unit tests run in Node or `happy-dom`, with no Electron. The IPC pieces take `ipcMain`, `ipcRenderer` and `contextBridge` as arguments, so a test passes small fakes and runs main, preload and the window in one process. This test checks `invoices.save` end to end, the platform service and storage writes:

```ts
// test/desktop.test.ts
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createIpcClient, IPC_BRIDGE_KEY } from '@kitr/desktop/client'
import { handleIpc, handleKitrIpc } from '@kitr/desktop/main'
import { exposeIpc } from '@kitr/desktop/preload'
import { desktopProvider } from '@kitr/desktop/provider'
import { platformProvider } from '@kitr/platform/provider'
import { createTestApp } from '@kitr/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Ipc, IpcPush } from '../platforms/app/ipc'

type Handler = (event: unknown, ...args: any[]) => unknown

function fakeElectron() {
  const handlers = new Map<string, Handler>()
  const ipcMain = {
    handle: (channel: string, handler: Handler) => void handlers.set(channel, handler),
    removeHandler: (channel: string) => void handlers.delete(channel),
  }
  const ipcRenderer = {
    invoke: async (channel: string, ...args: unknown[]) => {
      const handler = handlers.get(channel)
      if (!handler) throw new Error(`No handler registered for '${channel}'`)
      return handler({}, ...args)
    },
    on: vi.fn(),
    removeListener: vi.fn(),
    send: vi.fn(),
  }
  const contextBridge = {
    exposeInMainWorld: (key: string, value: unknown) => {
      ;(globalThis as any)[key] = value
    },
  }
  return { ipcMain, ipcRenderer, contextBridge }
}

afterEach(() => {
  delete (globalThis as any)[IPC_BRIDGE_KEY]
})

describe('Acme Orders desktop', () => {
  it('saves an invoice through the main process', async () => {
    const electron = fakeElectron()
    const saved: Array<{ id: string; bytes: number }> = []
    handleIpc<Ipc>(electron.ipcMain as any, {
      'app.version': () => '2.4.0',
      'dialog.openFile': () => null,
      'invoices.save': async (_event, invoice) => {
        saved.push({ id: invoice.id, bytes: invoice.pdf.length })
        return `/Users/ada/Documents/${invoice.id}.pdf`
      },
    })
    exposeIpc(electron.contextBridge as any, electron.ipcRenderer as any)

    const ipc = createIpcClient<Ipc, IpcPush>()
    expect(ipc.available).toBe(true)
    const path = await ipc.invoke('invoices.save', {
      id: 'inv_2041',
      customer: 'Ada',
      pdf: new Uint8Array([37, 80, 68, 70]),
    })
    expect(path).toBe('/Users/ada/Documents/inv_2041.pdf')
    expect(saved).toEqual([{ id: 'inv_2041', bytes: 4 }])
  })

  it('answers the platform service and persists storage in userData', async () => {
    const electron = fakeElectron()
    const userData = await mkdtemp(join(tmpdir(), 'acme-orders-'))
    const fakeApp = { getPath: () => userData, getVersion: () => '2.4.0', quit: vi.fn() }
    handleKitrIpc(electron.ipcMain as any, fakeApp as any)
    exposeIpc(electron.contextBridge as any, electron.ipcRenderer as any)

    const app = await createTestApp({ providers: [desktopProvider, platformProvider] })
    const platform = app.container.use('platform')
    expect(platform.type).toBe('desktop')
    expect(platform.native).toBe(true)
    expect(await platform.appVersion()).toBe('2.4.0')

    await platform.exit()
    expect(fakeApp.quit).toHaveBeenCalledOnce()

    const ipc = createIpcClient<Ipc>()
    await (ipc as any).invoke('kitr:storage:set', 'orders-view', '{"status":"paid"}')
    const file = JSON.parse(await readFile(join(userData, 'kitr-storage.json'), 'utf8'))
    expect(file).toEqual({ 'orders-view': '{"status":"paid"}' })
  })

  it('stays out of the way in a browser', async () => {
    const ipc = createIpcClient<Ipc>()
    expect(ipc.available).toBe(false)
    await expect(ipc.invoke('app.version')).rejects.toThrow(/not available/)
  })
})
```

Real handlers call Electron's `dialog` and `fs`, which do not exist in Vitest. Keep logic in plain functions that take what they need (`saveInvoice(invoice, writeFile)`) and the `handleIpc()` handlers thin. Test the real window with `kitr dev app`, and the packaged app with `kitr build app --dir` and `kitr start app`.

## Next steps

- [API reference](/packages/desktop/api): every export of `@kitr/desktop`.
- [Tauri](/packages/tauri): the same app on the system webview, with Rust commands.
- [Platform](/packages/platform): app version, external links and exit on every platform.
