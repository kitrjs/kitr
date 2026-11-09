import { parseTableSearch, type TableSearch } from '@kitr/table'
import { useCallback, useState } from 'react'

/**
 * This page's search params, read once and written with replaceState. In an app, pass the route's
 * `Route.useSearch()` and a `navigate({ search })` instead.
 */
export function useLocationSearch() {
  const [search, setState] = useState<TableSearch>(() =>
    parseTableSearch(Object.fromEntries(new URLSearchParams(window.location.search))),
  )
  const setSearch = useCallback((patch: Partial<TableSearch>) => {
    setState((current) => {
      const next = { ...current, ...patch }
      const params = new URLSearchParams()
      if (next.sort) params.set('sort', next.sort)
      if (next.page) params.set('page', String(next.page))
      const query = params.toString()
      window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname)
      return next
    })
  }, [])
  return { search, setSearch }
}
