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

const serverUpdater = {
  state: serverState,
  subscribe: () => () => {},
  check: async () => null,
  apply: async () => {},
  dismiss: () => {},
} as unknown as Updater

/**
 * `{ status, update, progress, check, apply, dismiss }` for an "update ready" banner.
 * Hydration-safe: the server and first render see `idle`.
 */
export function useUpdate() {
  // The provider binds the updater in the browser only: during server rendering there is none,
  // and the hook answers `idle` instead of throwing.
  const container = useApp().container
  const updater = container.has('updater') ? container.use('updater') : serverUpdater
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
