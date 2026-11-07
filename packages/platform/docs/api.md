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

### Platform

```ts
interface Platform {
  readonly type: PlatformType;
  readonly native: boolean;
  readonly os: PlatformOs | string;
  readonly standalone: boolean;
  /** The platform name from kitrrc.ts the bundle was built for, when known. */
  readonly name: string | undefined;
  readonly driver: PlatformDriver;
  isOnline(): boolean;
  appVersion(): Promise<string>;
  onAppState(listener: (active: boolean) => void): () => void;
  onBackButton(listener: (info: {
    canGoBack: boolean;
  }) => void): () => void;
  onDeepLink(listener: (url: string) => void): () => void;
  onOnline(listener: (online: boolean) => void): () => void;
  safeArea(): SafeArea;
  openExternal(url: string): Promise<void>;
  exit(): Promise<void>;
  /** `platform.is('mobile')`, `platform.is('ios')`: matches the type or the OS. */
  is(what: PlatformType | PlatformOs): boolean;
}
```

The `platform` service: the active driver plus safe defaults for everything it leaves out.

### PlatformConfig

```ts
interface PlatformConfig {
  /** Route deep links by stripping this prefix (`myapp://` or `https://app.example.com`) before navigating. */
  deepLinkPrefixes?: string[];
}
```

### PlatformDriver

```ts
interface PlatformDriver {
  /** `web`, `mobile`, `desktop`, `server` or a custom platform type. */
  type: PlatformType;
  /** True inside a native shell (Capacitor, Tauri, Electron). */
  native: boolean;
  os(): PlatformOs | string;
  /** Installed as an app (PWA standalone, native shell). */
  standalone?(): boolean;
  appVersion?(): Promise<string>;
  /** Foreground/background. */
  onAppState?(listener: (active: boolean) => void): () => void;
  /** Hardware or window back button. */
  onBackButton?(listener: (info: {
    canGoBack: boolean;
  }) => void): () => void;
  /** Deep links and custom-scheme URLs opened while the app runs. */
  onDeepLink?(listener: (url: string) => void): () => void;
  onOnline?(listener: (online: boolean) => void): () => void;
  isOnline?(): boolean;
  safeArea?(): SafeArea;
  /** Open a URL in the system browser (native) or a new tab (web). */
  openExternal?(url: string): Promise<void>;
  /** Exit the app where the platform allows it (Android back at root, desktop). */
  exit?(): Promise<void>;
}
```

### SafeArea

```ts
interface SafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
```

### PlatformOs

```ts
type PlatformOs = 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'server' | 'unknown';
```

### PlatformType

```ts
type PlatformType = 'web' | 'mobile' | 'desktop' | 'server' | (string & {});
```

Where the app runs, as one API. Platform packages register a `PlatformDriver`;
the `platform` service wraps whichever is active, with a browser/server default.

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
function useDeepLink(handler: (url: string) => void): void;
```

Deep links opened while the app runs. Pair with `deepLinkPath()` to hand them to the router.

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
