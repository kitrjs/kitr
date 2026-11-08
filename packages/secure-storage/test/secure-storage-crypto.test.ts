import { createMemoryStorageDriver } from '@kitr/storage'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createMemorySecureStorageDriver,
  createSecureStorage,
  createWebSecureStorageDriver,
  defineSecureItem,
  type SecureStorageDriver,
} from '../src'

/** Just enough IndexedDB for the key store: one database, one object store, async requests. */
function fakeIndexedDB() {
  const data = new Map<string, unknown>()
  const request = <T>(run: () => T) => {
    const req: any = {}
    setTimeout(() => {
      try {
        req.result = run()
        req.onsuccess?.()
      } catch (error) {
        req.error = error
        req.onerror?.()
      }
    })
    return req
  }
  const store = {
    get: (k: string) => request(() => data.get(k)),
    put: (v: unknown, k: string) => request(() => void data.set(k, v)),
    add: (v: unknown, k: string) =>
      request(() => {
        if (data.has(k)) throw new DOMException('Key already exists', 'ConstraintError')
        data.set(k, v)
      }),
  }
  const db = { transaction: () => ({ objectStore: () => store }) }
  const factory = {
    open: () => {
      const req: any = { result: db }
      setTimeout(() => {
        req.onupgradeneeded?.()
        req.onsuccess?.()
      })
      return req
    },
  }
  ;(db as any).createObjectStore = () => store
  return { factory, data }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('web fallback encryption', () => {
  it('stores iv.ciphertext, with a fresh IV every write', async () => {
    const plain = createMemoryStorageDriver()
    const driver = createWebSecureStorageDriver(plain)
    await driver.set('k', 'same value')
    const first = plain.get('k')!
    await driver.set('k', 'same value')
    const second = plain.get('k')!
    expect(first).toMatch(/^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/)
    expect(first.split('.')[0]).not.toBe(second.split('.')[0])
    expect(first).not.toBe(second)
    expect(atob(first.split('.')[0]!)).toHaveLength(12)
  })

  it('round-trips unicode, empty and large values', async () => {
    const driver = createWebSecureStorageDriver(createMemoryStorageDriver())
    const values = ['', 'héllo wörld 🔐 日本語', 'x'.repeat(500_000)]
    for (const value of values) {
      await driver.set('k', value)
      expect(await driver.get('k')).toBe(value)
    }
  })

  it('rejects ciphertext moved from another key', async () => {
    const plain = createMemoryStorageDriver()
    const driver = createWebSecureStorageDriver(plain)
    await driver.set('refresh', 'refresh-token')
    await driver.set('access', 'access-token')
    plain.set('access', plain.get('refresh')!)
    expect(await driver.get('access')).toBeNull()
    expect(await driver.get('refresh')).toBe('refresh-token')
  })

  it('rejects tampered ciphertext and IVs, and drops the bad entry', async () => {
    const plain = createMemoryStorageDriver()
    const driver = createWebSecureStorageDriver(plain)
    await driver.set('k', 'value')
    const [iv, data] = plain.get('k')!.split('.')
    const bytes = Uint8Array.from(atob(data!), (c) => c.charCodeAt(0))
    bytes[0]! ^= 1
    plain.set('k', `${iv}.${btoa(String.fromCharCode(...bytes))}`)
    expect(await driver.get('k')).toBeNull()
    expect(plain.get('k')).toBeFalsy()

    await driver.set('k', 'value')
    const [, good] = plain.get('k')!.split('.')
    plain.set('k', `${btoa('\0'.repeat(12))}.${good}`)
    expect(await driver.get('k')).toBeNull()
    for (const junk of ['no-dot', '.', 'a.b.c', '!!!.???']) {
      plain.set('k', junk)
      expect(await driver.get('k')).toBeNull()
    }
  })

  it('cannot read values written by another key (another browser profile)', async () => {
    const plain = createMemoryStorageDriver()
    await createWebSecureStorageDriver(plain).set('k', 'secret')
    expect(await createWebSecureStorageDriver(plain).get('k')).toBeNull()
  })

  it('keeps one non-extractable key in IndexedDB and reuses it', async () => {
    const idb = fakeIndexedDB()
    vi.stubGlobal('indexedDB', idb.factory)
    const plain = createMemoryStorageDriver()
    await createWebSecureStorageDriver(plain).set('k', 'secret')
    const key = idb.data.get('aes-gcm') as CryptoKey
    expect(key).toBeDefined()
    expect(key.extractable).toBe(false)
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 })
    expect(key.usages.sort()).toEqual(['decrypt', 'encrypt'])
    // A reload: a new driver over the same storage and key store reads the value back.
    expect(await createWebSecureStorageDriver(plain).get('k')).toBe('secret')
  })

  it('two tabs racing on first use end up with the same key', async () => {
    const idb = fakeIndexedDB()
    vi.stubGlobal('indexedDB', idb.factory)
    const plain = createMemoryStorageDriver()
    const tabA = createWebSecureStorageDriver(plain)
    const tabB = createWebSecureStorageDriver(plain)
    await Promise.all([tabA.set('a', 'from A'), tabB.set('b', 'from B')])
    const reloaded = createWebSecureStorageDriver(plain)
    expect(await reloaded.get('a')).toBe('from A')
    expect(await reloaded.get('b')).toBe('from B')
  })

  it('fails loudly without Web Crypto', async () => {
    vi.stubGlobal('crypto', {})
    const driver = createWebSecureStorageDriver(createMemoryStorageDriver())
    await expect(driver.set('k', 'v')).rejects.toThrow()
  })
})

describe('createSecureStorage', () => {
  it('keeps prefixes apart and lists only its own keys', async () => {
    const driver = createMemorySecureStorageDriver()
    await driver.set('other:thing', 'x')
    const a = createSecureStorage({ driver, prefix: 'a:' })
    const b = createSecureStorage({ driver, prefix: 'b:' })
    await a.set('token', '1')
    await b.set('token', '2')
    expect(await a.get('token')).toBe('1')
    expect(await b.get('token')).toBe('2')
    expect(await a.keys()).toEqual(['token'])
    await a.clear()
    expect(await b.get('token')).toBe('2')
    expect(await driver.get('other:thing')).toBe('x')
  })

  it('uses kitr:secure: by default and the memory driver on the server', async () => {
    const storage = createSecureStorage()
    expect(storage.driver.name).toBe('memory')
    expect(storage.secure).toBe(false)
    await storage.set('k', 'v')
    expect(await storage.driver.get('kitr:secure:k')).toBe('v')
  })

  it('lists keys written this session when the driver cannot enumerate', async () => {
    const inner = createMemorySecureStorageDriver()
    const { keys: _drop, ...noKeys } = inner
    const storage = createSecureStorage({ driver: noKeys as SecureStorageDriver })
    await storage.set('a', '1')
    await storage.set('b', '2')
    await storage.remove('a')
    expect(await storage.keys()).toEqual(['b'])
  })

  it('requireSecure blocks writes but still allows reads and removal', async () => {
    const driver = createMemorySecureStorageDriver()
    await driver.set('kitr:secure:old', 'v')
    const storage = createSecureStorage({ driver, requireSecure: true })
    await expect(storage.set('k', 'v')).rejects.toThrow(/requireSecure/)
    expect(await driver.get('kitr:secure:k')).toBeNull()
    expect(await storage.get('old')).toBe('v')
    await storage.remove('old')
    expect(await storage.get('old')).toBeNull()
    const vault = createSecureStorage({ driver: { ...driver, secure: true }, requireSecure: true })
    await expect(vault.set('k', 'v')).resolves.toBeUndefined()
  })
})

describe('defineSecureItem', () => {
  it('returns undefined for missing values and removes corrupt JSON', async () => {
    const storage = createSecureStorage({ driver: createMemorySecureStorageDriver() })
    const item = defineSecureItem<{ a: number }>('item')(storage)
    expect(await item.get()).toBeUndefined()
    await storage.set('item', '{not json')
    expect(await item.get()).toBeUndefined()
    expect(await storage.get('item')).toBeNull()
  })

  it('uses a custom codec and stops notifying after unsubscribe', async () => {
    const storage = createSecureStorage({ driver: createMemorySecureStorageDriver() })
    const item = defineSecureItem<Date>('when', {
      codec: { encode: (d) => String(d.getTime()), decode: (s) => new Date(Number(s)) },
    })(storage)
    const seen: unknown[] = []
    const off = item.subscribe((v) => seen.push(v))
    await item.set(new Date(5))
    expect(await storage.get('when')).toBe('5')
    expect((await item.get())?.getTime()).toBe(5)
    off()
    await item.remove()
    expect(seen).toHaveLength(1)
  })
})
