import {
  createDefineConfig,
  type KitrApp,
  type PlatformName,
  type PlatformTypeName,
} from '@kitr/core'

/**
 * Where the app runs, as one API. Platform packages register a `PlatformDriver`;
 * the `platform` service wraps whichever is active, with a browser/server default.
 */

/** The kind of place the app runs: `web`, `mobile`, `desktop`, `server`, or a custom platform's own type. */
export type PlatformType = 'web' | 'mobile' | 'desktop' | 'server' | (string & {})
/** The operating system a driver reports; `server` during server rendering, `unknown` when the user agent matches none. */
export type PlatformOs = 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'server' | 'unknown'

/** Safe-area insets in CSS pixels: the space the notch, status bar and home indicator cover. */
export interface SafeArea {
  /** Inset from the top edge (status bar, notch). */
  top: number
  /** Inset from the right edge (notch in landscape). */
  right: number
  /** Inset from the bottom edge (home indicator). */
  bottom: number
  /** Inset from the left edge (notch in landscape). */
  left: number
}

/**
 * What a platform package implements so `@kitr/platform` can answer for it. Register one with
 * `app.drivers.register('platform', driver)`; every optional member falls back to a browser default.
 */
export interface PlatformDriver {
  /** `web`, `mobile`, `desktop`, `server` or a custom platform type. */
  type: PlatformType
  /** True inside a native shell (Capacitor, Tauri, Electron). */
  native: boolean
  /** The operating system, read on every access. */
  os(): PlatformOs | string
  /** Installed as an app (PWA standalone, native shell). */
  standalone?(): boolean
  /** The native app version. Default `'0.0.0'`. */
  appVersion?(): Promise<string>
  /** Foreground/background. */
  onAppState?(listener: (active: boolean) => void): () => void
  /** Hardware or window back button. */
  onBackButton?(listener: (info: { canGoBack: boolean }) => void): () => void
  /** Deep links and custom-scheme URLs opened while the app runs. */
  onDeepLink?(listener: (url: string) => void): () => void
  /** Connection changes. Default: the browser's `online` and `offline` events. */
  onOnline?(listener: (online: boolean) => void): () => void
  /** Whether the device has a connection. Default: `navigator.onLine`. */
  isOnline?(): boolean
  /** Safe-area insets. Default: the CSS `env(safe-area-inset-*)` values. */
  safeArea?(): SafeArea
  /** Open a URL in the system browser (native) or a new tab (web). */
  openExternal?(url: string): Promise<void>
  /** Exit the app where the platform allows it (Android back at root, desktop). */
  exit?(): Promise<void>
}

declare module '@kitr/core' {
  interface DriverTypes {
    platform: PlatformDriver
  }
  interface ContainerBindings {
    platform: Platform
  }
  interface ConfigRegistry {
    platform: PlatformConfig
  }
}

/** The options in `config/platform.ts`. */
export interface PlatformConfig {
  /** Path prefixes (`'/open'`) to strip from deep links in `platform.linkPath()` and `useDeepLink()`. The scheme and host are always dropped. */
  deepLinkPrefixes?: string[]
  /** Width classes and the first-render guess for `useFormFactor()`. */
  formFactor?: FormFactorOptions
}

/** The width class of the viewport: a phone, a small tablet or a large window. */
export type WidthClass = 'compact' | 'medium' | 'expanded'
/** The primary input: a finger or a mouse/trackpad. */
export type InputKind = 'touch' | 'pointer'
/** Which way the viewport is taller or wider. */
export type Orientation = 'portrait' | 'landscape'

/**
 * What `useFormFactor()` answers: the three axes a responsive multi-platform app branches on,
 * kept apart on purpose. Layout follows `width`, affordances (hover, hit sizes) follow `input`,
 * idioms follow the platform itself (`usePlatform()`).
 */
export interface FormFactor {
  width: WidthClass
  input: InputKind
  orientation: Orientation
  /** False on the server and during the first client render, when the values are the configured fallback. */
  ready: boolean
}

/** Options of `useFormFactor()` and of `formFactor` in `config/platform.ts`. */
export interface FormFactorOptions {
  /** Minimum widths in CSS pixels. Default `{ medium: 768, expanded: 1024 }`. */
  breakpoints?: { medium?: number; expanded?: number }
  /**
   * What the server and the first client render assume. Default: `expanded` + `pointer` in a desktop
   * shell, `compact` + `touch` everywhere else (which is what a phone, the most common SSR visitor, is).
   */
  fallback?: Partial<Pick<FormFactor, 'width' | 'input' | 'orientation'>>
}

/** Where `medium` and `expanded` start, in CSS pixels, when `formFactor.breakpoints` is not configured. */
export const defaultBreakpoints = { medium: 768, expanded: 1024 } as const

/** Classify a width in CSS pixels. */
export function widthClass(
  width: number,
  breakpoints: FormFactorOptions['breakpoints'] = {},
): WidthClass {
  const medium = breakpoints.medium ?? defaultBreakpoints.medium
  const expanded = breakpoints.expanded ?? defaultBreakpoints.expanded
  if (width >= expanded) return 'expanded'
  if (width >= medium) return 'medium'
  return 'compact'
}

/** The form factor a browser window reports right now. Not for the server: use `fallbackFormFactor()` there. */
export function readFormFactor(
  win: Pick<Window, 'innerWidth' | 'innerHeight' | 'matchMedia'>,
  options: FormFactorOptions = {},
): FormFactor {
  const coarse = win.matchMedia?.('(pointer: coarse)').matches ?? false
  const hover = win.matchMedia?.('(hover: hover)').matches ?? true
  return {
    width: widthClass(win.innerWidth, options.breakpoints),
    // A touch screen with a hover-capable pointer attached (a laptop with a touch screen) counts as pointer.
    input: coarse && !hover ? 'touch' : 'pointer',
    orientation: win.innerHeight > win.innerWidth ? 'portrait' : 'landscape',
    ready: true,
  }
}

/** The form factor assumed before the window can be measured: a desktop shell is wide with a pointer, everything else is a phone. */
export function fallbackFormFactor(
  platform: Pick<Platform, 'type'>,
  options: FormFactorOptions = {},
): FormFactor {
  const desktop = platform.type === 'desktop' || platform.type === 'tauri'
  return {
    width: desktop ? 'expanded' : 'compact',
    input: desktop ? 'pointer' : 'touch',
    orientation: desktop ? 'landscape' : 'portrait',
    ...options.fallback,
    ready: false,
  }
}

/** Typed helper for `config/platform.ts`. */
export const defineConfig = createDefineConfig<PlatformConfig>()

/** The `platform` service: the active driver plus safe defaults for everything it leaves out. */
export interface Platform {
  /** The active driver's platform type. */
  readonly type: PlatformType
  /** True inside a native shell (Capacitor, Tauri, Electron). */
  readonly native: boolean
  /** The operating system, read from the driver on every access. */
  readonly os: PlatformOs | string
  /** Installed as an app: a standalone PWA or any native shell. */
  readonly standalone: boolean
  /**
   * The platform name from kitrrc.ts the bundle was built for, when known. After `kitr types`
   * it is the union of the names in `kitrrc.ts` (`'site' | 'phone'`), so `platform.name === 'tablet'`
   * is a compile error in a project with no such platform.
   */
  readonly name: PlatformName | undefined
  /** The active driver, for anything the service does not wrap. */
  readonly driver: PlatformDriver
  /** Whether the device reports a connection. */
  isOnline(): boolean
  /** The native app version, or `'0.0.0'` where there is none. */
  appVersion(): Promise<string>
  /** Foreground (`true`) and background (`false`) changes. Returns an unsubscribe function. */
  onAppState(listener: (active: boolean) => void): () => void
  /** Hardware or window back button. Never fires where the driver has none. Returns an unsubscribe function. */
  onBackButton(listener: (info: { canGoBack: boolean }) => void): () => void
  /** URLs the OS opens in the running app. Returns an unsubscribe function. */
  onDeepLink(listener: (url: string) => void): () => void
  /** The router path for a deep link: `deepLinkPath(url, deepLinkPrefixes)` with the prefixes from `config/platform.ts`. */
  linkPath(url: string): string
  /** Connection changes. Returns an unsubscribe function. */
  onOnline(listener: (online: boolean) => void): () => void
  /** Safe-area insets in pixels. */
  safeArea(): SafeArea
  /** Open a URL in the system browser (native) or a new tab (web). */
  openExternal(url: string): Promise<void>
  /** Close the app where the driver supports it; resolves and does nothing elsewhere. */
  exit(): Promise<void>
  /** `platform.is('mobile')`, `platform.is('ios')`, `platform.is('phone')`: matches the type, the OS or the platform name from kitrrc.ts. */
  is(what: PlatformType | PlatformOs | PlatformName): boolean
}

const noop = () => () => {}

/** The browser (or server) driver used when no platform package registered one. */
export function defaultDriver(): PlatformDriver {
  const hasWindow = typeof window !== 'undefined'
  return {
    type: hasWindow ? 'web' : 'server',
    native: false,
    os: () => (hasWindow ? osFromUserAgent(navigator.userAgent) : 'server'),
    standalone: () =>
      hasWindow &&
      (window.matchMedia?.('(display-mode: standalone)').matches ||
        (navigator as { standalone?: boolean }).standalone === true),
    isOnline: () => (hasWindow ? navigator.onLine : true),
    onOnline: (listener) => {
      if (!hasWindow) return () => {}
      const on = () => listener(true)
      const off = () => listener(false)
      window.addEventListener('online', on)
      window.addEventListener('offline', off)
      return () => {
        window.removeEventListener('online', on)
        window.removeEventListener('offline', off)
      }
    },
    onAppState: (listener) => {
      if (!hasWindow) return () => {}
      const handler = () => listener(document.visibilityState === 'visible')
      document.addEventListener('visibilitychange', handler)
      return () => document.removeEventListener('visibilitychange', handler)
    },
    safeArea: () => (hasWindow ? cssSafeArea() : { top: 0, right: 0, bottom: 0, left: 0 }),
    openExternal: async (url) => {
      if (hasWindow) window.open(url, '_blank', 'noopener')
    },
  }
}

/** Build the `platform` service from a driver (default: the registered one, else the browser/server default). The provider binds it for you. */
export function createPlatform(
  app: KitrApp,
  driver = app.drivers.resolve('platform') ?? defaultDriver(),
): Platform {
  const fallback = defaultDriver()
  const platform: Platform = {
    driver,
    name: app.platform,
    get type() {
      return driver.type
    },
    get native() {
      return driver.native
    },
    get os() {
      return driver.os()
    },
    get standalone() {
      return driver.standalone?.() ?? driver.native
    },
    isOnline: () => driver.isOnline?.() ?? fallback.isOnline!(),
    appVersion: () => driver.appVersion?.() ?? Promise.resolve('0.0.0'),
    onAppState: (l) => (driver.onAppState ?? fallback.onAppState ?? noop)(l),
    onBackButton: (l) => (driver.onBackButton ?? noop)(l),
    onDeepLink: (l) => (driver.onDeepLink ?? noop)(l),
    linkPath: (url) =>
      deepLinkPath(
        url,
        app.config.has('platform') ? (app.config.get('platform').deepLinkPrefixes ?? []) : [],
      ),
    onOnline: (l) => (driver.onOnline ?? fallback.onOnline ?? noop)(l),
    safeArea: () => driver.safeArea?.() ?? fallback.safeArea!(),
    openExternal: (url) => (driver.openExternal ?? fallback.openExternal!)(url),
    exit: () => driver.exit?.() ?? Promise.resolve(),
    is: (what) => driver.type === what || driver.os() === what || platform.name === what,
  }
  return platform
}

/**
 * The platform name this bundle was built for, as a build-time constant: `kitr dev phone` defines
 * `import.meta.env.KITR_PLATFORM` as `'phone'`, and `kitr types` types it as the union of the names in
 * kitrrc.ts. Compare it directly (`if (platformName() === 'phone')`) and the bundler drops the other
 * branch, which is how a page or a feature stays out of a platform's bundle entirely. Undefined
 * outside a kitr build (tests, plain Node).
 */
export function platformName(): PlatformName | undefined {
  const meta = (import.meta as unknown as { env?: { KITR_PLATFORM?: string } }).env
  const name = meta?.KITR_PLATFORM
  return (name || undefined) as PlatformName | undefined
}

/** The type (`web`, `mobile`, `desktop`...) of the platform this bundle was built for, from `import.meta.env.KITR_PLATFORM_TYPE`. */
export function platformType(): PlatformTypeName | undefined {
  const meta = (import.meta as unknown as { env?: { KITR_PLATFORM_TYPE?: string } }).env
  const type = meta?.KITR_PLATFORM_TYPE
  return (type || undefined) as PlatformTypeName | undefined
}

/** Keys `perPlatform()` and `forPlatform()` accept: a platform name from kitrrc.ts, a type, an OS, `native`, or `default`. */
export type PlatformKey = PlatformName | PlatformType | PlatformOs | 'native'

/**
 * Resolve a per-platform table at build time, from `import.meta.env.KITR_PLATFORM` and
 * `KITR_PLATFORM_TYPE`, so the choice costs nothing at run time and needs no app instance:
 *
 *   export const Route = createFileRoute('/feed')({ ...forPlatform({ www: { ssr: true }, default: { ssr: false } }) })
 *
 * The platform name wins over its type, then `default`. Outside a kitr build the table's `default` is returned.
 */
export function forPlatform<T>(table: Partial<Record<PlatformKey, T>> & { default: T }): T {
  const name = platformName()
  if (name !== undefined && name in table) return (table as Record<string, T>)[name] as T
  const type = platformType()
  if (type !== undefined && type in table) return (table as Record<string, T>)[type] as T
  return table.default
}

/**
 * Pick an implementation per platform without branching in components:
 *   const save = perPlatform(platform, { web: () => download, mobile: () => share, desktop: () => saveDialog })
 * Keys are platform names from kitrrc.ts, platform types or OS names; `native` covers every native
 * shell; `default` is required. The most specific wins: name, then OS, then type, then `native`.
 */
export function perPlatform<T>(
  platform: Pick<Platform, 'type' | 'os' | 'native'> & { name?: PlatformName | undefined },
  impls: Partial<Record<PlatformKey, () => T>> & { default: () => T },
): T {
  const table = impls as Record<string, (() => T) | undefined>
  const name = platform.name !== undefined ? table[platform.name] : undefined
  if (name) return name()
  const os = table[platform.os]
  if (os) return os()
  const type = table[platform.type]
  if (type) return type()
  if (platform.native && impls.native) return impls.native()
  return impls.default()
}

/** Strip a configured prefix from a deep link so it can be handed to the router. */
export function deepLinkPath(url: string, prefixes: string[] = []): string {
  let path = url
  try {
    const u = new URL(url)
    // Custom schemes (myapp://projects/1) put the first segment in the host.
    const host = /^https?:$/.test(u.protocol) ? '' : u.host
    path = `${host}${u.pathname}${u.search}${u.hash}`
  } catch {}
  path = normalisePath(path)
  for (const prefix of prefixes)
    if (prefix && path.startsWith(prefix)) return normalisePath(path.slice(prefix.length))
  return path
}

function normalisePath(path: string) {
  return path.startsWith('/') ? path : `/${path}`
}

/** Map a user agent string to a `PlatformOs`; iPhone and iPad user agents are checked before macOS. */
export function osFromUserAgent(ua: string): PlatformOs {
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  if (/android/i.test(ua)) return 'android'
  if (/mac os/i.test(ua)) return 'macos'
  if (/windows/i.test(ua)) return 'windows'
  if (/linux/i.test(ua)) return 'linux'
  return 'unknown'
}

function cssSafeArea(): SafeArea {
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;top:env(safe-area-inset-top);right:env(safe-area-inset-right);bottom:env(safe-area-inset-bottom);left:env(safe-area-inset-left);visibility:hidden;pointer-events:none'
  document.body.appendChild(probe)
  const s = getComputedStyle(probe)
  const n = (v: string) => Number.parseFloat(v) || 0
  const area = { top: n(s.top), right: n(s.right), bottom: n(s.bottom), left: n(s.left) }
  probe.remove()
  return area
}
