---
title: Desktop
description: Ship the same app to Windows, macOS and Linux in an Electron shell: Chromium ships with the app, so it renders the same everywhere.
order: 1
---

# Desktop

The desktop platform wraps your `app/` in an Electron window for Windows, macOS and Linux. Electron bundles its own Chromium and Node, so the app renders the same on every machine, and the main process has the whole Node API. Prefer [Tauri](/packages/tauri) when a small binary on the operating system's own webview matters more.

```ts
import { desktop } from 'kitr/desktop'

export default defineKitrConfig({
  platforms: {
    site: web({ mode: 'spa' }),
    app: desktop({ title: 'Acme', width: 1200, height: 800 }),
  },
})
```

## Install

```sh
kitr add desktop app
```

This installs `@kitr/desktop` with `electron`, `electron-vite` and `electron-builder`, adds the [router](/packages/router), [platform](/packages/platform) and [storage](/packages/storage) packages if missing, writes `platforms.app` into `kitrrc.ts`, registers the Electron drivers through `kitr/desktop/provider`, and scaffolds `platforms/app/` with `main.ts`, `preload.ts`, `ipc.ts`, `electron.vite.config.ts` and `electron-builder.yml`, plus `app/ipc.ts` for the renderer.

## Run it

```sh
kitr dev app
kitr build app
```

`kitr dev app` starts the Vite dev server and opens the Electron window on it, rebuilding main and preload on change. `kitr build app` builds the web bundle into `dist/app/client`, the main and preload processes into `dist/app/electron`, then runs `electron-builder` for installers in `dist/app/release` (`--no-pack` skips that step, `--dir` leaves an unpacked folder).

## Options

| Option | Default | Description |
| --- | --- | --- |
| `port` | `3200` | Dev server port the window loads from |
| `title`, `width`, `height`, `minWidth`, `minHeight` | | The main window |
| `appId` | | Bundle identifier (reverse DNS) |
| `devtools` | `true` | Open devtools in development |

## Calling native code

One IPC schema shared by main, preload and the renderer lives in `platforms/app/ipc.ts`. `handleIpc()` implements it in main, `exposeIpc()` exposes it in preload, and `createIpcClient<Ipc>()` calls it from the app.

```ts
// platforms/app/ipc.ts
export type Ipc = {
  'app.version': () => string
  'dialog.openFile': () => string | null
}

// app/ipc.ts
import { createIpcClient } from 'kitr/desktop/client'
export const ipc = createIpcClient<Ipc>()

const version = await ipc.invoke('app.version')
```

`ipc.available` is false and `isElectron()` returns false in a plain browser, so the same `app/` ships to the web unchanged. Windows keep context isolation and the sandbox on; only the channels declared in `ipc.ts` and kitr's own `kitr:*` channels reach the renderer.

## Electron or Tauri

Both platforms load the same client build and expose the same `platform` and `storage` drivers. Electron is the recommended default for most setups: it ships a browser with the app, so what you test is what every user runs. [Tauri](/packages/tauri) uses the webview the operating system provides, which makes for much smaller downloads but means rendering can differ between machines and needs the Rust toolchain to build. Keep one or the other in `kitrrc.ts`; the two packages are independent and neither installs the other's tooling.
