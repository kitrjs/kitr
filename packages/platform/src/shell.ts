import { defineProvider, getDevtools, type KitrApp, type KitrProvider } from '@kitr/core'
import { osFromUserAgent, type PlatformDriver, type PlatformOs, type PlatformType } from './index'
import { detectRuntime, type Runtime } from './runtime'

/**
 * The shared half of the desktop, tauri and mobile runtime providers. Each shell package is a
 * configuration of `createShellProvider()`: what it is called, which runtime it is, how to tell
 * it is the one running, and its own `platform` driver hooks. Detection, registration, the
 * app-state default, the IPC bridge guard and the devtools line are written once, here.
 */

/** The native shells a provider can wrap. */
export type ShellRuntime = Exclude<Runtime, 'web'>

/** The untyped message bridge a shell exposes to the page: Electron's preload `kitrIpc`, a Tauri command channel. */
export interface ShellBridge {
  /** Call the native side and resolve with its answer. */
  invoke(channel: string, ...args: unknown[]): Promise<unknown>
  /** Listen to a channel the native side sends on. Returns the unsubscribe function. */
  on?(channel: string, listener: (...args: unknown[]) => void): () => void
  /** Send a one-way message, with no reply. */
  send?(channel: string, ...args: unknown[]): void
}

/** What `createShellProvider()` hands to its hooks: the pieces every shell uses. */
export interface Shell {
  /** The native runtime this provider wraps. */
  readonly runtime: ShellRuntime
  /** The bridge, or undefined when the shell has none or the page is not inside it. */
  bridge(): ShellBridge | undefined
  /** Call the bridge. Rejects with a message naming the provider when the bridge is missing. */
  invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>
  /** The operating system the shell reports. */
  os(): PlatformOs | string
  /** True when the page is running inside this shell. */
  active(): boolean
}

/** The platform driver hooks a shell may implement; `type`, `native`, `runtime` and `os` are filled in by the provider. */
export type ShellDriverHooks = Partial<Omit<PlatformDriver, 'type' | 'native' | 'runtime' | 'os'>>

/** How a shell package configures `createShellProvider()`. */
export interface ShellOptions {
  /** The provider name, shown by `kitr doctor` and in errors: `desktop`, `tauri`, `mobile`. */
  name: string
  /** The tag drivers are registered under (`app.drivers.describe()`, devtools): `desktop`, `mobile`. */
  platform: string
  /** The `platform.type` the shell reports. */
  type: PlatformType
  /** Which native runtime this is. */
  runtime: ShellRuntime
  /** Whether the page is inside this shell. Default: `detectRuntime() === runtime`. */
  detect?(): boolean
  /** Where the page finds the IPC bridge. Omit for shells that call native plugins directly. */
  bridge?(): ShellBridge | undefined
  /** The operating system. Default: from the user agent. */
  os?(): PlatformOs | string
  /** The shell's own `platform` driver hooks (app version, open link, exit, back button...). */
  driver?(shell: Shell): ShellDriverHooks
  /** Register the shell's other drivers (storage, ...) once the page is known to be inside it. */
  register?(app: KitrApp, shell: Shell): void
}

/** The foreground/background default every shell shares: the page's visibility. */
export function visibilityAppState(listener: (active: boolean) => void): () => void {
  if (typeof document === 'undefined') return () => {}
  const handler = () => listener(document.visibilityState === 'visible')
  document.addEventListener('visibilitychange', handler)
  return () => document.removeEventListener('visibilitychange', handler)
}

/** The operating system from the user agent, `unknown` on the server. */
export function userAgentOs(): PlatformOs {
  return osFromUserAgent(typeof navigator === 'undefined' ? '' : navigator.userAgent)
}

/** Build the `Shell` helpers for a configuration. */
export function createShell(options: ShellOptions): Shell {
  const shell: Shell = {
    runtime: options.runtime,
    bridge: () => options.bridge?.(),
    invoke(channel, ...args) {
      const bridge = options.bridge?.()
      if (!bridge)
        return Promise.reject(
          new Error(
            `[kitr/${options.name}] the ${options.runtime} bridge is not available (not running in ${options.runtime}, or its preload script did not expose it)`,
          ),
        )
      return bridge.invoke(channel, ...args) as Promise<never>
    },
    os: () => options.os?.() ?? userAgentOs(),
    active: () => (options.detect ? options.detect() : detectRuntime() === options.runtime),
  }
  return shell
}

/** The `platform` driver a shell registers: native, standalone, app state from visibility, plus the shell's own hooks. */
export function createShellDriver(
  options: ShellOptions,
  shell = createShell(options),
): PlatformDriver {
  return {
    type: options.type,
    native: true,
    runtime: options.runtime,
    os: shell.os,
    standalone: () => true,
    onAppState: visibilityAppState,
    ...options.driver?.(shell),
  }
}

/**
 * The runtime provider of a native shell. Inside the shell it registers the `platform` driver and
 * whatever `register()` adds; in a plain browser it does nothing, so the web build of the same app
 * keeps working. Logs the runtime to devtools at boot.
 *
 *   export const desktopProvider = createShellProvider({
 *     name: 'desktop', platform: 'desktop', type: 'desktop', runtime: 'electron',
 *     driver: (shell) => ({ exit: () => shell.invoke('kitr:app:quit').then(() => {}) }),
 *   })
 */
export function createShellProvider(options: ShellOptions): KitrProvider {
  const shell = createShell(options)
  return defineProvider({
    name: options.name,
    register(app) {
      if (!shell.active()) return
      app.drivers.register('platform', createShellDriver(options, shell), {
        platform: options.platform,
      })
      options.register?.(app, shell)
    },
    boot(app) {
      if (!shell.active()) return
      getDevtools(app)?.log(
        options.name,
        `${options.runtime} shell (${shell.os()}), drivers: ${app.drivers.capabilities().join(', ')}`,
      )
    },
  })
}
