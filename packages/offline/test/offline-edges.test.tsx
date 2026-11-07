import { onlineManager, QueryClient } from '@kitr/query'
import { createMemoryStorageDriver, type StorageDriver } from '@kitr/storage'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindOnlineManager, createOffline } from '../src'

afterEach(() => {
  onlineManager.setOnline(true)
  vi.useRealTimers()
})

describe('offline persistence edges', () => {
  it('writes a pending change when the tab is hidden or closed, before the throttle', async () => {
    const storage = createMemoryStorageDriver()
    const client = new QueryClient()
    createOffline(client, { storage, throttle: 60_000 })
    client.setQueryData(['draft'], 'unsaved work')
    expect(storage.get('kitr:query-cache')).toBeFalsy()
    window.dispatchEvent(new Event('pagehide'))
    expect(JSON.parse(storage.get('kitr:query-cache')!).state.queries[0].state.data).toBe(
      'unsaved work',
    )

    client.setQueryData(['draft'], 'more')
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    expect(JSON.parse(storage.get('kitr:query-cache')!).state.queries[0].state.data).toBe('more')
  })

  it('batches a burst of changes into one write', async () => {
    vi.useFakeTimers()
    const storage = createMemoryStorageDriver()
    const set = vi.spyOn(storage, 'set')
    const client = new QueryClient()
    createOffline(client, { storage, throttle: 100 })
    for (let i = 0; i < 20; i++) client.setQueryData(['n', i], i)
    vi.advanceTimersByTime(100)
    expect(set).toHaveBeenCalledTimes(1)
  })

  it('persists only the queries include() allows', () => {
    const storage = createMemoryStorageDriver()
    const client = new QueryClient()
    client.setQueryData(['public', 1], 'p')
    client.setQueryData(['private', 'token'], 's')
    createOffline(client, { storage, include: (key) => key[0] === 'public' }).persist()
    const keys = JSON.parse(storage.get('kitr:query-cache')!).state.queries.map(
      (q: any) => q.queryKey,
    )
    expect(keys).toEqual([['public', 1]])
  })

  it('throws away corrupt snapshots instead of crashing the boot', async () => {
    for (const raw of [
      '{not json',
      '"string"',
      '{"at":0}',
      'null',
      '{"at":1e20,"state":{"queries":1}}',
    ]) {
      const storage = createMemoryStorageDriver()
      storage.set('kitr:query-cache', raw)
      const offline = createOffline(new QueryClient(), { storage })
      await expect(offline.restore()).resolves.toBe(false)
      expect(storage.get('kitr:query-cache')).toBeFalsy()
    }
  })

  it('keeps going when storage is full', () => {
    const full: StorageDriver = {
      ...createMemoryStorageDriver(),
      set: () => {
        throw new DOMException('quota', 'QuotaExceededError')
      },
    }
    const client = new QueryClient()
    client.setQueryData(['k'], 'v'.repeat(1000))
    expect(() => createOffline(client, { storage: full }).persist()).not.toThrow()
  })

  it('uses a custom key, and a snapshot exactly at maxAge is still fresh', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const storage = createMemoryStorageDriver()
    const client = new QueryClient()
    client.setQueryData(['k'], 1)
    createOffline(client, { storage, key: 'mine', maxAge: 1000 }).persist()
    expect(storage.get('mine')).toBeTruthy()
    vi.setSystemTime(Date.now() + 1000)
    expect(
      await createOffline(new QueryClient(), { storage, key: 'mine', maxAge: 1000 }).restore(),
    ).toBe(true)
  })

  it('notifies subscribers on restore and on online changes', async () => {
    const storage = createMemoryStorageDriver()
    const client = new QueryClient()
    client.setQueryData(['k'], 1)
    createOffline(client, { storage }).persist()
    const offline = createOffline(new QueryClient(), { storage })
    const listener = vi.fn()
    const off = offline.subscribe(listener)
    await offline.restore()
    onlineManager.setOnline(false)
    expect(listener).toHaveBeenCalledTimes(2)
    off()
    onlineManager.setOnline(true)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('bindOnlineManager follows the platform', () => {
    let emit: (online: boolean) => void = () => {}
    const unbind = vi.fn()
    bindOnlineManager({
      isOnline: () => false,
      onOnline: (l) => {
        emit = l
        return unbind
      },
    })
    expect(onlineManager.isOnline()).toBe(false)
    emit(true)
    expect(onlineManager.isOnline()).toBe(true)
    emit(false)
    expect(onlineManager.isOnline()).toBe(false)
    onlineManager.setEventListener(() => () => {})
    expect(unbind).toHaveBeenCalled()
  })
})
