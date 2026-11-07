import { createDefineConfig } from '@kitr/core'
import { useEffect, useState } from 'react'

export interface CapacitorConfig {
  appId: string
  appName: string
  /** Built web assets. `dist` for SPA apps, `dist/client` for TanStack Start apps. */
  webDir?: string
  /** Load from a dev server URL instead of bundled assets (live reload on device). */
  devServerUrl?: string
  /** Raw Capacitor config merged last. */
  extra?: Record<string, unknown>
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    capacitor: CapacitorConfig
  }
}

export const defineConfig = createDefineConfig<CapacitorConfig>()

type Platform = 'ios' | 'android' | 'web'

function cap(): {
  getPlatform(): string
  isNativePlatform(): boolean
  isPluginAvailable(name: string): boolean
} | null {
  const c = (globalThis as any).Capacitor
  return c && typeof c.getPlatform === 'function' ? c : null
}

/** 'ios' | 'android' | 'web'. Reads the global Capacitor runtime, so it is correct before any import resolves. */
export function platform(): Platform {
  return (cap()?.getPlatform() as Platform | undefined) ?? 'web'
}

/** True inside the iOS or Android shell. */
export function isNative(): boolean {
  return cap()?.isNativePlatform() ?? false
}

export function isPluginAvailable(name: string): boolean {
  return cap()?.isPluginAvailable(name) ?? false
}

/** Run `fn` only on native; returns `fallback` on the web. Keeps native-only calls out of the web bundle path. */
export async function nativeOnly<T>(fn: () => Promise<T>, fallback?: T): Promise<T | undefined> {
  return isNative() ? fn() : fallback
}

/** `active` flips when the app goes to the background or returns. Needs `@capacitor/app`. */
export function useAppState() {
  const [active, setActive] = useState(true)
  useEffect(() => {
    if (!isNative()) return
    let handle: { remove(): Promise<void> } | undefined
    import('@capacitor/app').then(async ({ App }) => {
      handle = await App.addListener('appStateChange', ({ isActive }) => setActive(isActive))
    })
    return () => void handle?.remove()
  }, [])
  return active
}

/**
 * Android hardware back button. The handler gets `canGoBack`; return nothing to let the
 * default (navigate back, or exit at the root) run, or call `App.exitApp()` yourself.
 */
export function useBackButton(handler: (info: { canGoBack: boolean }) => void) {
  useEffect(() => {
    if (!isNative()) return
    let handle: { remove(): Promise<void> } | undefined
    import('@capacitor/app').then(async ({ App }) => {
      handle = await App.addListener('backButton', handler)
    })
    return () => void handle?.remove()
  }, [handler])
}

/** Deep links (`myapp://...` or universal links) opened while the app runs. Needs `@capacitor/app`. */
export function useAppUrlOpen(handler: (url: string) => void) {
  useEffect(() => {
    if (!isNative()) return
    let handle: { remove(): Promise<void> } | undefined
    import('@capacitor/app').then(async ({ App }) => {
      handle = await App.addListener('appUrlOpen', ({ url }) => handler(url))
    })
    return () => void handle?.remove()
  }, [handler])
}

/**
 * Pick an implementation per platform:
 *   const storage = perPlatform({ web: () => localStorageImpl, native: () => preferencesImpl })
 */
export function perPlatform<T>(impls: {
  web: () => T
  native?: () => T
  ios?: () => T
  android?: () => T
}): T {
  const p = platform()
  if (p === 'ios' && impls.ios) return impls.ios()
  if (p === 'android' && impls.android) return impls.android()
  if (p !== 'web' && impls.native) return impls.native()
  return impls.web()
}
