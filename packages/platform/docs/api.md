---
title: API
description: Every export of kitr/platform, with its signature.
order: 2
---

# API

Every export of `kitr/platform`, `kitr/platform/react`, `kitr/platform/provider`, `kitr/platform/devtools`, read from the published type definitions. The [guide](/packages/platform) shows them in use.

## kitr/platform

### createPlatform

```ts
function createPlatform(app: KitrApp, driver?: PlatformDriver): Platform;
```

Build the `platform` service from a driver (default: the registered one, else the browser/server default). The provider binds it for you.

### deepLinkPath

```ts
function deepLinkPath(url: string, prefixes?: string[]): string;
```

Strip a configured prefix from a deep link so it can be handed to the router.

### defaultDriver

```ts
function defaultDriver(): PlatformDriver;
```

The browser (or server) driver used when no platform package registered one.

### osFromUserAgent

```ts
function osFromUserAgent(ua: string): PlatformOs;
```

Map a user agent string to a `PlatformOs`; iPhone and iPad user agents are checked before macOS.

### perPlatform

```ts
function perPlatform<T>(platform: Pick<Platform, 'type' | 'os' | 'native'>, impls: Partial<Record<PlatformType | PlatformOs | 'native', () => T>> & {
  default: () => T;
}): T;
```

Pick an implementation per platform without branching in components:
```ts
const save = perPlatform(platform, { web: () => download, mobile: () => share, desktop: () => saveDialog })
```
Keys are platform types or OS names; `native` covers every native shell; `default` is required.

### defineConfig

```ts
const defineConfig: <const C extends PlatformConfig>(config: C) => C;
```

Typed helper for `config/platform.ts`.

### Platform

```ts
interface Platform {
  /** The active driver's platform type. */
  readonly type: PlatformType;
  /** True inside a native shell (Capacitor, Tauri, Electron). */
  readonly native: boolean;
  /** The operating system, read from the driver on every access. */
  readonly os: PlatformOs | string;
  /** Installed as an app: a standalone PWA or any native shell. */
  readonly standalone: boolean;
  /** The platform name from kitrrc.ts the bundle was built for, when known. */
  readonly name: string | undefined;
  /** The active driver, for anything the service does not wrap. */
  readonly driver: PlatformDriver;
  /** Whether the device reports a connection. */
  isOnline(): boolean;
  /** The native app version, or `'0.0.0'` where there is none. */
  appVersion(): Promise<string>;
  /** Foreground (`true`) and background (`false`) changes. Returns an unsubscribe function. */
  onAppState(listener: (active: boolean) => void): () => void;
  /** Hardware or window back button. Never fires where the driver has none. Returns an unsubscribe function. */
  onBackButton(listener: (info: {
    canGoBack: boolean;
  }) => void): () => void;
  /** URLs the OS opens in the running app. Returns an unsubscribe function. */
  onDeepLink(listener: (url: string) => void): () => void;
  /** The router path for a deep link: `deepLinkPath(url, deepLinkPrefixes)` with the prefixes from `config/platform.ts`. */
  linkPath(url: string): string;
  /** Connection changes. Returns an unsubscribe function. */
  onOnline(listener: (online: boolean) => void): () => void;
  /** Safe-area insets in pixels. */
  safeArea(): SafeArea;
  /** Open a URL in the system browser (native) or a new tab (web). */
  openExternal(url: string): Promise<void>;
  /** Close the app where the driver supports it; resolves and does nothing elsewhere. */
  exit(): Promise<void>;
  /** `platform.is('mobile')`, `platform.is('ios')`: matches the type or the OS. */
  is(what: PlatformType | PlatformOs): boolean;
}
```

The `platform` service: the active driver plus safe defaults for everything it leaves out.

### PlatformConfig

```ts
interface PlatformConfig {
  /** Path prefixes (`'/open'`) to strip from deep links in `platform.linkPath()` and `useDeepLink()`. The scheme and host are always dropped. */
  deepLinkPrefixes?: string[];
}
```

The options in `config/platform.ts`.

### PlatformDriver

```ts
interface PlatformDriver {
  /** `web`, `mobile`, `desktop`, `server` or a custom platform type. */
  type: PlatformType;
  /** True inside a native shell (Capacitor, Tauri, Electron). */
  native: boolean;
  /** The operating system, read on every access. */
  os(): PlatformOs | string;
  /** Installed as an app (PWA standalone, native shell). */
  standalone?(): boolean;
  /** The native app version. Default `'0.0.0'`. */
  appVersion?(): Promise<string>;
  /** Foreground/background. */
  onAppState?(listener: (active: boolean) => void): () => void;
  /** Hardware or window back button. */
  onBackButton?(listener: (info: {
    canGoBack: boolean;
  }) => void): () => void;
  /** Deep links and custom-scheme URLs opened while the app runs. */
  onDeepLink?(listener: (url: string) => void): () => void;
  /** Connection changes. Default: the browser's `online` and `offline` events. */
  onOnline?(listener: (online: boolean) => void): () => void;
  /** Whether the device has a connection. Default: `navigator.onLine`. */
  isOnline?(): boolean;
  /** Safe-area insets. Default: the CSS `env(safe-area-inset-*)` values. */
  safeArea?(): SafeArea;
  /** Open a URL in the system browser (native) or a new tab (web). */
  openExternal?(url: string): Promise<void>;
  /** Exit the app where the platform allows it (Android back at root, desktop). */
  exit?(): Promise<void>;
}
```

What a platform package implements so `kitr/platform` can answer for it. Register one with
`app.drivers.register('platform', driver)`; every optional member falls back to a browser default.

### SafeArea

```ts
interface SafeArea {
  /** Inset from the top edge (status bar, notch). */
  top: number;
  /** Inset from the right edge (notch in landscape). */
  right: number;
  /** Inset from the bottom edge (home indicator). */
  bottom: number;
  /** Inset from the left edge (notch in landscape). */
  left: number;
}
```

Safe-area insets in CSS pixels: the space the notch, status bar and home indicator cover.

### PlatformOs

```ts
type PlatformOs = 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'server' | 'unknown';
```

The operating system a driver reports; `server` during server rendering, `unknown` when the user agent matches none.

### PlatformType

```ts
/** The kind of place the app runs: `web`, `mobile`, `desktop`, `server`, or a custom platform's own type. */
type PlatformType = 'web' | 'mobile' | 'desktop' | 'server' | (string & {});
```

The kind of place the app runs: `web`, `mobile`, `desktop`, `server`, or a custom platform's own type.

## kitr/platform/react

### useAppState

```ts
function useAppState(): boolean;
```

Foreground (`true`) or background. Backed by Capacitor App on mobile, window focus on desktop, visibility on the web.

### useBackButton

```ts
function useBackButton(handler: (info: {
  canGoBack: boolean;
}) => void): void;
```

Android hardware back button, desktop window close. Return nothing to let the default run.

### useDeepLink

```ts
function useDeepLink(handler: (url: string, path: string) => void): void;
```

Deep links opened while the app runs. The handler gets the URL and the router path for it, with
the scheme, host and `deepLinkPrefixes` from `config/platform.ts` removed:

```ts
useDeepLink(useCallback((_url, path) => void navigate({ to: path }), [navigate]))
```

### useOnline

```ts
function useOnline(): boolean;
```

`true` while the device reports a connection. Hydration-safe: the server and first render say online.

### usePlatform

```ts
function usePlatform(): Platform;
```

The `platform` service from the container.

### useSafeArea

```ts
function useSafeArea(): SafeArea;
```

Safe-area insets (notch, home indicator). Zero on the server and first render.

## kitr/platform/provider

### platformProvider

```ts
const platformProvider: import("@kitr/core").KitrProvider;
```

Binds the `platform` service from the active platform driver. Platform packages
(`kitr/mobile/provider`, `kitr/desktop/provider`...) register their driver in `register()`,
so list them before this provider in kitrrc.ts; `kitr add` keeps that order.

## kitr/platform/devtools

### panels

```ts
function panels(app: KitrApp): DevtoolsPanel[];
```

The Platform panel: active platform, OS and which package supplies each capability driver.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
