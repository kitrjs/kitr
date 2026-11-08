import {
  createDefineConfig,
  getDevtools,
  type KitrApp,
  type StandardSchemaV1,
  validateSync,
} from '@kitr/core'
import { runtimeOf } from '@kitr/platform'
import type { StorageDriver } from '@kitr/storage'
import { selectDriver } from './driver'

export { type Driver, type DriverOptions, selectDriver } from './driver'
export { createCapacitorDriver as createCapacitorSecureStorageDriver } from './drivers/capacitor'
export { createElectronDriver as createElectronSecureStorageDriver } from './drivers/electron'
export { createMemorySecureStorageDriver } from './drivers/memory'
export {
  createTauriDriver as createTauriSecureStorageDriver,
  type TauriSecureStorageOptions,
} from './drivers/tauri'
export { createWebSecureStorageDriver } from './drivers/web'

/**
 * Secrets that must not sit in plain storage: auth tokens, API keys, refresh tokens.
 * Platform packages register a `SecureStorageDriver` backed by the Keychain, the Android Keystore
 * or Electron's safeStorage; on the web the fallback encrypts values with AES-GCM under a key
 * kept in IndexedDB (non-extractable), so a copied `localStorage` entry is useless on its own.
 */

/** What a vault implements. Keys arrive with the service's prefix already added. */
export interface SecureStorageDriver {
  /** Shown in devtools, such as `web-crypto` or `memory`. */
  name: string
  /** Backed by hardware or an OS vault (false for the web fallback). */
  secure: boolean
  /** Resolve the stored string, or null. */
  get(key: string): Promise<string | null>
  /** Store a string. */
  set(key: string, value: string): Promise<void>
  /** Delete a key. */
  remove(key: string): Promise<void>
  /** Every stored key. Optional: without it the service lists keys written this session. */
  keys?(): Promise<string[]>
}

/** Options for `config/secure-storage.ts` and `createSecureStorage()`. */
export interface SecureStorageConfig {
  /** Prefix for every key. Default `kitr:secure:`. */
  prefix?: string
  /** Replace the resolved driver (tests, custom vaults). */
  driver?: SecureStorageDriver
  /** Where the web fallback keeps the ciphertext. Default: the app's local storage driver. */
  storage?: StorageDriver
  /** Refuse to store anything when only the web fallback is available (production kiosks, banking). */
  requireSecure?: boolean
  /**
   * In a native shell (Electron, Tauri, Capacitor) with no vault driver, use the encrypted web
   * fallback inside the WebView instead of throwing `E_DRIVER_UNAVAILABLE`. The ciphertext and its
   * key then live in WebView storage, not the OS vault, so `secure` stays false. Default false.
   */
  fallbackToWeb?: boolean
}

/** The `secureStorage` service: async string storage over the vault, under one key prefix. */
export interface SecureStorage {
  /** The active driver. */
  readonly driver: SecureStorageDriver
  /** True when values live in an OS vault rather than the encrypted web fallback. */
  readonly secure: boolean
  /** Resolve the string stored under `key`, or null. */
  get(key: string): Promise<string | null>
  /** Store a string. Throws under `requireSecure` when no vault is registered. */
  set(key: string, value: string): Promise<void>
  /** Delete a key. */
  remove(key: string): Promise<void>
  /** Keys written through this service (not every item in the vault). */
  keys(): Promise<string[]>
  /** Remove every key `keys()` returns, leaving other prefixes alone. */
  clear(): Promise<void>
}

/** A typed secret bound to a `SecureStorage` service, as returned by calling a `defineSecureItem` result. */
export interface SecureItem<T> {
  /** The key, without the service prefix. */
  key: string
  /** Resolve the value, or undefined when missing. Corrupt or invalid values are removed. */
  get(): Promise<T | undefined>
  /** Store the value and notify this item's subscribers. */
  set(value: T): Promise<void>
  /** Delete the value and notify this item's subscribers with undefined. */
  remove(): Promise<void>
  /** Hear writes made through this bound item; returns an unsubscribe function. */
  subscribe(listener: (value: T | undefined) => void): () => void
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    'secure-storage': SecureStorageConfig
  }
  interface ContainerBindings {
    secureStorage: SecureStorage
  }
  interface DriverTypes {
    'secure-storage': SecureStorageDriver
  }
}

/** Types `config/secure-storage.ts`. Returns the object unchanged. */
export const defineConfig = createDefineConfig<SecureStorageConfig>()

/**
 * Build the `secureStorage` service. The driver is `config.driver`, else the vault registered on
 * `app`, else `selectDriver()` for the runtime: the encrypted web fallback in a browser, the memory driver on
 * the server, and `E_DRIVER_UNAVAILABLE` in a native shell unless `fallbackToWeb` is set.
 */
export function createSecureStorage(
  config: SecureStorageConfig = {},
  app?: KitrApp,
): SecureStorage {
  const prefix = config.prefix ?? 'kitr:secure:'
  const driver =
    config.driver ??
    app?.drivers.resolve('secure-storage') ??
    selectDriver(runtimeOf(app), { storage: config.storage, fallbackToWeb: config.fallbackToWeb })
  const log = (label: string, data?: unknown) =>
    app && getDevtools(app)?.log('secure-storage', label, data)
  const known = new Set<string>()
  const guard = () => {
    if (config.requireSecure && !driver.secure)
      throw new Error(
        '@kitr/secure-storage: no secure vault on this platform (requireSecure is on)',
      )
  }
  return {
    driver,
    secure: driver.secure,
    async get(key) {
      return driver.get(prefix + key)
    },
    async set(key, value) {
      guard()
      await driver.set(prefix + key, value)
      known.add(key)
      log('set', key)
    },
    async remove(key) {
      await driver.remove(prefix + key)
      known.delete(key)
      log('remove', key)
    },
    async keys() {
      const all = (await driver.keys?.()) ?? []
      const fromDriver = all.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length))
      return [...new Set([...fromDriver, ...known])]
    },
    async clear() {
      for (const key of await this.keys()) await this.remove(key)
    },
  }
}

/** Options for `defineSecureItem`: a schema to check reads and a codec for non-JSON values. */
export interface SecureItemOptions<T> {
  /** Validate what comes back from the vault; invalid values are removed. */
  schema?: StandardSchemaV1<unknown, T>
  /** Serialise with something other than JSON. */
  codec?: { encode(value: T): string; decode(raw: string): T }
}

/**
 * A typed, subscribable secret: `const session = defineSecureItem<Session>('session')`.
 * Call it with a service to bind it, `session(app.container.use('secureStorage'))`, or pass it to `useSecureItem`.
 */
export function defineSecureItem<T>(key: string, options: SecureItemOptions<T> = {}) {
  const codec = options.codec ?? {
    encode: (v: T) => JSON.stringify(v),
    decode: (raw: string) => JSON.parse(raw) as T,
  }
  return (storage: SecureStorage): SecureItem<T> => {
    const listeners = new Set<(value: T | undefined) => void>()
    const notify = (value: T | undefined) => {
      for (const l of listeners) l(value)
    }
    return {
      key,
      async get() {
        const raw = await storage.get(key)
        if (raw === null) return undefined
        try {
          const value = codec.decode(raw)
          if (options.schema) {
            const result = validateSync(options.schema, value)
            if (!result.success) {
              await storage.remove(key)
              return undefined
            }
            return result.data
          }
          return value
        } catch {
          await storage.remove(key)
          return undefined
        }
      },
      async set(value) {
        await storage.set(key, codec.encode(value))
        notify(value)
      },
      async remove() {
        await storage.remove(key)
        notify(undefined)
      },
      subscribe(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    }
  }
}

/** The app's `secureStorage` service, outside React. Same as `app.container.use('secureStorage')`. */
export function useSecureStorage(app: KitrApp): SecureStorage {
  return app.container.use('secureStorage')
}
