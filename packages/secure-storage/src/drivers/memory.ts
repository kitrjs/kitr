import type { SecureStorageDriver } from '../index'

/** A vault in a `Map`, for tests and the server. `secure` is false; nothing survives a restart. */
export function createMemorySecureStorageDriver(name = 'memory'): SecureStorageDriver {
  const map = new Map<string, string>()
  return {
    name,
    secure: false,
    get: async (key) => map.get(key) ?? null,
    set: async (key, value) => {
      map.set(key, value)
    },
    remove: async (key) => {
      map.delete(key)
    },
    keys: async () => [...map.keys()],
  }
}
