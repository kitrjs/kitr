import { defineProvider, getDevtools } from '@kitr/core'
import { type StorageConfig, setCookieDefaults, setStoragePrefix } from './index'

/**
 * Applies `config/storage.ts` (key prefix, cookie defaults) and contributes the
 * Storage panel to the devtools. Nothing to wrap: items are plain modules.
 */
export const storageProvider = defineProvider({
  name: 'storage',
  register(app) {
    const config = app.config.get('storage', {} as StorageConfig)
    if (config.prefix) setStoragePrefix(config.prefix)
    if (config.cookie) setCookieDefaults(config.cookie)
  },
  boot(app) {
    const hub = getDevtools(app)
    if (!hub || typeof window === 'undefined') return
    // Mirror every write into the devtools log so a changing value is visible as it happens.
    window.addEventListener('storage', (e) => hub.log('storage', `${e.key} changed in another tab`))
  },
  devtools: () => import('./devtools').then((m) => m.panels()),
})

export default storageProvider
