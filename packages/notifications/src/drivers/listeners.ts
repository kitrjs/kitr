import type { NotificationTap } from '../index'

export type Listener = (tap: NotificationTap) => void

export function listenerSet() {
  const listeners = new Set<Listener>()
  return {
    on(listener: Listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    emit(tap: NotificationTap) {
      for (const l of listeners) l(tap)
    },
  }
}
