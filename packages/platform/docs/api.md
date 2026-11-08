---
title: API reference
description: Every export of kitr/platform, with its signature.
order: 2
---

# API reference

Every export of `kitr/platform`, `kitr/platform/react`, `kitr/platform/provider`, `kitr/platform/devtools`, `kitr/platform/shell`, `kitr/platform/cli`, read from the published type definitions. The [guide](/packages/platform/guide) shows them in use.

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

### detectRuntime

```ts
function detectRuntime(scope?: RuntimeScope): Runtime;
```

Detect the runtime: Tauri by `window.__TAURI_INTERNALS__`, Capacitor by
`Capacitor.isNativePlatform()`, Electron by the preload bridge, `process.versions.electron` or an
`Electron/` user agent. Everything else, including the server, is `web`. Safe to call anywhere:
it only reads globals.

### driverUnavailable

```ts
function driverUnavailable(runtime: Exclude<Runtime, 'web'>, pkg: string, detail?: string): KitrError;
```

The error a device package throws when its driver for a native shell is not implemented (or
its plugin is not installed): it names the runtime and the package so the fix is obvious. Never
a silent fallback to the web driver; apps that want the WebView behaviour pass `fallbackToWeb`.

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

### isDriverUnavailable

```ts
function isDriverUnavailable(error: unknown): error is KitrError;
```

Whether `error` is a `driverUnavailable()` error.

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

### runtimeOf

```ts
function runtimeOf(app?: Pick<KitrApp, 'container'>): Runtime;
```

The runtime an app is in: the `platform` service's when it is registered (the platform packages
set it from their shell), else `detectRuntime()`. Device packages call this to pick a driver.

### selectRuntimeDriver

```ts
function selectRuntimeDriver<D>(runtime: Runtime, drivers: RuntimeDrivers<D>, options?: SelectDriverOptions): D;
```

Pick the driver for `runtime` from a table of factories. `web` calls its factory; a native
runtime calls its own, and when that throws `E_DRIVER_UNAVAILABLE` the error propagates unless
`fallbackToWeb` is set. Any other error propagates untouched.

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

### DRIVER_UNAVAILABLE

```ts
const DRIVER_UNAVAILABLE = "E_DRIVER_UNAVAILABLE";
```

The error code `driverUnavailable()` carries, for `error.code === DRIVER_UNAVAILABLE` checks.

### runtimes

```ts
const runtimes: readonly Runtime[];
```

Every runtime, in the order `detectRuntime()` checks the native ones after `web`.

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
  /**
   * The host runtime: `web`, `electron`, `tauri` or `capacitor`. Device packages
   * (`native`, `files`, `notifications`, `secure-storage`, `updater`) pick their driver by it.
   */
  readonly runtime: Runtime;
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
  /** The host runtime: `web`, `electron`, `tauri` or `capacitor`. Default: `web` for a browser driver, the detected runtime for a native one. */
  runtime?: Runtime;
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

### RuntimeScope

```ts
interface RuntimeScope {
  /** Tauri puts its internals on `window`. */
  __TAURI_INTERNALS__?: unknown;
  /** The bridge the Electron preload script exposes (`exposeIpc()`). */
  kitrIpc?: unknown;
  /** The Capacitor runtime global. */
  Capacitor?: {
    isNativePlatform?(): boolean;
  };
  /** Node's `process`, present in Electron's main process and in Node-integrated renderers. */
  process?: {
    versions?: {
      electron?: string;
    };
  };
  navigator?: {
    userAgent?: string;
  };
  /** When the scope is a worker or test global that holds a separate `window`, the checks look there first. */
  window?: RuntimeScope;
}
```

The globals `detectRuntime()` reads. Pass a fake in tests; the default is `globalThis`.

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

### SelectDriverOptions

```ts
interface SelectDriverOptions {
  /**
   * Use the web driver when the native shell has no driver of its own. Off by default: a native
   * shell without a driver throws `E_DRIVER_UNAVAILABLE` instead of silently running web code in a WebView.
   */
  fallbackToWeb?: boolean;
}
```

Options every device package's `selectDriver()` accepts.

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

### Runtime

```ts
type Runtime = 'web' | 'electron' | 'tauri' | 'capacitor';
```

Which host the code is running in, as one value: a browser (or the server) is `web`, and the
three native shells are `electron`, `tauri` and `capacitor`. It answers "which driver should I
load?", while `platform.type` answers "what kind of place is this?" (`desktop` covers both
Electron and Tauri).

### RuntimeDrivers

```ts
type RuntimeDrivers<D> = Record<Runtime, () => D>;
```

One driver factory per runtime. `web` always works; the others may throw `driverUnavailable()`.

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

### useRuntime

```ts
function useRuntime(): Runtime;
```

The host runtime: `web`, `electron`, `tauri` or `capacitor`. Use it to branch on the shell
itself; `usePlatform().type` says `desktop` for both Electron and Tauri. Without the platform
provider it falls back to `detectRuntime()`.

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

## kitr/platform/shell

### createShell

```ts
function createShell(options: ShellOptions): Shell;
```

Build the `Shell` helpers for a configuration.

### createShellDriver

```ts
function createShellDriver(options: ShellOptions, shell?: Shell): PlatformDriver;
```

The `platform` driver a shell registers: native, standalone, app state from visibility, plus the shell's own hooks.

### createShellProvider

```ts
function createShellProvider(options: ShellOptions): KitrProvider;
```

The runtime provider of a native shell. Inside the shell it registers the `platform` driver and
whatever `register()` adds; in a plain browser it does nothing, so the web build of the same app
keeps working. Logs the runtime to devtools at boot.

```ts
export const desktopProvider = createShellProvider({
  name: 'desktop', platform: 'desktop', type: 'desktop', runtime: 'electron',
  driver: (shell) => ({ exit: () => shell.invoke('kitr:app:quit').then(() => {}) }),
})
```

### userAgentOs

```ts
function userAgentOs(): PlatformOs;
```

The operating system from the user agent, `unknown` on the server.

### visibilityAppState

```ts
function visibilityAppState(listener: (active: boolean) => void): () => void;
```

The foreground/background default every shell shares: the page's visibility.

### Shell

```ts
interface Shell {
  /** The native runtime this provider wraps. */
  readonly runtime: ShellRuntime;
  /** The bridge, or undefined when the shell has none or the page is not inside it. */
  bridge(): ShellBridge | undefined;
  /** Call the bridge. Rejects with a message naming the provider when the bridge is missing. */
  invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>;
  /** The operating system the shell reports. */
  os(): PlatformOs | string;
  /** True when the page is running inside this shell. */
  active(): boolean;
}
```

What `createShellProvider()` hands to its hooks: the pieces every shell uses.

### ShellBridge

```ts
interface ShellBridge {
  /** Call the native side and resolve with its answer. */
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  /** Listen to a channel the native side sends on. Returns the unsubscribe function. */
  on?(channel: string, listener: (...args: unknown[]) => void): () => void;
  /** Send a one-way message, with no reply. */
  send?(channel: string, ...args: unknown[]): void;
}
```

The untyped message bridge a shell exposes to the page: Electron's preload `kitrIpc`, a Tauri command channel.

### ShellOptions

```ts
interface ShellOptions {
  /** The provider name, shown by `kitr doctor` and in errors: `desktop`, `tauri`, `mobile`. */
  name: string;
  /** The tag drivers are registered under (`app.drivers.describe()`, devtools): `desktop`, `mobile`. */
  platform: string;
  /** The `platform.type` the shell reports. */
  type: PlatformType;
  /** Which native runtime this is. */
  runtime: ShellRuntime;
  /** Whether the page is inside this shell. Default: `detectRuntime() === runtime`. */
  detect?(): boolean;
  /** Where the page finds the IPC bridge. Omit for shells that call native plugins directly. */
  bridge?(): ShellBridge | undefined;
  /** The operating system. Default: from the user agent. */
  os?(): PlatformOs | string;
  /** The shell's own `platform` driver hooks (app version, open link, exit, back button...). */
  driver?(shell: Shell): ShellDriverHooks;
  /** Register the shell's other drivers (storage, ...) once the page is known to be inside it. */
  register?(app: KitrApp, shell: Shell): void;
}
```

How a shell package configures `createShellProvider()`.

### ShellDriverHooks

```ts
type ShellDriverHooks = Partial<Omit<PlatformDriver, 'type' | 'native' | 'runtime' | 'os'>>;
```

The platform driver hooks a shell may implement; `type`, `native`, `runtime` and `os` are filled in by the provider.

### ShellRuntime

```ts
/** The native shells a provider can wrap. */
type ShellRuntime = Exclude<Runtime, 'web'>;
```

The native shells a provider can wrap.

## kitr/platform/cli

### displayName

```ts
function displayName(name?: string): string;
```

`@acme/field-notes` becomes `Field Notes`: the default window or home-screen title.

### hasCommand

```ts
function hasCommand(command: string): Promise<boolean>;
```

Whether `command --version` runs and exits 0: the check behind "the Rust toolchain is not on PATH".

### installCommand

```ts
function installCommand(ctx: PlatformContext, dependency: PlatformDependency): string;
```

Where a dependency is declared and how to install it, for the `kitr doctor` fix line.

### lanAddress

```ts
function lanAddress(): Promise<string>;
```

The machine's first non-internal IPv4 address, for a device on the network to reach the dev server; `0.0.0.0` when there is none.

### missingDependencies

```ts
function missingDependencies(ctx: PlatformContext, dependencies: PlatformDependency[], pkg?: Record<string, any>): PlatformFinding[];
```

One `error` finding per dependency the project's `package.json` does not list.

### readPackage

```ts
function readPackage(ctx: PlatformContext): Record<string, any>;
```

Read `package.json`, or `{}` when it is missing or invalid.

### shellPlatformHooks

```ts
function shellPlatformHooks<O extends ShellPlatformOptions, S = undefined>(options: O, cli: ShellCli<O, S>): PlatformHooks<O>;
```

The hooks of a shell platform, for the factory `definePlatform` takes:

```ts
definePlatform<MyOptions>(definition, (options) => shellPlatformHooks(options, { ... }))
```
`dev` starts Vite on `--port` (or the option), waits for it, then launches the shell; `build`
runs the client build and then the shell's own; `doctor` checks dependencies, files and tools.

### slug

```ts
function slug(name: string): string;
```

The lower-case alphanumeric form of a name, for bundle ids: `Field Notes` becomes `fieldnotes`.

### waitForPort

```ts
function waitForPort(host: string, port: number, signal?: AbortSignal): Promise<void>;
```

`waitForUrl` for a host and port; a wildcard bind address (`0.0.0.0`) is polled on loopback.

### waitForUrl

```ts
function waitForUrl(url: string, signal?: AbortSignal): Promise<void>;
```

Poll `url` until it answers (any response, even an error status) or `signal` aborts. Gives up after about 30 seconds.

### RequiredFile

```ts
interface RequiredFile {
  /** Path from the project root. */
  path: string;
  /** The `kitr doctor` fix line. Default: `kitr platforms scaffold <name>`. */
  fix?: string;
}
```

A file the shell needs: reported as `error` when missing, with the command that recreates it.

### RequiredTool

```ts
interface RequiredTool {
  /** The executable, checked with `<command> --version`. */
  command: string;
  /** The finding's message; `<name>:` is prepended. */
  message: string;
  /** The fix line. */
  fix?: string;
}
```

A command-line tool the shell builds with: `cargo` for Tauri.

### ShellBuild

```ts
interface ShellBuild<O extends object> {
  /** Build the shell around `dist/<name>/client` (installers, a synced native project). */
  shell(ctx: PlatformContext<O>): Promise<void>;
  /** Runs before the client build (generate icons, create native projects). */
  before?(ctx: PlatformContext<O>): void | Promise<void>;
}
```

What `kitr build <name>` runs after the client build.

### ShellCli

```ts
interface ShellCli<O extends ShellPlatformOptions, S = undefined> {
  /** npm dependencies `kitr add` installs; `kitr doctor` checks them too. */
  dependencies: PlatformDependency[];
  /** Write the shell's files. */
  scaffold(ctx: PlatformContext<O>): void;
  /** `kitr dev <name>`. */
  dev: ShellDev<O, S>;
  /** `kitr build <name>`. */
  build: ShellBuild<O>;
  /** `kitr start <name>`. Omit when the shell has nothing to start (the mobile app runs on a device). */
  start?(ctx: PlatformContext<O>): Promise<void>;
  /** `kitr doctor`. */
  doctor?: ShellDoctor<O>;
  /** Lines for the platform's `AGENTS.md` section. */
  agents: string;
}
```

How a shell package parameterises the platform CLI skeleton.

### ShellDev

```ts
interface ShellDev<O extends object, S = undefined> {
  /** Runs before the dev server starts (create the native project, pick a target); its result goes to the other hooks. */
  prepare?(ctx: PlatformContext<O>): S | Promise<S>;
  /** The address Vite binds to. Default: Vite's own (localhost). The mobile shell passes the LAN address. */
  host?(ctx: PlatformContext<O>): string | undefined | Promise<string | undefined>;
  /** The line logged once the server's address is known. */
  banner(ctx: PlatformContext<O>, dev: ShellDevInfo<S>): string;
  /** Runs while Vite starts, before waiting for it (generate icons). */
  ready?(ctx: PlatformContext<O>, dev: ShellDevInfo<S>): void | Promise<void>;
  /** Start the shell against the dev server. Errors are logged, and the dev server keeps running until it exits. */
  launch(ctx: PlatformContext<O>, dev: ShellDevInfo<S>): Promise<void>;
}
```

What `kitr dev <name>` runs: the Vite dev server and then the shell on top of it.

### ShellDevInfo

```ts
interface ShellDevInfo<S = undefined> {
  /** The port, from `--port` or the platform option. */
  port: number;
  /** The bind address, when `host()` gave one. */
  host: string | undefined;
  /** `http://<host or localhost>:<port>`. */
  url: string;
  /** What `prepare()` returned. */
  state: S;
}
```

What the `dev` hooks know about the running dev server.

### ShellDoctor

```ts
interface ShellDoctor<O extends object> {
  /** Dependencies that must be in `package.json`. Default: the platform's `dependencies`. */
  dependencies?: PlatformDependency[];
  /** Files that must exist, relative to the project root. */
  files?(ctx: PlatformContext<O>): RequiredFile[];
  /** Tools that must be on `PATH`. */
  tools?: RequiredTool[];
  /** Checks of your own (a `main` field, a registered URL scheme). Appended last. */
  extra?(ctx: PlatformContext<O>, pkg: Record<string, any>): PlatformFinding[];
}
```

What `kitr doctor` checks for a shell platform.

### ShellPlatformOptions

```ts
/** The options every shell platform has. */
interface ShellPlatformOptions {
  /** Dev server port the shell loads from with `kitr dev <name>`. */
  port: number;
}
```

The options every shell platform has.

<!-- GENERATED by scripts/api-docs.mjs from the type definitions. Do not edit. -->
