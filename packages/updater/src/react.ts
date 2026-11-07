import { useApp } from '@kitr/react'
import { useCallback, useSyncExternalStore } from 'react'
import type { Updater, UpdaterState } from './index'

/** The app's `updater` service in a component. Only bound in the browser. */
export function useUpdater(): Updater {
  return useApp().container.use('updater')
}

const serverState: UpdaterState = {
  status: 'idle',
  update: null,
  progress: 0,
  error: null,
  currentVersion: null,
}

/**
 * `{ status, update, progress, check, apply, dismiss }` for an "update ready" banner.
 * Hydration-safe: the server and first render see `idle`.
 */
export function useUpdate() {
  const updater = useUpdater()
  const subscribe = useCallback((notify: () => void) => updater.subscribe(notify), [updater])
  const state = useSyncExternalStore(
    subscribe,
    () => updater.state,
    () => serverState,
  )
  return {
    ...state,
    available: state.status === 'available' || state.status === 'ready',
    check: updater.check,
    apply: updater.apply,
    dismiss: updater.dismiss,
  }
}
