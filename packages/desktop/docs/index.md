---
title: Desktop
description: Ship the same app to Windows, macOS and Linux, choosing a small Tauri or a familiar Electron shell.
order: 1
---

# Desktop

The desktop platform wraps your `app/` in a native window for Windows, macOS and Linux. Pick the shell: Tauri (a small Rust binary around the system webview) or Electron (a bundled Chromium, with electron-vite).

```ts
import { desktop } from 'kitr/desktop'

export default defineKitrConfig({
  platforms: {
    site: web({ mode: 'spa' }),
    app: desktop({ shell: 'tauri', title: 'Acme', width: 1200, height: 800 }),
  },
})
```

## Install

```sh
kitr add desktop app --shell tauri
```

This installs `@kitr/desktop` and the shell's tooling, adds the [router](/packages/router), [platform](/packages/platform) and [storage](/packages/storage) packages if missing, writes `platforms.app` into `kitrrc.ts`, registers the shell's drivers through `kitr/desktop/provider`, and scaffolds the native project under `platforms/app/`: `src-tauri/` for Tauri, or `main.ts`, `preload.ts` and `ipc.ts` for Electron.

## Run it

```sh
kitr dev app
kitr build app
```

`kitr dev app` starts the Vite dev server and opens the window on it. `kitr build app` builds the web bundle into `dist/app/client`, then runs `tauri build` or `electron-vite build` and `electron-builder` for installers. `kitr doctor` checks the Rust toolchain for Tauri.

## Options

| Option | Default | |
| --- | --- | --- |
| `shell` | `tauri` | `tauri` or `electron` |
| `port` | `3200` | Dev server port the window loads from |
| `title`, `width`, `height`, `minWidth`, `minHeight` | | The main window |
| `appId` | | Bundle identifier (reverse DNS) |
| `devtools` | `true` | Open devtools in development |

## Calling native code

**Tauri**: declare your Rust commands once and call them typed.

```ts
import { commandQuery, defineCommands } from 'kitr/desktop/tauri'

type Commands = { greet: (args: { name: string }) => string }
export const commands = defineCommands<Commands>()
export const greeting = commandQuery(commands.greet, 'greet')
```

**Electron**: one IPC schema shared by main, preload and the renderer (`platforms/app/ipc.ts`), `handleIpc()` in main, `exposeIpc()` in preload, and `createIpcClient<Ipc>()` in the app. Both degrade in a plain browser (`ipc.available`, `isTauri()`), so the same `app/` ships to the web unchanged.
