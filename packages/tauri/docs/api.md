---
title: API reference
description: Every export of @kitr/tauri, with its signature.
order: 2
---

# API reference

Every export of `@kitr/tauri`, `@kitr/tauri/client`, `@kitr/tauri/provider`, read from the published type definitions. The [guide](/packages/tauri/guide) shows them in use.

## @kitr/tauri

### ensureIcons

```ts
function ensureIcons(ctx: PlatformContext): Promise<void>;
```

Tauri will not compile without the icons tauri.conf.json lists: make a placeholder set once.

### placeholderPng

```ts
function placeholderPng(size?: number): Promise<Buffer>;
```

A 1024x1024 rounded square in one colour: enough for Tauri, and obviously a placeholder.

### CSP

```ts
const CSP: string;
```

The default policy: the app's own files, Tauri's IPC, and https/wss APIs.

### tauri

```ts
const tauri: import("@kitr/core").PlatformFactory<TauriOptions>;
```

macOS, Windows and Linux through a Tauri shell: a small Rust binary around the webview the
operating system provides. The Rust project lives in `platforms/<name>/src-tauri`; the window
loads the same client build the web platform ships. For a bundled Chromium that renders the
same everywhere, use `@kitr/desktop` (Electron) instead.

```ts
platforms: { app: tauri({ title: 'Acme' }) }
kitr dev app        # Vite on :3200 and the Tauri window with HMR
kitr build app      # client build into dist/<name>/client, then installers
```

### TauriOptions

```ts
interface TauriOptions {
  /** Dev server port the window loads from with `kitr dev <name>`, also written as `build.devUrl`. Default 3200. */
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
  /** Accepted for parity with `desktop()`; the Tauri scaffold does not use it. Default true. */
  devtools: boolean;
}
```

Options of `tauri()` in `kitrrc.ts`. They are written into the scaffolded `tauri.conf.json` by
`kitr add`, which the Tauri CLI reads; edit that file to change them later.

## @kitr/tauri/client

### commandMutation

```ts
function commandMutation<TInput, TOutput>(command: (args: TInput) => Promise<TOutput>, options?: {
  effects?: MutationContract<TInput, TOutput>['effects'];
}): Omit<MutationContract<TInput, TOutput>, 'kind'>;
```

A mutation contract over a command, for `mutationFrom(commandMutation(commands.ship_order, { effects }))`.
`effects` say which cached queries to set, invalidate or remove when the command succeeds.

### commandQuery

```ts
function commandQuery<TInput, TOutput>(command: (args: TInput) => Promise<TOutput>, name: string): Omit<QueryContract<TInput, TOutput>, 'kind'>;
```

A query contract over a command, for `queryFrom(commandQuery(commands.greet, 'greet'))`.

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

True inside a Tauri webview (`detectRuntime()` finds `window.__TAURI_INTERNALS__`), false in a browser.

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

The typed functions `defineCommands<C>()` returns: one per command, taking its argument object and resolving with its result.

## @kitr/tauri/provider

### tauriStoreDriver

```ts
function tauriStoreDriver(file?: string): StorageDriver;
```

`@tauri-apps/plugin-store` (`kitr.json` in the app data dir) as a kitr storage driver.

### tauriPluginLoaders

```ts
const tauriPluginLoaders: Record<string, ModuleLoader>;
```

The Tauri plugin packages the device drivers (`@kitr/secure-storage`, `@kitr/notifications`,
`@kitr/files`, `@kitr/updater`, `@kitr/native`) load by name. Each is a literal `import()` so the
app's bundler finds and bundles it; the provider registers them with `registerShellModules()`, so
the device packages never name an optional package in code a web build bundles. The Tauri
platform installs them all (`kitr add tauri`).

### tauriProvider

```ts
const tauriProvider: import("@kitr/core").KitrProvider;
```

Runtime provider of the Tauri platform. Inside a Tauri webview it registers the `platform`
driver on the Tauri APIs and a `storage` driver on the store plugin. In a plain browser it
does nothing, so the web build of the same app keeps working. The shared shell behaviour
(detection, registration, app state, devtools) is `createShellProvider()`.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
