---
title: Tauri
description: Ship the same app to Windows, macOS and Linux as a small Tauri binary on the operating system's webview.
order: 1
---

# Tauri

The tauri platform wraps your `app/` in a Tauri 2 window for Windows, macOS and Linux: a small Rust binary around the webview the operating system provides, so downloads stay a few megabytes. Prefer [desktop](/packages/desktop) (Electron) when the app has to render the same on every machine, or when you would rather not build Rust: we recommend it for most setups.

```ts
import { tauri } from 'kitr/tauri'

export default defineKitrConfig({
  platforms: {
    site: web({ mode: 'spa' }),
    app: tauri({ title: 'Acme', width: 1200, height: 800 }),
  },
})
```

## Install

```sh
kitr add tauri app
```

This installs `@kitr/tauri` with `@tauri-apps/api`, `@tauri-apps/plugin-store` and `@tauri-apps/cli`, adds the [router](/packages/router), [platform](/packages/platform) and [storage](/packages/storage) packages if missing, writes `platforms.app` into `kitrrc.ts`, registers the Tauri drivers through `kitr/tauri/provider`, and scaffolds the Rust project under `platforms/app/src-tauri/` plus `app/commands.ts` for the typed commands. Building needs the [Rust toolchain](https://tauri.app/start/prerequisites/); `kitr doctor` checks for it.

## Run it

```sh
kitr dev app
kitr build app
```

`kitr dev app` starts the Vite dev server and opens the Tauri window on it. `kitr build app` builds the web bundle into `dist/app/client`, then runs `tauri build` for installers in `platforms/app/src-tauri/target/release/bundle` (`--debug` keeps a debug build).

## Options

| Option | Default | Description |
| --- | --- | --- |
| `port` | `3200` | Dev server port the window loads from |
| `title`, `width`, `height`, `minWidth`, `minHeight` | | The main window |
| `appId` | | Bundle identifier (reverse DNS) |
| `devtools` | `true` | Open devtools in development |

## Calling native code

Declare your Rust commands once and call them typed. Command names are the Rust function names, argument keys the Rust parameter names in camelCase, as Tauri expects.

```ts
// app/commands.ts
import { commandQuery, defineCommands } from 'kitr/tauri/client'

type Commands = { greet: (args: { name: string }) => string }
export const commands = defineCommands<Commands>()
export const greeting = commandQuery(commands.greet, 'greet')

await commands.greet({ name: 'kitr' })
```

`useTauriEvent('name', handler)` subscribes to events the Rust side emits and `emitTauri('name', payload)` sends one back. `isTauri()` is false in a plain browser and `emitTauri` is a no-op there, so the same `app/` ships to the web unchanged. Permissions live in `src-tauri/capabilities/default.json`.

## Tauri or Electron

Both platforms load the same client build and expose the same `platform` and `storage` drivers, so switching is a matter of replacing the platform in `kitrrc.ts`. Tauri gives much smaller downloads and lower memory use, but the webview differs between Windows, macOS and Linux and the build needs Rust. [Electron](/packages/desktop) ships its own Chromium, so what you test is what every user runs, at the cost of a bigger download. Keep one or the other; the two packages are independent and neither installs the other's tooling.
