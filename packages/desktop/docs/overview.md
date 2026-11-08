---
title: Overview
description: Ship the same app to Windows, macOS and Linux in an Electron shell: Chromium ships with the app, so it renders the same everywhere.
order: 0
---

# Desktop

## What it is

`@kitr/desktop` adds an Electron platform. `kitr dev` opens your app in a window with hot reload, `kitr build` makes installers, and one `Ipc` type describes every call between the window and the main process.

The client code also runs in a plain browser, where it stands aside. For a smaller download with Rust behind the window, use [tauri](/packages/tauri).

## Install

```sh
kitr add desktop app
```

Adds `@kitr/desktop` with Electron, an `app` platform, `platforms/app/` and the typed `app/ipc.ts` client. Adds [router](/packages/router), [platform](/packages/platform) and [storage](/packages/storage) first if missing. [Every change](/packages/desktop/guide#install).

## Quick start

Run the desktop platform. kitr starts Vite, then opens an Electron window on your app:

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

In the window the footer reads `Acme Orders 0.1.0`. In the browser it reads `Acme Orders on the web`, because `ipc.available` is false there. Next in the guide: [Open your first window](/packages/desktop/guide#open-your-first-window).

## Built on

| Built on | Role | What kitr adds |
| --- | --- | --- |
| [Electron](https://www.electronjs.org/docs/latest) | Bundles Chromium and Node.js, so the app renders and behaves the same on every machine. | The platform contract: `kitr dev`, `kitr build`, `kitr start` and `kitr doctor` know about the window. |
| [electron-vite](https://electron-vite.org/) | Builds the main, preload and renderer bundles with Vite and hot reload. | A generated config wired to `kitrrc.ts`. |
| [electron-builder](https://www.electron.build/) | Produces installers, signs and notarises them. | Defaults for app id, targets and output, overridable in config. |

kitr adds typed IPC: one `Ipc` type, `handleIpc` in main, a safe bridge in preload and `ipc.invoke`, `ipc.send` and `ipc.on` in components.

## Problems it solves

- **A second codebase for the desktop app.** [Open your first window](/packages/desktop/guide#open-your-first-window).
- **Untyped IPC strings.** [Declare an IPC command](/packages/desktop/guide#declare-an-ipc-command).
- **The window reaching Node.js directly.** [Limit which channels reach the window](/packages/desktop/guide#limit-which-channels-reach-the-window).
- **Main-process events the UI never sees.** [Push events from the main process](/packages/desktop/guide#push-events-from-the-main-process).
- **Breaking the web build.** [Keep the web build working](/packages/desktop/guide#keep-the-web-build-working).
- **Installers, signing and cross-platform packaging.** [Build installers](/packages/desktop/guide#build-installers).

For a smaller download on the operating system's own webview, with Rust instead of Node.js behind the window, use [Tauri](/packages/tauri) instead.

## Further reading

- [Guide](/packages/desktop/guide).
- [API reference](/packages/desktop/api).
- [Electron documentation](https://www.electronjs.org/docs/latest).
- [electron-vite](https://electron-vite.org/) and [electron-builder](https://www.electron.build/).
- [Platform](/packages/platform), [Storage](/packages/storage) and [Tauri](/packages/tauri).
- [Platforms](/docs/platforms).
