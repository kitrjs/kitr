import { defineProvider, getDevtools } from '@kitr/core'
import {
  getStorageDriver,
  type StorageConfig,
  setCookieDefaults,
  setKvDriver,
  setStorageDriver,
  setStoragePrefix,
} from './index'

/**
 * Applies `config/storage.ts` (key prefix, cookie defaults, kv driver), switches `defineStorage`
 * items to the platform's native driver when one is registered, hydrates it before the first
 * render, and contributes the Storage panel to the devtools.
 */
export const storageProvider = defineProvider({
  name: 'storage',
  register(app) {
    const config = app.config.get('storage', {} as StorageConfig)
    if (config.prefix) setStoragePrefix(config.prefix)
    if (config.cookie) setCookieDefaults(config.cookie)
    if (config.kv) setKvDriver(config.kv)
    const driver = app.drivers.resolve('storage')
    if (driver) setStorageDriver(driver)
  },
  async boot(app) {
    const driver = app.drivers.resolve('storage')
    await driver?.hydrate?.()
    const hub = getDevtools(app)
    if (!hub) return
    hub.log('storage', `driver: ${getStorageDriver('local')?.name ?? 'none (server)'}`)
    for (const area of ['local', 'session'] as const)
      getStorageDriver(area)?.subscribe?.((key) =>
        hub.log('storage', `${key ?? 'storage'} changed outside this context`),
      )
  },
  devtools: () => import('./devtools').then((m) => m.panels()),
})

export default storageProvider
