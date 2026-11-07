import {
  createDefineConfig,
  getDevtools,
  type KitrApp,
  type StandardSchemaV1,
  validateSync,
} from '@kitr/core'
import { createMemoryStorageDriver, getStorageDriver, type StorageDriver } from '@kitr/storage'

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

/* ----------------------------------------------------------------------------
 * Web fallback: AES-GCM with a non-extractable key held in IndexedDB
 * ------------------------------------------------------------------------- */

const DB_NAME = 'kitr-secure-storage'
const KEY_ID = 'aes-gcm'

function idb(): IDBFactory | undefined {
  return typeof indexedDB === 'undefined' ? undefined : indexedDB
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = idb()!.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore('keys')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
) {
  return new Promise<T>((resolve, reject) => {
    const req = run(db.transaction('keys', mode).objectStore('keys'))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function loadOrCreateKey(): Promise<CryptoKey> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error('kitr/secure-storage: Web Crypto is not available')
  const db = idb() ? await openDb() : undefined
  const existing = db
    ? await tx<CryptoKey | undefined>(db, 'readonly', (s) => s.get(KEY_ID))
    : undefined
  if (existing) return existing
  const key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ])
  if (!db) return key
  // `add`, not `put`: when two tabs race on first use, the second must adopt the first tab's key
  // rather than overwrite it and leave everything the first tab wrote undecryptable.
  try {
    await tx(db, 'readwrite', (s) => s.add(key, KEY_ID))
    return key
  } catch {
    const winner = await tx<CryptoKey | undefined>(db, 'readonly', (s) => s.get(KEY_ID))
    if (winner) return winner
    throw new Error('kitr/secure-storage: could not store the encryption key')
  }
}

// Chunked: spreading a large Uint8Array into fromCharCode overflows the call stack.
const toBase64 = (bytes: Uint8Array) => {
  let text = ''
  for (let i = 0; i < bytes.length; i += 0x8000)
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(text)
}
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))
/** The storage key is authenticated with each value, so ciphertext moved to another key fails. */
const aad = (key: string) => new TextEncoder().encode(`kitr-secure:${key}`)

/**
 * Encrypts values with AES-GCM before handing them to a `StorageDriver`. The key never leaves
 * the browser's key store, so the ciphertext in local storage cannot be read elsewhere.
 */
export function createWebSecureStorageDriver(storage?: StorageDriver): SecureStorageDriver {
  const store = storage ?? getStorageDriver('local') ?? createMemoryStorageDriver('secure')
  let keyPromise: Promise<CryptoKey> | undefined
  const key = () => (keyPromise ??= loadOrCreateKey())
  return {
    name: 'web-crypto',
    secure: false,
    async get(k) {
      const raw = store.get(k)
      if (!raw) return null
      try {
        const [ivText, dataText] = raw.split('.')
        const plain = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: fromBase64(ivText!), additionalData: aad(k) },
          await key(),
          fromBase64(dataText!),
        )
        return new TextDecoder().decode(plain)
      } catch {
        store.remove(k)
        return null
      }
    },
    async set(k, value) {
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const data = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: aad(k) },
        await key(),
        new TextEncoder().encode(value),
      )
      store.set(k, `${toBase64(iv)}.${toBase64(new Uint8Array(data))}`)
    },
    async remove(k) {
      store.remove(k)
    },
    keys: async () => store.keys(),
  }
}

/**
 * Build the `secureStorage` service. The driver is `config.driver`, else the vault registered on
 * `app`, else the encrypted web fallback in a browser or the memory driver on the server.
 */
export function createSecureStorage(
  config: SecureStorageConfig = {},
  app?: KitrApp,
): SecureStorage {
  const prefix = config.prefix ?? 'kitr:secure:'
  const driver =
    config.driver ??
    app?.drivers.resolve('secure-storage') ??
    (typeof window === 'undefined'
      ? createMemorySecureStorageDriver()
      : createWebSecureStorageDriver(config.storage))
  const log = (label: string, data?: unknown) =>
    app && getDevtools(app)?.log('secure-storage', label, data)
  const known = new Set<string>()
  const guard = () => {
    if (config.requireSecure && !driver.secure)
      throw new Error('kitr/secure-storage: no secure vault on this platform (requireSecure is on)')
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
