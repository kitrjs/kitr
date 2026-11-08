import { useApp } from '@kitr/react'
import { useCallback, useSyncExternalStore } from 'react'

// kitr-allow-module-state: constant server snapshot for useSyncExternalStore, never mutated
const serverOffline = {
  subscribe: () => () => {},
  isOnline: () => true,
  pendingMutations: () => 0,
  restored: false,
  clear: () => {},
  persist: () => {},
}

/**
 * `{ online, pending, restored }`: whether the network is up, how many mutations wait for it,
 * and whether the cache came from a stored snapshot. Hydration-safe: the server says online.
 */
export function useOffline() {
  // Bound in the browser only: during server rendering the hook answers "online, nothing pending".
  const container = useApp().container
  const offline = container.has('offline') ? container.use('offline') : serverOffline
  const subscribe = useCallback((notify: () => void) => offline.subscribe(notify), [offline])
  const online = useSyncExternalStore(
    subscribe,
    () => offline.isOnline(),
    () => true,
  )
  const pending = useSyncExternalStore(
    subscribe,
    () => offline.pendingMutations(),
    () => 0,
  )
  const restored = useSyncExternalStore(
    subscribe,
    () => offline.restored,
    () => false,
  )
  return { online, pending, restored, clear: offline.clear, persist: offline.persist }
}
