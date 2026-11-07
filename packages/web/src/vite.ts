import type { Plugin } from 'vite'
import { pwaManifest, type WebOptions } from './index'

/**
 * vite-plugin-pwa configured from `web({ pwa })`. The kitr() Vite plugin adds it when the
 * running web platform has `pwa` on; call it yourself only for a custom Vite setup.
 */
export async function kitrPwa(options: WebOptions, appName: string): Promise<Plugin[]> {
  const { VitePWA } = await import('vite-plugin-pwa')
  const pwa = typeof options.pwa === 'object' ? options.pwa : {}
  const registerType = pwa.registerType ?? 'prompt'
  const plugins = VitePWA({
    registerType,
    // kitr registers the worker itself (useServiceWorker), so no inline script is injected.
    injectRegister: false,
    manifest: pwaManifest(options, appName),
    workbox: {
      // SPA fallback; API calls and sockets are never served from the precache.
      navigateFallbackDenylist: [/^\/api\//, /^\/ws/, /^\/_serverFn\//],
      ...(registerType === 'prompt' ? { skipWaiting: false, clientsClaim: false } : {}),
    },
    devOptions: { enabled: pwa.devEnabled ?? false },
    ...pwa.plugin,
  })
  // Start builds the client and the ssr environments in one run; the worker belongs to the client,
  // so the plugin must not see the ssr environment's config (it would skip generation).
  for (const plugin of plugins) {
    const orig = plugin.configResolved
    if (!orig) continue
    const handler = typeof orig === 'function' ? orig : orig.handler
    plugin.configResolved = async function (this: unknown, config) {
      if (config.build.ssr) return
      return (handler as any).call(this, config)
    }
  }
  return plugins
}

export default kitrPwa
