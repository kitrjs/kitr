import { driverUnavailable, loadShellModule } from '@kitr/platform'
import type { Driver, DriverOptions } from '../driver'
import type { DesktopSystem } from './electron'

/** `@tauri-apps/plugin-clipboard-manager`. */
interface ClipboardPlugin {
  readText(): Promise<string>
  writeText(text: string): Promise<void>
}
/** `@tauri-apps/plugin-opener`. */
interface OpenerPlugin {
  openUrl(url: string): Promise<void>
}
/** `@tauri-apps/plugin-os`. */
interface OsPlugin {
  platform(): string
}
/** `@tauri-apps/api/app`. */
interface AppApi {
  getVersion(): Promise<string>
}
/** `@tauri-apps/api/window`. */
interface WindowApi {
  getCurrentWindow(): {
    theme(): Promise<'light' | 'dark' | null>
    onThemeChanged(handler: (event: { payload: 'light' | 'dark' }) => void): Promise<() => void>
  }
}

/** The Tauri driver: the capabilities the plugins cover plus the `system` helpers. */
export interface TauriNativeDriver extends Driver {
  /** Desktop-only helpers, the same as on Electron except for power events, which Tauri has no plugin for. */
  system: DesktopSystem
}

// kitr-allow-module-state: immutable list of allowed protocols
const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:']

const missing = (pkg: string, rust: string) =>
  driverUnavailable(
    'tauri',
    'native',
    `${pkg} is not installed (run \`npm install ${pkg}\`${rust ? `, add ${rust} in src-tauri` : ''})`,
  )

async function plugin<T>(name: string, rust: string): Promise<T> {
  try {
    return await loadShellModule<T>(name)
  } catch {
    throw missing(name, rust)
  }
}

/**
 * The native driver for the Tauri shell. `clipboard` is `@tauri-apps/plugin-clipboard-manager`;
 * `share`, `haptics`, `geolocation`, `camera` and `biometrics` are `null` (the matching Tauri
 * plugins are mobile-only, and a Tauri mobile build runs under Capacitor's driver set instead of
 * this one). `driver.system` has `openExternal` (`@tauri-apps/plugin-opener`), `platform`
 * (`@tauri-apps/plugin-os`), `appVersion` and the system theme (`@tauri-apps/api`) and online
 * status. Each plugin is imported on first use and is an optional peer: a missing one makes the
 * call that needs it reject with `E_DRIVER_UNAVAILABLE`.
 */
export function createTauriDriver(_options: DriverOptions = {}): TauriNativeDriver {
  const clipboard = () =>
    plugin<ClipboardPlugin>(
      '@tauri-apps/plugin-clipboard-manager',
      'tauri-plugin-clipboard-manager and the clipboard-manager:default permission',
    )
  const windowApi = () => plugin<WindowApi>('@tauri-apps/api/window', '')
  return {
    name: 'tauri',
    clipboard: {
      readText: async () => (await clipboard()).readText(),
      writeText: async (text) => (await clipboard()).writeText(text),
    },
    share: null,
    haptics: null,
    geolocation: null,
    camera: null,
    biometrics: null,
    system: {
      platform: async () =>
        (
          await plugin<OsPlugin>('@tauri-apps/plugin-os', 'tauri-plugin-os and os:default')
        ).platform(),
      appVersion: async () => (await plugin<AppApi>('@tauri-apps/api/app', '')).getVersion(),
      async openExternal(url) {
        if (!SAFE_PROTOCOLS.includes(new URL(url).protocol))
          throw new Error(`@kitr/native: opening ${new URL(url).protocol} links is not allowed`)
        await (
          await plugin<OpenerPlugin>(
            '@tauri-apps/plugin-opener',
            'tauri-plugin-opener and opener:default',
          )
        ).openUrl(url)
      },
      isDark: async () => (await (await windowApi()).getCurrentWindow().theme()) === 'dark',
      onTheme(listener) {
        let off: (() => void) | undefined
        let stopped = false
        void windowApi()
          .then((api) =>
            api.getCurrentWindow().onThemeChanged((event) => listener(event.payload === 'dark')),
          )
          .then((unlisten) => {
            if (stopped) unlisten()
            else off = unlisten
          })
          .catch(() => {})
        return () => {
          stopped = true
          off?.()
        }
      },
      isOnline: async () => (typeof navigator === 'undefined' ? true : navigator.onLine),
    },
  }
}
