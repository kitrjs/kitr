import { defineProvider, getDevtools } from '@kitr/core'
import { createSecureStorage, type SecureStorageConfig } from './index'

/**
 * Binds `secureStorage` to the platform vault (registered by the mobile/desktop providers under
 * the `secure-storage` capability) or the encrypted web fallback. On the server it is an in-memory
 * store, so code that runs in both places needs no branches.
 */
export const secureStorageProvider = defineProvider({
  name: 'secure-storage',
  register(app) {
    const config = app.config.get('secure-storage', {} as SecureStorageConfig)
    app.container.singleton('secureStorage', () => createSecureStorage(config, app))
  },
  boot(app) {
    const hub = getDevtools(app)
    if (!hub) return
    const storage = app.container.use('secureStorage')
    hub.log(
      'secure-storage',
      `${storage.driver.name} (${storage.secure ? 'OS vault' : 'encrypted web fallback'})`,
    )
  },
})

export default secureStorageProvider
