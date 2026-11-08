import { driverUnavailable } from '@kitr/platform'
import type { Driver, DriverOptions } from '../driver'

/** The preload bridge `exposeIpc()` from `@kitr/desktop/preload` puts on `window`. */
interface Bridge {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>
  on(channel: string, listener: (...args: unknown[]) => void): () => void
}

/** A change in how the computer is powered, as `system.onPower` reports it. */
export type PowerEvent = 'suspend' | 'resume' | 'battery' | 'ac'

/** What a desktop shell knows that the six capabilities do not cover. */
export interface DesktopSystem {
  /** The operating system: `darwin`, `win32`, `linux` (Electron) or `macos`, `windows`, `linux` (Tauri). */
  platform(): Promise<string>
  /** The app's version from `package.json` / `tauri.conf.json`. */
  appVersion(): Promise<string>
  /** Open a link in the default browser. Only `http:`, `https:`, `mailto:` and `tel:` are allowed. */
  openExternal(url: string): Promise<void>
  /** Whether the system is in dark mode. */
  isDark(): Promise<boolean>
  /** Listen for the system switching between light and dark. Returns the unsubscribe function. */
  onTheme(listener: (dark: boolean) => void): () => void
  /** Whether the machine has a network connection. */
  isOnline(): Promise<boolean>
}

/** The Electron driver: the capabilities Electron has plus the `system` helpers. */
export interface ElectronNativeDriver extends Driver {
  /** Desktop-only helpers; also `onPower` and `isOnBattery`, which only Electron has. */
  system: DesktopSystem & {
    /** Suspend, resume and battery/AC changes from Electron's `powerMonitor`. */
    onPower(listener: (event: PowerEvent) => void): () => void
    /** Whether the computer runs on battery now. */
    isOnBattery(): Promise<boolean>
  }
}

/**
 * The native driver for the Electron shell, served over the `kitr:native:*` and `kitr:shell:open`
 * channels of `handleKitrIpc()`. Capabilities: `clipboard` (Electron's `clipboard`) and `biometrics`
 * (Touch ID on macOS; `available()` is false elsewhere). `share`, `haptics`, `geolocation` and
 * `camera` are `null`: a desktop has no share sheet or haptic motor, and the Chromium
 * geolocation needs a Google key, so those report `supported: false` rather than pretend.
 * `driver.system` has what desktop apps want beyond them: `openExternal`, `appVersion`,
 * `platform`, the system theme, online status and `powerMonitor` events.
 *
 * Throws `E_DRIVER_UNAVAILABLE` when the preload bridge is missing (no `exposeIpc()` call).
 */
export function createElectronDriver(_options: DriverOptions = {}): ElectronNativeDriver {
  const bridge = (globalThis as { kitrIpc?: Bridge }).kitrIpc
  if (!bridge)
    throw driverUnavailable(
      'electron',
      'native',
      'the kitrIpc preload bridge is missing: call exposeIpc() in the preload script',
    )
  const info = async () =>
    (await bridge.invoke('kitr:native:info')) as {
      platform: string
      version: string
      online: boolean
      dark: boolean
    }
  return {
    name: 'electron',
    clipboard: {
      readText: async () => (await bridge.invoke('kitr:native:clipboard-read')) as string,
      writeText: async (text) => {
        await bridge.invoke('kitr:native:clipboard-write', text)
      },
    },
    share: null,
    haptics: null,
    geolocation: null,
    camera: null,
    biometrics: {
      available: async () => (await bridge.invoke('kitr:native:biometrics-available')) as boolean,
      authenticate: async (options) =>
        (await bridge.invoke('kitr:native:biometrics-prompt', options?.reason)) as boolean,
    },
    system: {
      platform: async () => (await info()).platform,
      appVersion: async () => (await bridge.invoke('kitr:app:version')) as string,
      openExternal: async (url) => {
        await bridge.invoke('kitr:shell:open', url)
      },
      isDark: async () => (await info()).dark,
      onTheme: (listener) => bridge.on('kitr:native:theme', (dark) => listener(dark as boolean)),
      isOnline: async () => (await bridge.invoke('kitr:native:online')) as boolean,
      onPower: (listener) =>
        bridge.on('kitr:native:power', (event) => listener(event as PowerEvent)),
      isOnBattery: async () => (await bridge.invoke('kitr:native:on-battery')) as boolean,
    },
  }
}
