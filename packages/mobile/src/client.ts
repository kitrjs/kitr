/**
 * Browser-side helpers of the mobile platform. The lifecycle hooks (app state, back button,
 * deep links, online) live in `@kitr/platform/react`, where every platform shares them.
 */

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
export function capacitorPlatform(): Platform {
  return (cap()?.getPlatform() as Platform | undefined) ?? 'web'
}

/** True inside the iOS or Android shell. */
export function isCapacitor(): boolean {
  return cap()?.isNativePlatform() ?? false
}

/** True when the native shell registered the Capacitor plugin `name` (`'App'`, `'Share'`); always false on the web. */
export function isPluginAvailable(name: string): boolean {
  return cap()?.isPluginAvailable(name) ?? false
}

/** Run `fn` only inside the native shell; returns `fallback` on the web. */
export async function nativeOnly<T>(fn: () => Promise<T>, fallback?: T): Promise<T | undefined> {
  return isCapacitor() ? fn() : fallback
}
