import { createDefineConfig, getDevtools, type KitrApp } from '@kitr/core'
import {
  type DehydratedState,
  dehydrate,
  hydrate,
  onlineManager,
  type QueryClient,
  type QueryKey,
} from '@kitr/query'
import { createMemoryStorageDriver, getStorageDriver, type StorageDriver } from '@kitr/storage'

export interface OfflineConfig {
  /** Storage key for the cache snapshot. Default `kitr:query-cache`. */
  key?: string
  /** Milliseconds a snapshot stays usable. Default 24 hours. */
  maxAge?: number
  /** Persist only queries whose key passes; default: every successful query. */
  include?: (queryKey: QueryKey) => boolean
  /** Milliseconds to wait after a change before writing. Default 1000. */
  throttle?: number
  /** Where the snapshot lives. Default: the app's local storage driver (native on desktop/mobile). */
  storage?: StorageDriver
  /** A string that invalidates old snapshots when the data shape changes (app version). */
  buster?: string
}

export interface Offline {
  /** Load a stored snapshot into the client, if fresh. Resolves with whether one was found. */
  restore(): Promise<boolean>
  /** Write the current cache now (the provider does it on a throttle). */
  persist(): void
  /** Forget the snapshot. */
  clear(): void
  /** Mutations waiting for the network. */
  pendingMutations(): number
  isOnline(): boolean
  subscribe(listener: () => void): () => void
  readonly restored: boolean
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    offline: OfflineConfig
  }
  interface ContainerBindings {
    offline: Offline
  }
}

export const defineConfig = createDefineConfig<OfflineConfig>()

interface Snapshot {
  at: number
  buster?: string
  state: DehydratedState
}

export function createOffline(
  client: QueryClient,
  config: OfflineConfig = {},
  app?: KitrApp,
): Offline {
  const key = config.key ?? 'kitr:query-cache'
  const maxAge = config.maxAge ?? 24 * 60 * 60 * 1000
  const storage =
    config.storage ?? getStorageDriver('local') ?? createMemoryStorageDriver('offline')
  const listeners = new Set<() => void>()
  let restored = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const notify = () => {
    for (const l of listeners) l()
  }
  const log = (label: string, data?: unknown) =>
    app && getDevtools(app)?.log('offline', label, data)

  const offline: Offline = {
    get restored() {
      return restored
    },
    async restore() {
      const raw = storage.get(key)
      if (!raw) return false
      try {
        const snap = JSON.parse(raw) as Snapshot
        if (snap.buster !== config.buster || Date.now() - snap.at > maxAge) {
          storage.remove(key)
          return false
        }
        hydrate(client, snap.state)
        restored = true
        log('restored', {
          queries: snap.state.queries.length,
          mutations: snap.state.mutations.length,
        })
        notify()
        return true
      } catch {
        storage.remove(key)
        return false
      }
    },
    persist() {
      const state = dehydrate(client, {
        shouldDehydrateQuery: (q) =>
          q.state.status === 'success' && (config.include ? config.include(q.queryKey) : true),
        shouldDehydrateMutation: (m) => m.state.isPaused === true,
      })
      try {
        storage.set(
          key,
          JSON.stringify({ at: Date.now(), buster: config.buster, state } satisfies Snapshot),
        )
      } catch (error) {
        log('persist failed', error)
      }
    },
    clear() {
      storage.remove(key)
    },
    pendingMutations: () =>
      client
        .getMutationCache()
        .getAll()
        .filter((m) => m.state.isPaused).length,
    isOnline: () => onlineManager.isOnline(),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }

  const schedule = () => {
    if (timer) return
    timer = setTimeout(() => {
      timer = undefined
      offline.persist()
      notify()
    }, config.throttle ?? 1000)
  }
  client.getQueryCache().subscribe(schedule)
  client.getMutationCache().subscribe(schedule)
  onlineManager.subscribe(notify)
  return offline
}

/** Let TanStack Query's online state follow the platform driver (native shells report it better than `navigator.onLine`). */
export function bindOnlineManager(platform: {
  isOnline(): boolean
  onOnline(l: (online: boolean) => void): () => void
}) {
  onlineManager.setEventListener((setOnline) => {
    setOnline(platform.isOnline())
    return platform.onOnline(setOnline)
  })
}

export function useOffline(app: KitrApp): Offline {
  return app.container.use('offline')
}
