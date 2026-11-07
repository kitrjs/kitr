import { defineProvider } from '@kitr/core'
import type { PlatformDriver } from '@kitr/platform'
import { createAsyncStorageDriver, type StorageDriver } from '@kitr/storage'
import { capacitorPlatform, isCapacitor } from './client'

/**
 * Runtime provider of the mobile platform. Inside the Capacitor shell it registers the
 * `platform` driver (App plugin: state, back button, deep links) and a `storage` driver on
 * Preferences, which survives the OS clearing WebView storage. In a plain browser it does nothing,
 * so the same bundle runs on the web.
 */
export const mobileProvider = defineProvider({
  name: 'mobile',
  register(app) {
    if (!isCapacitor()) return
    app.drivers.register('platform', platformDriver(), { platform: 'mobile' })
    app.drivers.register('storage', preferencesDriver(), { platform: 'mobile' })
  },
})

export default mobileProvider

function platformDriver(): PlatformDriver {
  const appPlugin = () => import('@capacitor/app').then((m) => m.App)
  const listen = <T>(event: string, map: (data: any) => T, listener: (value: T) => void) => {
    let handle: { remove(): Promise<void> } | undefined
    let cancelled = false
    appPlugin().then(async (App) => {
      const h = await (App as any).addListener(event, (data: unknown) => listener(map(data)))
      if (cancelled) h.remove()
      else handle = h
    })
    return () => {
      cancelled = true
      void handle?.remove()
    }
  }
  return {
    type: 'mobile',
    native: true,
    os: () => capacitorPlatform(),
    standalone: () => true,
    appVersion: () =>
      appPlugin()
        .then((App) => App.getInfo())
        .then((i) => i.version),
    onAppState: (l) => listen('appStateChange', (d) => d.isActive as boolean, l),
    onBackButton: (l) => listen('backButton', (d) => ({ canGoBack: d.canGoBack as boolean }), l),
    onDeepLink: (l) => listen('appUrlOpen', (d) => d.url as string, l),
    openExternal: async (url) => {
      window.open(url, '_system')
    },
    exit: () => appPlugin().then((App) => App.exitApp()),
  }
}

/** `@capacitor/preferences` as a kitr storage driver: hydrated at boot, written through in the background. */
export function preferencesDriver(): StorageDriver {
  const prefs = () => import('@capacitor/preferences').then((m) => m.Preferences)
  return createAsyncStorageDriver({
    name: 'capacitor:preferences',
    async load() {
      const P = await prefs()
      const { keys } = await P.keys()
      const out: Record<string, string> = {}
      for (const key of keys) {
        const { value } = await P.get({ key })
        if (value !== null) out[key] = value
      }
      return out
    },
    write: (key, value) => prefs().then((P) => P.set({ key, value })),
    erase: (key) => prefs().then((P) => P.remove({ key })),
  })
}
