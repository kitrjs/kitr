/**
 * The smallest store TanStack Router's hooks can read: `get()` plus `subscribe()` returning
 * `{ unsubscribe }`, which is what `useSelector` from @tanstack/react-store expects. Each kept-alive
 * page gets its own set so its hooks keep answering after the router has moved on.
 */

export interface ReadableStore<T> {
  get(): T
  subscribe(listener: () => void): { unsubscribe(): void }
}

export interface WritableStore<T> extends ReadableStore<T> {
  set(next: T | ((prev: T) => T)): void
}

export function createStore<T>(initial: T): WritableStore<T> {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set(next) {
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(value) : next
      if (Object.is(resolved, value)) return
      value = resolved
      for (const l of [...listeners]) l()
    },
    subscribe(listener) {
      listeners.add(listener)
      return { unsubscribe: () => listeners.delete(listener) }
    },
  }
}

/** A read-only view computed from other stores; notifies when the computed value changes. */
export function derivedStore<T>(deps: ReadableStore<unknown>[], read: () => T): ReadableStore<T> {
  let cached = read()
  let dirty = false
  const listeners = new Set<() => void>()
  let subscriptions: Array<{ unsubscribe(): void }> = []
  const recompute = () => {
    const next = read()
    if (Object.is(next, cached)) return
    cached = next
    for (const l of [...listeners]) l()
  }
  return {
    get: () => {
      if (dirty || !listeners.size) {
        cached = read()
        dirty = false
      }
      return cached
    },
    subscribe(listener) {
      if (!listeners.size) {
        cached = read()
        subscriptions = deps.map((d) => d.subscribe(recompute))
      }
      listeners.add(listener)
      return {
        unsubscribe: () => {
          listeners.delete(listener)
          if (!listeners.size) {
            for (const s of subscriptions) s.unsubscribe()
            subscriptions = []
            dirty = true
          }
        },
      }
    },
  }
}
