import type { Plugin } from 'vite'
import type { PwaConfig } from './index'

/**
 * vite-plugin-pwa with the manifest built from `config/pwa.ts`. Pass the config object
 * (the Vite config runs before the app exists, so read the file yourself):
 *
 *   import pwa from './config/pwa'
 *   plugins: [kitr(), kitrPwa(pwa)]
 */
export async function kitrPwa(config: PwaConfig): Promise<Plugin[]> {
  const { VitePWA } = await import('vite-plugin-pwa')
  const registerType = config.registerType ?? 'prompt'
  return VitePWA({
    registerType,
    // kitr registers the worker itself (useServiceWorker), so no inline script is injected.
    injectRegister: false,
    manifest: {
      name: config.name,
      short_name: config.shortName ?? config.name,
      description: config.description,
      theme_color: config.themeColor ?? '#0f172a',
      background_color: config.backgroundColor ?? '#ffffff',
      display: config.display ?? 'standalone',
      start_url: config.startUrl ?? '/',
      icons: config.icons ?? [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        {
          src: '/icons/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
    },
    workbox: {
      // SPA fallback; API calls are never served from the precache.
      navigateFallbackDenylist: [/^\/api\//, /^\/ws/],
      ...(registerType === 'prompt' ? { skipWaiting: false, clientsClaim: false } : {}),
    },
    devOptions: { enabled: config.devEnabled ?? false },
    ...config.plugin,
  })
}

export default kitrPwa
