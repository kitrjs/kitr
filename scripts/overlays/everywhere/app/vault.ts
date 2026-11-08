import { defineProvider } from '@kitr/kitr/app'
import type { SecureStorageDriver } from '@kitr/secure-storage'

/** A secure-storage driver is four functions. This one keeps values in a Map (tests, previews). */
export function createMapVault(): SecureStorageDriver {
  const values = new Map<string, string>()
  return {
    name: 'map-vault',
    secure: false,
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => {
      values.set(key, value)
    },
    remove: async (key) => {
      values.delete(key)
    },
    keys: async () => [...values.keys()],
  }
}

/**
 * Not listed in kitrrc.ts: list it to use the Map vault in every shell.
 * Priority 20 beats the platform drivers (10) and the web fallback (0).
 */
export default defineProvider({
  name: 'map-vault',
  register(app) {
    app.drivers.register('secure-storage', createMapVault(), { platform: 'test', priority: 20 })
  },
})
