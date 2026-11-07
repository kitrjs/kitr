import { createDefineConfig, type KitrApp } from '@kitr/core'

/**
 * Where the app runs, as one API. Platform packages register a `PlatformDriver`;
 * the `platform` service wraps whichever is active, with a browser/server default.
 */

export type PlatformType = 'web' | 'mobile' | 'desktop' | 'server' | (string & {})
export type PlatformOs = 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'server' | 'unknown'

export interface SafeArea {
  top: number
  right: number
  bottom: number
  left: number
}

export interface PlatformDriver {
  /** `web`, `mobile`, `desktop`, `server` or a custom platform type. */
  type: PlatformType
  /** True inside a native shell (Capacitor, Tauri, Electron). */
  native: boolean
  os(): PlatformOs | string
  /** Installed as an app (PWA standalone, native shell). */
  standalone?(): boolean
  appVersion?(): Promise<string>
  /** Foreground/background. */
  onAppState?(listener: (active: boolean) => void): () => void
  /** Hardware or window back button. */
  onBackButton?(listener: (info: { canGoBack: boolean }) => void): () => void
  /** Deep links and custom-scheme URLs opened while the app runs. */
  onDeepLink?(listener: (url: string) => void): () => void
  onOnline?(listener: (online: boolean) => void): () => void
  isOnline?(): boolean
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

export interface PlatformConfig {
  /** Route deep links by stripping this prefix (`myapp://` or `https://app.example.com`) before navigating. */
  deepLinkPrefixes?: string[]
}

export const defineConfig = createDefineConfig<PlatformConfig>()

/** The `platform` service: the active driver plus safe defaults for everything it leaves out. */
export interface Platform {
  readonly type: PlatformType
  readonly native: boolean
  readonly os: PlatformOs | string
  readonly standalone: boolean
  /** The platform name from kitrrc.ts the bundle was built for, when known. */
  readonly name: string | undefined
  readonly driver: PlatformDriver
  isOnline(): boolean
  appVersion(): Promise<string>
  onAppState(listener: (active: boolean) => void): () => void
  onBackButton(listener: (info: { canGoBack: boolean }) => void): () => void
  onDeepLink(listener: (url: string) => void): () => void
  onOnline(listener: (online: boolean) => void): () => void
  safeArea(): SafeArea
  openExternal(url: string): Promise<void>
  exit(): Promise<void>
  /** `platform.is('mobile')`, `platform.is('ios')`: matches the type or the OS. */
  is(what: PlatformType | PlatformOs): boolean
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
    onOnline: (l) => (driver.onOnline ?? fallback.onOnline ?? noop)(l),
    safeArea: () => driver.safeArea?.() ?? fallback.safeArea!(),
    openExternal: (url) => (driver.openExternal ?? fallback.openExternal!)(url),
    exit: () => driver.exit?.() ?? Promise.resolve(),
    is: (what) => driver.type === what || driver.os() === what,
  }
  return platform
}

/**
 * Pick an implementation per platform without branching in components:
 *   const save = perPlatform(platform, { web: () => download, mobile: () => share, desktop: () => saveDialog })
 * Keys are platform types or OS names; `native` covers every native shell; `default` is required.
 */
export function perPlatform<T>(
  platform: Pick<Platform, 'type' | 'os' | 'native'>,
  impls: Partial<Record<PlatformType | PlatformOs | 'native', () => T>> & { default: () => T },
): T {
  const os = impls[platform.os as PlatformOs]
  if (os) return os()
  const type = impls[platform.type as PlatformType]
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
