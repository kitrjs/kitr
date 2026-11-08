import { driverUnavailable } from '@kitr/platform'
import type { Driver, DriverOptions } from '../driver'

/**
 * The vault plugin, imported on first use so web bundles never load it. When it is not installed
 * this throws `E_DRIVER_UNAVAILABLE` naming the package to install; secrets are never written to
 * WebView storage instead.
 */
async function vault() {
  let module: typeof import('@aparajita/capacitor-secure-storage')
  try {
    module = await import('@aparajita/capacitor-secure-storage')
  } catch {
    throw driverUnavailable(
      'capacitor',
      'secure-storage',
      'install @aparajita/capacitor-secure-storage',
    )
  }
  return module
}

/**
 * Secure storage for the Capacitor shell on `@aparajita/capacitor-secure-storage`: the iOS Keychain
 * and, on Android, the Keystore with encrypted shared preferences. Values are strings and stay on
 * this device (`whenUnlockedThisDeviceOnly`: no iCloud sync, no migration to a new phone, readable
 * only while unlocked). Never falls back to `localStorage`.
 */
export function createCapacitorDriver(_options: DriverOptions = {}): Driver {
  let ready: ReturnType<typeof configure> | undefined
  const configure = async () => {
    const { SecureStorage, KeychainAccess } = await vault()
    await SecureStorage.setSynchronize(false)
    await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly)
    return SecureStorage
  }
  const storage = () => {
    ready ??= configure()
    // A failed first call (plugin missing) must not stick: the next call tries again.
    ready.catch(() => {
      ready = undefined
    })
    return ready
  }
  return {
    name: 'capacitor-keychain',
    secure: true,
    async get(key) {
      return (await storage()).getItem(key)
    },
    async set(key, value) {
      await (await storage()).setItem(key, value)
    },
    async remove(key) {
      await (await storage()).removeItem(key)
    },
    async keys() {
      return (await storage()).keys()
    },
  }
}
