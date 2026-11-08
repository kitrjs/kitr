import { registerShellModules } from '@kitr/platform'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { selectDriver } from '../src'
import { createTauriDriver } from '../src/drivers/tauri'

const bytes = (text: string) => Array.from(new TextEncoder().encode(text))

/** A Stronghold whose store is a Map, with the calls the driver makes recorded. */
function fakeStronghold(options: { existingClient?: boolean } = {}) {
  const data = new Map<string, number[]>()
  const store = {
    get: vi.fn(async (key: string) => (data.has(key) ? Uint8Array.from(data.get(key)!) : null)),
    insert: vi.fn(async (key: string, value: number[]) => void data.set(key, value)),
    remove: vi.fn(async (key: string) => {
      data.delete(key)
      return null
    }),
  }
  const client = { getStore: () => store }
  const hold = {
    loadClient: vi.fn(async () => {
      if (!options.existingClient) throw new Error('client not found')
      return client
    }),
    createClient: vi.fn(async () => client),
    save: vi.fn(async () => {}),
  }
  const load = vi.fn(async () => hold)
  const invoke = vi.fn(async () => 'keyring-secret')
  registerShellModules({
    '@tauri-apps/plugin-stronghold': async () => ({ Stronghold: { load } }),
    '@tauri-apps/api/path': async () => ({ appDataDir: async () => '/data/app/' }),
    '@tauri-apps/api/core': async () => ({ invoke }),
  })
  return { data, store, hold, load, invoke }
}

function missing(...specifiers: string[]) {
  registerShellModules(
    Object.fromEntries(
      specifiers.map((s) => [
        s,
        async () => {
          throw new Error(`cannot find ${s}`)
        },
      ]),
    ),
  )
}

afterEach(() => vi.restoreAllMocks())

describe('tauri secure-storage driver', () => {
  it('is returned by selectDriver("tauri") without loading anything', () => {
    expect(selectDriver('tauri').name).toBe('tauri-stronghold')
    expect(createTauriDriver().secure).toBe(true)
  })

  it('opens the snapshot with the keyring secret, creating the client once', async () => {
    const { load, hold, invoke } = fakeStronghold()
    const driver = createTauriDriver()
    await driver.set('token', 'abc')
    await driver.set('other', 'x')
    expect(invoke).toHaveBeenCalledWith('kitr_vault_key')
    expect(load).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledWith('/data/app/kitr-vault.hold', 'keyring-secret')
    expect(hold.createClient).toHaveBeenCalledWith('kitr')
    expect(hold.save).toHaveBeenCalledTimes(2)
  })

  it('stores, reads, lists and removes values', async () => {
    const { store, data } = fakeStronghold({ existingClient: true })
    const driver = createTauriDriver()
    expect(await driver.get('token')).toBeNull()
    await driver.set('token', 'abc')
    await driver.set('token', 'abd')
    await driver.set('session', 'x')
    expect(data.get('token')).toEqual(bytes('abd'))
    expect(await driver.get('token')).toBe('abd')
    expect(await driver.keys?.()).toEqual(['token', 'session'])
    await driver.remove('token')
    expect(store.remove).toHaveBeenCalledWith('token')
    expect(await driver.get('token')).toBeNull()
    expect(await driver.keys?.()).toEqual(['session'])
  })

  it('serialises concurrent writes so no key is lost from the list', async () => {
    fakeStronghold()
    const driver = createTauriDriver()
    await Promise.all(['a', 'b', 'c'].map((k) => driver.set(k, k)))
    expect(await driver.keys?.()).toEqual(['a', 'b', 'c'])
  })

  it('keeps the queue alive after a failed write', async () => {
    const { store } = fakeStronghold()
    store.insert.mockRejectedValueOnce(new Error('disk full'))
    const driver = createTauriDriver()
    await expect(driver.set('a', '1')).rejects.toThrow('disk full')
    await driver.set('b', '2')
    expect(await driver.get('b')).toBe('2')
  })

  it('uses a password and file given in the options', async () => {
    const { load, invoke } = fakeStronghold()
    const password = vi.fn(async () => 'typed by the person')
    await createTauriDriver({ password, file: 'vault.hold', client: 'acme' }).set('a', 'b')
    expect(invoke).not.toHaveBeenCalled()
    expect(load).toHaveBeenCalledWith('/data/app/vault.hold', 'typed by the person')
  })

  it('rejects with E_DRIVER_UNAVAILABLE naming the stronghold plugin when it is missing', async () => {
    missing('@tauri-apps/plugin-stronghold')
    const error = await createTauriDriver()
      .get('a')
      .catch((e) => e)
    expect(error).toMatchObject({ code: 'E_DRIVER_UNAVAILABLE' })
    expect(error.message).toContain('@tauri-apps/plugin-stronghold')
    expect(error.message).toContain('@kitr/secure-storage')
    expect(error.message).toContain('tauri')
  })

  it('rejects with E_DRIVER_UNAVAILABLE when @tauri-apps/api is missing, and retries once it is there', async () => {
    fakeStronghold()
    missing('@tauri-apps/api/path')
    const driver = createTauriDriver()
    await expect(driver.get('a')).rejects.toMatchObject({ code: 'E_DRIVER_UNAVAILABLE' })
    fakeStronghold()
    expect(await driver.get('a')).toBeNull()
  })
})
