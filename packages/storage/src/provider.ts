import { defineProvider, getDevtools } from '@kitr/core'
import {
  getStorageDriver,
  type StorageConfig,
  setCookieDefaults,
  setStorageDriver,
  setStoragePrefix,
} from './index'

/** Set by @kitr/vite: `false` in a production build without the devtools overlay, so the panel chunk is never emitted. */
declare const __KITR_DEVTOOLS__: boolean | undefined

/**
 * Applies `config/storage.ts` (key prefix, cookie defaults), switches `defineStorage`
 * items to the platform's native driver when one is registered, hydrates it before the first
 * render, and contributes the Storage panel to the devtools.
 */
export const storageProvider = defineProvider({
  name: 'storage',
  register(app) {
    const config = app.config.get('storage', {} as StorageConfig)
    if (config.prefix) setStoragePrefix(config.prefix)
    if (config.cookie) setCookieDefaults(config.cookie)
    const driver = app.drivers.resolve('storage')
    if (driver) setStorageDriver(driver)
  },
  async boot(app) {
    // Platform providers (desktop, mobile) may be listed after storage, so their driver is only
    // registered once every provider's register() has run: resolve again here, before anything renders.
    const driver = app.drivers.resolve('storage')
    if (driver && getStorageDriver('local') !== driver) setStorageDriver(driver)
    await driver?.hydrate?.()
    const hub = getDevtools(app)
    if (!hub) return
    hub.log('storage', `driver: ${getStorageDriver('local')?.name ?? 'none (server)'}`)
    for (const area of ['local', 'session'] as const)
      getStorageDriver(area)?.subscribe?.((key) =>
        hub.log('storage', `${key ?? 'storage'} changed outside this context`),
      )
  },
  devtools:
    typeof __KITR_DEVTOOLS__ === 'boolean' && __KITR_DEVTOOLS__ === false
      ? undefined
      : (_app, ui) => import('./devtools').then((m) => m.panels(ui)),
})

export default storageProvider
