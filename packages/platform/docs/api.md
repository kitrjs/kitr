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

### fallbackFormFactor

```ts
function fallbackFormFactor(platform: Pick<Platform, 'type'>, options?: FormFactorOptions): FormFactor;
```

The form factor assumed before the window can be measured: a desktop shell is wide with a pointer, everything else is a phone.

### forPlatform

```ts
function forPlatform<T>(table: Partial<Record<PlatformKey, T>> & {
  default: T;
}): T;
```

Resolve a per-platform table at build time, from `import.meta.env.KITR_PLATFORM` and
`KITR_PLATFORM_TYPE`, so the choice costs nothing at run time and needs no app instance:

```ts
export const Route = createFileRoute('/feed')({ ...forPlatform({ www: { ssr: true }, default: { ssr: false } }) })
```
The platform name wins over its type, then `default`. Outside a kitr build the table's `default` is returned.

### osFromUserAgent

```ts
function osFromUserAgent(ua: string): PlatformOs;
```

Map a user agent string to a `PlatformOs`; iPhone and iPad user agents are checked before macOS.

### perPlatform

```ts
function perPlatform<T>(platform: Pick<Platform, 'type' | 'os' | 'native'> & {
  name?: PlatformName | undefined;
}, impls: Partial<Record<PlatformKey, () => T>> & {
  default: () => T;
}): T;
```

Pick an implementation per platform without branching in components:
```ts
const save = perPlatform(platform, { web: () => download, mobile: () => share, desktop: () => saveDialog })
```
Keys are platform names from kitrrc.ts, platform types or OS names; `native` covers every native
shell; `default` is required. The most specific wins: name, then OS, then type, then `native`.

### platformName

```ts
function platformName(): PlatformName | undefined;
```

The platform name this bundle was built for, as a build-time constant: `kitr dev phone` defines
`import.meta.env.KITR_PLATFORM` as `'phone'`, and `kitr types` types it as the union of the names in
kitrrc.ts. Compare it directly (`if (platformName() === 'phone')`) and the bundler drops the other
branch, which is how a page or a feature stays out of a platform's bundle entirely. Undefined
outside a kitr build (tests, plain Node).

### platformType

```ts
function platformType(): PlatformTypeName | undefined;
```

The type (`web`, `mobile`, `desktop`...) of the platform this bundle was built for, from `import.meta.env.KITR_PLATFORM_TYPE`.

### readFormFactor

```ts
function readFormFactor(win: Pick<Window, 'innerWidth' | 'innerHeight' | 'matchMedia'>, options?: FormFactorOptions): FormFactor;
```

The form factor a browser window reports right now. Not for the server: use `fallbackFormFactor()` there.

### widthClass

```ts
function widthClass(width: number, breakpoints?: FormFactorOptions['breakpoints']): WidthClass;
```

Classify a width in CSS pixels.

### defaultBreakpoints

```ts
const defaultBreakpoints: {
  readonly medium: 768;
  readonly expanded: 1024;
};
```

Where `medium` and `expanded` start, in CSS pixels, when `formFactor.breakpoints` is not configured.

### defineConfig

```ts
const defineConfig: <const C extends PlatformConfig>(config: C) => C;
```

Typed helper for `config/platform.ts`.

### FormFactor

```ts
interface FormFactor {
  width: WidthClass;
  input: InputKind;
  orientation: Orientation;
  /** False on the server and during the first client render, when the values are the configured fallback. */
  ready: boolean;
}
```

What `useFormFactor()` answers: the three axes a responsive multi-platform app branches on,
kept apart on purpose. Layout follows `width`, affordances (hover, hit sizes) follow `input`,
idioms follow the platform itself (`usePlatform()`).

### FormFactorOptions

```ts
interface FormFactorOptions {
  /** Minimum widths in CSS pixels. Default `{ medium: 768, expanded: 1024 }`. */
  breakpoints?: {
    medium?: number;
    expanded?: number;
  };
  /**
   * What the server and the first client render assume. Default: `expanded` + `pointer` in a desktop
   * shell, `compact` + `touch` everywhere else (which is what a phone, the most common SSR visitor, is).
   */
  fallback?: Partial<Pick<FormFactor, 'width' | 'input' | 'orientation'>>;
}
```

Options of `useFormFactor()` and of `formFactor` in `config/platform.ts`.

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
  /**
   * The platform name from kitrrc.ts the bundle was built for, when known. After `kitr types`
   * it is the union of the names in `kitrrc.ts` (`'site' | 'phone'`), so `platform.name === 'tablet'`
   * is a compile error in a project with no such platform.
   */
  readonly name: PlatformName | undefined;
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
  /** `platform.is('mobile')`, `platform.is('ios')`, `platform.is('phone')`: matches the type, the OS or the platform name from kitrrc.ts. */
  is(what: PlatformType | PlatformOs | PlatformName): boolean;
}
```

The `platform` service: the active driver plus safe defaults for everything it leaves out.

### PlatformConfig

```ts
interface PlatformConfig {
  /** Path prefixes (`'/open'`) to strip from deep links in `platform.linkPath()` and `useDeepLink()`. The scheme and host are always dropped. */
  deepLinkPrefixes?: string[];
  /** Width classes and the first-render guess for `useFormFactor()`. */
  formFactor?: FormFactorOptions;
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

### InputKind

```ts
type InputKind = 'touch' | 'pointer';
```

The primary input: a finger or a mouse/trackpad.

### Orientation

```ts
type Orientation = 'portrait' | 'landscape';
```

Which way the viewport is taller or wider.

### PlatformKey

```ts
type PlatformKey = PlatformName | PlatformType | PlatformOs | 'native';
```

Keys `perPlatform()` and `forPlatform()` accept: a platform name from kitrrc.ts, a type, an OS, `native`, or `default`.

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

### WidthClass

```ts
type WidthClass = 'compact' | 'medium' | 'expanded';
```

The width class of the viewport: a phone, a small tablet or a large window.

## kitr/platform/react

### Except

```ts
function Except({ children, fallback, ...match }: OnlyProps): import("react").JSX.Element;
```

The inverse of `<Only>`: render children everywhere the match fails.

### Only

```ts
function Only({ children, fallback, ...match }: OnlyProps): import("react").JSX.Element;
```

Render children only on the platforms, OS, shells or form factors given:

```ts
<Only platform="phone"><TabBar /></Only>
<Only width="expanded" input="pointer" fallback={<MobileNav />}><SideRail /></Only>
```
`platform` is typed against the names in kitrrc.ts once `kitr types` has run. Width, input and
orientation come from `useFormFactor()`, so they are hydration-safe: the first render uses the
configured fallback. This hides at run time; to keep code out of a platform's bundle, branch on
`platformName()` or `import.meta.env.KITR_PLATFORM` instead.

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

### useFormFactor

```ts
function useFormFactor(options?: FormFactorOptions): FormFactor;
```

The viewport's form factor: width class (`compact` under 768px, `medium`, `expanded` from 1024px),
primary input (`touch` or `pointer`) and orientation. Hydration-safe: the server and the first
client render return the configured fallback with `ready: false`, then the real values arrive
after mount and follow window resizes and orientation changes.

Layout decisions belong to `width`, affordances to `input`, platform idioms to `usePlatform()`:

```ts
const { width } = useFormFactor()
return width === 'expanded' ? <SplitView /> : <Stack />
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

### usePlatformMatch

```ts
function usePlatformMatch(match: PlatformMatch): boolean;
```

Whether the current platform and form factor satisfy a `PlatformMatch`. The hook behind `<Only>` and `<Except>`.

### useSafeArea

```ts
function useSafeArea(): SafeArea;
```

Safe-area insets (notch, home indicator). Zero on the server and first render.

### OnlyProps

```ts
interface OnlyProps extends PlatformMatch {
  children?: ReactNode;
  /** Rendered when the match fails. Default: nothing. */
  fallback?: ReactNode;
}
```

Props of `<Only>` and `<Except>`: the platform match plus `children` and `fallback`.

### PlatformMatch

```ts
interface PlatformMatch {
  /** A platform name from kitrrc.ts: `'phone'`, or `['phone', 'tablet']`. Typed after `kitr types`. */
  platform?: OneOrMany<PlatformName>;
  /** The platform type the active driver reports: `'mobile'`, `'desktop'`, `'web'`, `'server'`. */
  type?: OneOrMany<PlatformType>;
  /** The operating system: `'ios'`, `'android'`, `'macos'`... */
  os?: OneOrMany<PlatformOs | (string & {})>;
  /** `true` inside a native shell (Capacitor, Electron, Tauri), `false` in a plain browser. */
  native?: boolean;
  /** The viewport width class from `useFormFactor()`. */
  width?: OneOrMany<WidthClass>;
  /** The primary input from `useFormFactor()`. */
  input?: OneOrMany<InputKind>;
  /** The orientation from `useFormFactor()`. */
  orientation?: OneOrMany<Orientation>;
}
```

What `<Only>` and `<Except>` match on. Every prop is optional and all given props must match
(a logical AND). An array matches any of its values.

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
