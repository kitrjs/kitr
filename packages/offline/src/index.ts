import { createDefineConfig, getDevtools, type KitrApp, type OperationRegistry } from '@kitr/core'
import {
  type DehydratedState,
  dehydrate,
  hydrate,
  type MutationDefinition,
  mutationKeyFor,
  onlineManager,
  type QueryClient,
  type QueryKey,
} from '@kitr/query'
import { createMemoryStorageDriver, getStorageDriver, type StorageDriver } from '@kitr/storage'

/** Options for `config/offline.ts`: how long, where and what of the query cache is kept on the device. */
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

/** The `offline` service: restores and saves the query cache snapshot and reports network state. */
export interface Offline {
  /** Load a stored snapshot into the client, if fresh. Resolves with whether one was found. */
  restore(): Promise<boolean>
  /** Write the current cache now (the provider does it on a throttle). */
  persist(): void
  /** Forget the snapshot. */
  clear(): void
  /** Mutations waiting for the network. */
  pendingMutations(): number
  /** Whether TanStack Query's `onlineManager` currently says online. */
  isOnline(): boolean
  /** Called after a restore, after each throttled save, and when online state changes. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void
  /** True once `restore()` loaded a snapshot into the client. */
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

/** Type-checks `config/offline.ts`. Returns the object unchanged. */
export const defineConfig = createDefineConfig<OfflineConfig>()

interface Snapshot {
  at: number
  buster?: string
  state: DehydratedState
}

/**
 * Build the offline service for a QueryClient: it saves successful queries and paused mutations
 * to storage on a throttle (and when the page is hidden), and can restore them into the client.
 */
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
        if (app) registerMutationDefaults(client, app.operations)
        hydrate(client, snap.state)
        restored = true
        // TanStack resumes paused mutations when the network comes back; when it is already
        // back by the time the snapshot loads, nothing would, so resume them now.
        if (snap.state.mutations.length && onlineManager.isOnline())
          void client.resumePausedMutations().catch((error) => log('resume failed', error))
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
  // A mutation queued in the last second before the tab closes (or the app is backgrounded and
  // killed) must still be written: flush the throttle instead of dropping it.
  const flush = () => {
    if (!timer) return
    clearTimeout(timer)
    timer = undefined
    offline.persist()
  }
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
  }
  onlineManager.subscribe(notify)
  return offline
}

/**
 * A mutation restored from a snapshot has its key and input but no `mutationFn`: functions do
 * not survive a reload. Give every named mutation (`defineMutation('projects.rename', ...)` in
 * kitr/actions, or one registered in the app's `operations`) its defaults by name, so a mutation
 * paused offline still runs, with its cache effects, after the app restarts. Mutations without a
 * name need `queryClient.setMutationDefaults(key, { mutationFn })` and the same `mutationKey`.
 * `createOffline` does this from `app.operations` when it is given the app.
 */
export function registerMutationDefaults(client: QueryClient, operations: OperationRegistry): void {
  for (const name of operations.names()) {
    const op = operations.get(name)
    if (op.kind !== 'mutation') continue
    const definition = op as unknown as MutationDefinition<unknown, unknown>
    client.setMutationDefaults(mutationKeyFor(name), definition.options({ queryClient: client }))
  }
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

/** The `offline` service from an app's container, for code outside React. Bound on the client only. */
export function useOffline(app: KitrApp): Offline {
  return app.container.use('offline')
}
