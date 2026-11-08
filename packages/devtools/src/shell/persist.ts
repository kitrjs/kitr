const KEY = 'kitr:devtools'

/** What the shell remembers between visits, under `localStorage['kitr:devtools']`. */
export interface Persisted {
  open?: boolean
  tab?: string
  dock?: 'bottom' | 'right'
  size?: { bottom?: number; right?: number }
  sheet?: 'half' | 'full'
  trigger?: { edge: 'left' | 'right'; y: number }
  theme?: 'light' | 'dark'
  recent?: string[]
  /** Written by the log panel; the shell keeps it intact when merging. */
  log?: unknown
}

/** What lives for the browser session only (`sessionStorage`). */
export interface SessionState {
  hiddenUntil?: boolean
}

function read<T>(store: () => Storage): T {
  try {
    const value = JSON.parse(store().getItem(KEY) ?? '{}')
    return value && typeof value === 'object' ? value : ({} as T)
  } catch {
    return {} as T
  }
}

function write<T extends object>(store: () => Storage, patch: T) {
  try {
    store().setItem(KEY, JSON.stringify({ ...read<T>(store), ...patch }))
  } catch {}
}

export const readPersisted = () => read<Persisted>(() => localStorage)
/** Merges `patch` over what is stored; never throws (private mode, quota). */
export const persist = (patch: Persisted) => write(() => localStorage, patch)
export const readSession = () => read<SessionState>(() => sessionStorage)
export const persistSession = (patch: SessionState) => write(() => sessionStorage, patch)
