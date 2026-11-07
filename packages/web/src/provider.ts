import { defineProvider } from '@kitr/core'

/**
 * Runtime provider of the web platform. Registers the `platform` driver that tells
 * `kitr/platform` the app runs in a browser (or on the server rendering for one).
 */
export const webProvider = defineProvider({
  name: 'web',
  register(app) {
    app.drivers.register(
      'platform',
      {
        type: 'web',
        native: false,
        os: () =>
          typeof navigator === 'undefined' ? 'server' : osFromUserAgent(navigator.userAgent),
        standalone: () =>
          typeof window !== 'undefined' &&
          (window.matchMedia?.('(display-mode: standalone)').matches ||
            (navigator as { standalone?: boolean }).standalone === true),
      },
      { platform: 'web', priority: 0 },
    )
  },
})

function osFromUserAgent(ua: string): string {
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  if (/android/i.test(ua)) return 'android'
  if (/mac os/i.test(ua)) return 'macos'
  if (/windows/i.test(ua)) return 'windows'
  if (/linux/i.test(ua)) return 'linux'
  return 'unknown'
}

export default webProvider
