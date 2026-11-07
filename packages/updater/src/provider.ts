import { defineProvider } from '@kitr/core'
import { createUpdater, type UpdaterConfig } from './index'

/**
 * Binds `updater` to the platform updater (`updater` capability) or the service-worker driver,
 * checks at boot and on the configured interval, and stops at shutdown.
 */
export const updaterProvider = defineProvider({
  name: 'updater',
  register(app) {
    if (!app.isClient) return
    const config = app.config.get('updater', {} as UpdaterConfig)
    app.container.singleton('updater', () => createUpdater(config, app))
  },
  boot(app) {
    if (!app.isClient) return
    const config = app.config.get('updater', {} as UpdaterConfig)
    if (config.checkOnBoot !== false) void app.container.use('updater').check()
  },
  shutdown(app) {
    if (app.isClient && app.container.has('updater')) app.container.use('updater').stop()
  },
})

export default updaterProvider
