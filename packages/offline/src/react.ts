import { useApp } from '@kitr/react'
import { useCallback, useSyncExternalStore } from 'react'

/**
 * `{ online, pending, restored }`: whether the network is up, how many mutations wait for it,
 * and whether the cache came from a stored snapshot. Hydration-safe: the server says online.
 */
export function useOffline() {
  const offline = useApp().container.use('offline')
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
