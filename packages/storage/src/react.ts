import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useSyncExternalStore,
} from 'react'
import type { CookieItem, StorageItem } from './index'

/**
 * The request's `Cookie` header during server rendering, so `useCookie()` renders the
 * same value the browser will hydrate with. Wrap the tree once, in the root route:
 *
 *   <CookieHeader value={request.headers.get('cookie')}>...</CookieHeader>
 */
const CookieHeaderContext = createContext<string | null | undefined>(undefined)

export function CookieHeader({
  value,
  children,
}: {
  value: string | null | undefined
  children: ReactNode
}) {
  return createElement(CookieHeaderContext.Provider, { value }, children)
}

/**
 * Read and write a storage item from a component. Hydration-safe: the server (and the first
 * client render) see the default, then the stored value applies, so markup always matches.
 */
export function useStorage<T>(
  item: StorageItem<T>,
): [T, (value: T | ((current: T) => T)) => void, () => void] {
  const value = useSyncExternalStore(
    useCallback((onChange) => item.subscribe(onChange), [item]),
    () => item.get(),
    () => item.default,
  )
  return [value, item.set, item.remove]
}

/**
 * Read and write a cookie from a component. On the server the value comes from
 * `<CookieHeader>` when present, otherwise the default.
 */
export function useCookie<T>(item: CookieItem<T>): [T, (value: T) => void, () => void] {
  const header = useContext(CookieHeaderContext)
  const value = useSyncExternalStore(
    useCallback((onChange) => item.subscribe(onChange), [item]),
    () => item.get(),
    () => item.get(header ?? null),
  )
  return [value, item.set, item.remove]
}
