import { createContext, type ReactNode, useContext, useRef, useSyncExternalStore } from 'react'
import { createStore as createVanillaStore, type StateCreator, type StoreApi } from 'zustand'
import { devtools, type PersistOptions, persist } from 'zustand/middleware'

export interface KitrStoreOptions<T> {
  /** Name for devtools and persistence. */
  name: string
  /** Persist to storage (localStorage by default). Only the client ever reads it. */
  persist?: Partial<PersistOptions<T, Partial<T>>> | boolean
  devtools?: boolean
}

/**
 * An SSR-safe Zustand store factory. On the client the store is a module-level
 * singleton; on the server (or in tests) you get a fresh store per `<StoreProvider>`,
 * so one user's state never leaks into another's render.
 *
 *   const [useCounter, CounterProvider, counterStore] = createKitrStore({ name: 'counter' }, (set) => ({ ... }))
 */
export function createKitrStore<T extends object>(
  options: KitrStoreOptions<T>,
  initializer: StateCreator<T, [], []>,
) {
  const build = (initialState?: Partial<T>): StoreApi<T> => {
    let creator: StateCreator<T, any, any> = initialState
      ? (set, get, api) => ({ ...initializer(set, get, api), ...initialState })
      : initializer
    if (options.persist && typeof window !== 'undefined') {
      const persistOptions = typeof options.persist === 'object' ? options.persist : {}
      creator = persist(creator, {
        name: `kitr:${options.name}`,
        ...persistOptions,
      }) as StateCreator<T, any, any>
    }
    if (
      options.devtools !== false &&
      typeof window !== 'undefined' &&
      (import.meta as any).env?.DEV
    ) {
      creator = devtools(creator, { name: options.name }) as StateCreator<T, any, any>
    }
    return createVanillaStore<T>(creator)
  }

  const isClient = typeof window !== 'undefined'
  const singleton: StoreApi<T> | null = isClient ? build() : null
  const Context = createContext<StoreApi<T> | null>(null)

  function StoreProvider({
    children,
    initialState,
  }: {
    children: ReactNode
    initialState?: Partial<T>
  }) {
    const ref = useRef<StoreApi<T> | null>(null)
    if (!ref.current) {
      // On the server the initial state is baked into a fresh store, so SSR renders it.
      ref.current = singleton ?? build(initialState)
      if (singleton && initialState) singleton.setState(initialState as T)
    }
    return <Context.Provider value={ref.current}>{children}</Context.Provider>
  }

  function useKitrStore(): T
  function useKitrStore<U>(selector: (state: T) => U): U
  function useKitrStore<U>(selector?: (state: T) => U) {
    const fromContext = useContext(Context)
    const store = fromContext ?? singleton
    if (!store) {
      throw new Error(
        `[kitr/state] Store "${options.name}" has no instance on the server. Wrap the tree in its <StoreProvider>.`,
      )
    }
    const select = (selector ?? ((s) => s)) as (state: T) => U
    // The server snapshot is the current state (not zustand's initial state), so a store
    // seeded through <StoreProvider initialState> renders the same on server and client.
    const snapshot = () => select(store.getState())
    return useSyncExternalStore(store.subscribe, snapshot, snapshot)
  }

  /** The client singleton, for use outside React (actions, loaders). Null on the server. */
  const store = singleton

  return [useKitrStore, StoreProvider, store] as const
}
