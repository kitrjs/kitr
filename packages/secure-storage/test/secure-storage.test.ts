import { createApp } from '@kitr/core'
import { createMemoryStorageDriver } from '@kitr/storage'
import { describe, expect, it } from 'vitest'
import {
  createMemorySecureStorageDriver,
  createSecureStorage,
  createWebSecureStorageDriver,
  defineSecureItem,
} from '../src'
import secureStorageProvider from '../src/provider'

describe('secure-storage', () => {
  it('prefixes keys, lists and clears them', async () => {
    const driver = createMemorySecureStorageDriver()
    const storage = createSecureStorage({ driver, prefix: 'app:' })
    await storage.set('token', 'abc')
    expect(await driver.get('app:token')).toBe('abc')
    expect(await storage.get('token')).toBe('abc')
    expect(await storage.keys()).toEqual(['token'])
    await storage.clear()
    expect(await storage.get('token')).toBeNull()
  })

  it('encrypts on the web fallback so storage holds no plaintext', async () => {
    const plain = createMemoryStorageDriver()
    const storage = createSecureStorage({ driver: createWebSecureStorageDriver(plain), prefix: '' })
    await storage.set('token', 'secret-value')
    expect(plain.get('token')).not.toContain('secret-value')
    expect(await storage.get('token')).toBe('secret-value')
    plain.set('token', 'garbage')
    expect(await storage.get('token')).toBeNull()
  })

  it('refuses to store without a vault when requireSecure is on', async () => {
    const storage = createSecureStorage({
      driver: createMemorySecureStorageDriver(),
      requireSecure: true,
    })
    await expect(storage.set('k', 'v')).rejects.toThrow(/requireSecure/)
  })

  it('typed items validate, notify and bind through the provider', async () => {
    const app = createApp({ environment: 'client', providers: [secureStorageProvider] })
    app.drivers.register('secure-storage', {
      ...createMemorySecureStorageDriver('vault'),
      secure: true,
    })
    await app.boot()
    const storage = app.container.use('secureStorage')
    expect(storage.secure).toBe(true)
    const session = defineSecureItem<{ id: number }>('session', {
      schema: {
        '~standard': {
          version: 1,
          vendor: 'test',
          validate: (v) =>
            typeof (v as { id?: unknown })?.id === 'number'
              ? { value: v as { id: number } }
              : { issues: [{ message: 'bad' }] },
        },
      },
    })(storage)
    const seen: unknown[] = []
    session.subscribe((v) => seen.push(v))
    await session.set({ id: 1 })
    expect(await session.get()).toEqual({ id: 1 })
    await storage.set('session', JSON.stringify({ id: 'nope' }))
    expect(await session.get()).toBeUndefined()
    await session.remove()
    expect(seen).toEqual([{ id: 1 }, undefined])
  })
})
