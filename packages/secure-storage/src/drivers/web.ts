import { createMemoryStorageDriver, getStorageDriver, type StorageDriver } from '@kitr/storage'
import type { SecureStorageDriver } from '../index'

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
