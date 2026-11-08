---
title: Overview
description: Ship the same app to Windows, macOS and Linux in an Electron shell: Chromium ships with the app, so it renders the same everywhere.
order: 0
---

# Desktop

Some teams want the app in the dock or the Start menu: a window that opens offline, saves files where they choose and keeps running when the browser is closed. Building that by hand means a second project, a second build pipeline and an untyped message bus between the window and the process behind it.

`@kitr/desktop` is the desktop platform. It wraps the `app/` you already ship to the browser and gives you a typed channel to the Node.js side.

## What it is

`@kitr/desktop` adds a desktop platform to `kitrrc.ts`. `kitr dev` opens the app in an Electron window with hot reload, `kitr build` produces installers for Windows, macOS and Linux, and one TypeScript type, `Ipc` in `platforms/app/ipc.ts`, describes every call between the window and the main process. The platform's provider switches [platform](/packages/platform) and [storage](/packages/storage) to their Electron drivers, so app version, external links and saved data come from the operating system instead of the browser.

The code runs in three places: `@kitr/desktop/client` and the provider in the window (and in a plain browser, where they stand aside), `@kitr/desktop/main` in Electron's main process, and `@kitr/desktop/preload` in the preload script between the two.

## Install

```sh
kitr add desktop app
```

This installs `@kitr/desktop` with Electron, electron-vite and electron-builder, registers the provider and an `app` platform in `kitrrc.ts`, and writes `platforms/app/` (main process, preload, IPC declarations) plus the typed `app/ipc.ts` client for the window. It adds [router](/packages/router), [platform](/packages/platform) and [storage](/packages/storage) first when they are missing. The guide's [Install](/packages/desktop/guide#install) section lists every change.

## Quick start

Run the desktop platform. kitr starts Vite on port 3200, waits for it, then opens an Electron window on your app:

```sh
kitr dev app
```

The scaffold already declared an `app.version` command in `platforms/app/ipc.ts` and wrote a typed client for the window. Call it from a component:

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

In the Electron window the footer reads `Acme Orders 0.1.0`, the version from `package.json`. In the browser (`kitr dev site`) it reads `Acme Orders on the web`, because `ipc.available` is false when there is no main process. The guide continues from here: [Open your first window](/packages/desktop/guide#open-your-first-window).

## Built on

| Built on | Role | What kitr adds |
| --- | --- | --- |
| [Electron](https://www.electronjs.org/docs/latest) | Bundles Chromium and Node.js, so the app renders and behaves the same on every machine. | The platform contract: `kitr dev`, `kitr build`, `kitr start` and `kitr doctor` know about the window. |
| [electron-vite](https://electron-vite.org/) | Builds the main, preload and renderer bundles with Vite and hot reload. | A generated config wired to `kitrrc.ts`. |
| [electron-builder](https://www.electron.build/) | Produces installers, signs and notarises them. | Defaults for app id, targets and output, overridable in config. |

On top of all three, kitr adds typed IPC: one `Ipc` type for every command and event between the window and the main process, with `handleIpc` in main, a safe bridge in preload and `ipc.invoke`, `ipc.send` and `ipc.on` in components.

## Problems it solves

- **A second codebase for the desktop app.** The same `app/` builds for the browser and the window; only `kitrrc.ts` changes. See [Open your first window](/packages/desktop/guide#open-your-first-window).
- **Untyped IPC strings.** The `Ipc` type declares each command's input and output, so a renamed channel is a compile error in both processes. See [Declare an IPC command](/packages/desktop/guide#declare-an-ipc-command).
- **The window reaching Node.js directly.** Only the channels you declare cross the preload bridge; context isolation stays on. See [Limit which channels reach the window](/packages/desktop/guide#limit-which-channels-reach-the-window).
- **Main-process events the UI never sees.** Push progress and status from main to the window with the same typed contract. See [Push events from the main process](/packages/desktop/guide#push-events-from-the-main-process).
- **Breaking the web build.** The desktop client stands aside in a plain browser, so one codebase keeps shipping to both. See [Keep the web build working](/packages/desktop/guide#keep-the-web-build-working).
- **Installers, signing and cross-platform packaging.** `kitr build` runs electron-builder with working defaults. See [Build installers](/packages/desktop/guide#build-installers).

For a smaller download on the operating system's own webview, with Rust instead of Node.js behind the window, use [Tauri](/packages/tauri) instead.

## Further reading

- [Guide](/packages/desktop/guide): install, configure and every task, from the first window to signed installers.
- [API reference](/packages/desktop/api): every export of the client, main and preload entry points.
- [Electron documentation](https://www.electronjs.org/docs/latest): windows, menus, dialogs and the process model.
- [electron-vite](https://electron-vite.org/) and [electron-builder](https://www.electron.build/): the build and packaging tools underneath.
- [Platform](/packages/platform), [Storage](/packages/storage) and [Tauri](/packages/tauri): the packages it drives and the alternative shell.
- [Platforms](/docs/platforms): every platform type and the commands they share.
