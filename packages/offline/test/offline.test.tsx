import { createApp } from '@kitr/core'
import { onlineManager, QueryClient } from '@kitr/query'
import queryProvider from '@kitr/query/provider'
import { createMemoryStorageDriver } from '@kitr/storage'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOffline } from '../src'
import offlineProvider from '../src/provider'

afterEach(() => onlineManager.setOnline(true))

describe('offline', () => {
  it('persists successful queries and restores them into a fresh client', async () => {
    const storage = createMemoryStorageDriver()
    const client = new QueryClient()
    const offline = createOffline(client, { storage, throttle: 1 })
    await client.fetchQuery({ queryKey: ['todos'], queryFn: async () => [1, 2] })
    await client.prefetchQuery({
      queryKey: ['bad'],
      queryFn: async () => Promise.reject(new Error('x')),
      retry: false,
    })
    await vi.waitFor(() => expect(storage.get('kitr:query-cache')).toBeTruthy())

    const next = new QueryClient()
    const restored = createOffline(next, { storage })
    expect(await restored.restore()).toBe(true)
    expect(next.getQueryData(['todos'])).toEqual([1, 2])
    expect(next.getQueryData(['bad'])).toBeUndefined()
    expect(restored.restored).toBe(true)
    offline.clear()
    expect(await createOffline(new QueryClient(), { storage }).restore()).toBe(false)
  })

  it('drops stale and busted snapshots', async () => {
    const storage = createMemoryStorageDriver()
    const client = new QueryClient()
    client.setQueryData(['k'], 1)
    createOffline(client, { storage, buster: 'v1' }).persist()
    expect(await createOffline(new QueryClient(), { storage, buster: 'v2' }).restore()).toBe(false)
    createOffline(client, { storage, buster: 'v1' }).persist()
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000)
    expect(await createOffline(new QueryClient(), { storage, buster: 'v1' }).restore()).toBe(false)
    vi.useRealTimers()
  })

  it('keeps paused mutations and counts them', async () => {
    const storage = createMemoryStorageDriver()
    const client = new QueryClient()
    client.mount() // QueryClientProvider does this in the app; it is what resumes paused mutations
    const offline = createOffline(client, { storage, throttle: 1 })
    onlineManager.setOnline(false)
    const run = vi.fn(async (n: number) => n)
    const m = client.getMutationCache().build(client, { mutationKey: ['add'], mutationFn: run })
    void m.execute(1)
    await vi.waitFor(() => expect(offline.pendingMutations()).toBe(1))
    expect(offline.isOnline()).toBe(false)
    await vi.waitFor(() =>
      expect(JSON.parse(storage.get('kitr:query-cache')!).state.mutations).toHaveLength(1),
    )
    onlineManager.setOnline(true)
    await vi.waitFor(() => expect(run).toHaveBeenCalledWith(1, expect.anything()))
    client.unmount()
  })

  it('restores at boot through the provider', async () => {
    const storage = createMemoryStorageDriver()
    const seed = new QueryClient()
    seed.setQueryData(['me'], { name: 'Ada' })
    createOffline(seed, { storage }).persist()
    const app = createApp({
      environment: 'client',
      providers: [queryProvider, offlineProvider],
      config: { offline: { storage } },
    })
    await app.boot()
    expect(app.container.use('queryClient').getQueryData(['me'])).toEqual({ name: 'Ada' })
    expect(app.container.use('offline').restored).toBe(true)
  })
})
