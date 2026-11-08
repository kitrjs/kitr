---
title: Overview
description: Ship the same app to Windows, macOS and Linux as a small Tauri binary on the operating system's webview.
order: 0
---

# Tauri

Some desktop apps have to be small: a download of a few megabytes, a window that starts fast and idles on little memory. Electron's bundled browser engine rules that out. Tauri uses the webview the operating system already has and a Rust binary behind it, at the cost of rendering differences between platforms and a second language for native code.

`@kitr/tauri` is the desktop platform for that trade: the same `app/`, in a small Tauri window, with typed calls from components to Rust.

## What it is

`@kitr/tauri` adds a Tauri platform to `kitrrc.ts`. `kitr dev` runs the window with hot reload, `kitr build` builds installers through the Tauri CLI, and `defineCommands` types every `#[tauri::command]` from TypeScript so a component calls Rust with checked arguments and a typed result. `commandQuery` and `commandMutation` plug those commands into [query](/packages/query), `useTauriEvent` listens to events from Rust, and the provider moves [platform](/packages/platform) and [storage](/packages/storage) to their Tauri drivers.

`@kitr/tauri/client` and the provider run in the window, and in a plain browser, where they stand aside. The Rust project runs as the app's native process. For most desktop apps we recommend [desktop](/packages/desktop) (Electron) instead, which ships its own browser engine so the app renders the same on every OS.

## Install

```sh
kitr add tauri app
```

This installs `@kitr/tauri` with the Tauri API, store plugin and CLI, registers the provider and an `app` platform in `kitrrc.ts`, writes the Rust project in `platforms/app/src-tauri/` with one `greet` command, and `app/commands.ts`, its typed mirror. It adds [router](/packages/router), [platform](/packages/platform) and [storage](/packages/storage) first when they are missing. You need a Rust toolchain on the machine. The guide's [Install](/packages/tauri/guide#install) section lists every change.

## Quick start

Run the platform. kitr starts Vite on port 3200, waits for it, then runs `tauri dev` pointing the window at that port. The first run compiles the Rust crate, which takes a few minutes; later runs take seconds:

```sh
kitr dev app
```

The scaffold wrote one Rust command and its typed mirror:

```rust
// platforms/app/src-tauri/src/lib.rs
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {name}!")
}
```

```ts
// app/commands.ts
import { defineCommands } from '@kitr/tauri/client'

export type Commands = {
  greet: (args: { name: string }) => string
}

export const commands = defineCommands<Commands>()
```

Call it from a component, guarded so the web build still runs:

```tsx
// app/components/welcome.tsx
import { isTauri } from '@kitr/tauri/client'
import { useEffect, useState } from 'react'
import { commands } from '#app/commands'

export function Welcome() {
  const [greeting, setGreeting] = useState('Welcome to Acme Orders')
  useEffect(() => {
    if (isTauri()) void commands.greet({ name: 'Ada' }).then(setGreeting)
  }, [])
  return <h1>{greeting}</h1>
}
```

In the Tauri window the heading reads `Hello, Ada!`, computed in Rust. In the browser (`kitr dev site`) it stays `Welcome to Acme Orders`. The guide continues from here: [Open your first window](/packages/tauri/guide#open-your-first-window).

## Built on

`@kitr/tauri` is built on [Tauri 2](https://v2.tauri.app/). The window renders with the OS webview: WebView2 (Chromium-based) on Windows, WKWebView (Safari's engine) on macOS and WebKitGTK on Linux. Native code is Rust, and Tauri plugins (`plugin-store`, `plugin-opener`, `plugin-process`) cover storage, external links and exit.

kitr adds the platform contract, the generated Tauri config and icons, typed commands and events, the query helpers, the CSP that lets the app run inside the window, and the drivers for platform and storage.

## Problems it solves

- **A second codebase for the desktop app.** The same `app/` ships to the browser and the window. See [Open your first window](/packages/tauri/guide#open-your-first-window).
- **Untyped `invoke('command', args)` strings.** `defineCommands` types each command's arguments and result. See [Add a Rust command](/packages/tauri/guide#add-a-rust-command).
- **Rust errors arriving as strings.** Return typed errors that become `KitrError`s in the UI. See [Return an error from Rust](/packages/tauri/guide#return-an-error-from-rust).
- **Command results with no caching.** `commandQuery` and `commandMutation` give them the same cache as any API. See [Read a command with a query](/packages/tauri/guide#read-a-command-with-a-query).
- **Permissions that block the window.** Grant the capabilities the app needs. See [Grant the window permissions](/packages/tauri/guide#grant-the-window-permissions).
- **Installers and signing.** `kitr build` runs the Tauri CLI with working defaults. See [Build installers](/packages/tauri/guide#build-installers).

## Further reading

- [Guide](/packages/tauri/guide): install, configure and every task.
- [API reference](/packages/tauri/api): every export with its signature.
- [Tauri documentation](https://v2.tauri.app/start/): commands, events, plugins and distribution.
- [Desktop](/packages/desktop): the recommended desktop platform, with Chromium in the app and Node.js IPC.
- [Query](/packages/query), [Platform](/packages/platform) and [Storage](/packages/storage): what the commands and drivers plug into.
- [Platforms](/docs/platforms): every platform type and the commands they share.
