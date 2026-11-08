---
title: Overview
description: Ship the same app to Windows, macOS and Linux as a small Tauri binary on the operating system's webview.
order: 0
---

# Tauri

## What it is

`@kitr/tauri` adds a Tauri platform: a small desktop app with Rust behind the window. `kitr dev` runs the window with hot reload, `kitr build` makes installers, and `defineCommands` types every Rust command from TypeScript.

The client code also runs in a plain browser. For most desktop apps we recommend [desktop](/packages/desktop) (Electron), which renders the same on every OS.

## Install

```sh
kitr add tauri app
```

Adds `@kitr/tauri` with the Tauri CLI, an `app` platform, the Rust project in `platforms/app/src-tauri/` and `app/commands.ts`. Adds [router](/packages/router), [platform](/packages/platform) and [storage](/packages/storage) first if missing. Needs a Rust toolchain. [Every change](/packages/tauri/guide#install).

## Quick start

Run the platform. The first run compiles the Rust crate, which takes a few minutes:

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

In the Tauri window the heading reads `Hello, Ada!`, computed in Rust. In the browser it stays `Welcome to Acme Orders`. Next in the guide: [Open your first window](/packages/tauri/guide#open-your-first-window).

## Built on

kitr adds the platform contract, the generated config and icons, typed commands and events, the query helpers and the drivers.

## Problems it solves

- **A second codebase for the desktop app.** [Open your first window](/packages/tauri/guide#open-your-first-window).
- **Untyped `invoke('command', args)` strings.** [Add a Rust command](/packages/tauri/guide#add-a-rust-command).
- **Rust errors arriving as strings.** [Return an error from Rust](/packages/tauri/guide#return-an-error-from-rust).
- **Command results with no caching.** [Read a command with a query](/packages/tauri/guide#read-a-command-with-a-query).
- **Permissions that block the window.** [Grant the window permissions](/packages/tauri/guide#grant-the-window-permissions).
- **Installers and signing.** [Build installers](/packages/tauri/guide#build-installers).

## Further reading

- [Guide](/packages/tauri/guide).
- [API reference](/packages/tauri/api).
- [Tauri documentation](https://v2.tauri.app/start/).
- [Desktop](/packages/desktop).
- [Query](/packages/query), [Platform](/packages/platform) and [Storage](/packages/storage).
- [Platforms](/docs/platforms).
