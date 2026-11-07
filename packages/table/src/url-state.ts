import type {
  ColumnFiltersState,
  PaginationState,
  SortingState,
  Updater,
} from '@tanstack/react-table'
import { useCallback, useMemo } from 'react'

/** The search-param shape kitr tables use. Add it to your route's `validateSearch`. */
export interface TableSearch {
  /** One-based page number. Absent means page 1. */
  page?: number
  /** Rows per page. Absent means the default page size. */
  size?: number
  /** Sort columns, comma-separated, `-` for descending: `-total,customer`. */
  sort?: string
  /** Column filters as column id to string value: `{ status: 'open' }`. */
  filter?: Record<string, string>
}

/** Options for `useUrlTableState`: the route's current search, a way to change it and the page size. */
export interface UrlTableStateOptions {
  /** The current table search params, usually `Route.useSearch()`. */
  search: TableSearch
  /** Merge a patch into the URL, e.g. `(patch) => navigate({ search: (s) => ({ ...s, ...patch }) })`. */
  setSearch: (patch: Partial<TableSearch>) => void
  /** Rows per page when the URL has no `size`, and the size left out of the URL. Default 20. */
  defaultPageSize?: number
  /**
   * `true` (default): the server sorts, filters and pages, the table shows what came back.
   * `false`: the table does it in the browser; use it with `clientTableFeatures`.
   */
  manual?: boolean
}

/**
 * Bind sorting, pagination and column filters to URL search params so a
 * filtered view is shareable by link. Router-agnostic; pass the route's search
 * and a setter. Spread the result into `useTable` (with `dataTableFeatures` or a superset).
 */
export function useUrlTableState({
  search,
  setSearch,
  defaultPageSize = 20,
  manual = true,
}: UrlTableStateOptions) {
  const sorting = useMemo<SortingState>(() => parseSort(search.sort), [search.sort])
  const pagination = useMemo<PaginationState>(
    () => ({
      pageIndex: Math.max(0, (search.page ?? 1) - 1),
      pageSize: search.size ?? defaultPageSize,
    }),
    [search.page, search.size, defaultPageSize],
  )
  const columnFilters = useMemo<ColumnFiltersState>(
    () => Object.entries(search.filter ?? {}).map(([id, value]) => ({ id, value })),
    [search.filter],
  )

  const onSortingChange = useCallback(
    (updater: Updater<SortingState>) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater
      setSearch({ sort: next.length ? formatSort(next) : undefined, page: undefined })
    },
    [sorting, setSearch],
  )
  const onPaginationChange = useCallback(
    (updater: Updater<PaginationState>) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater
      setSearch({
        page: next.pageIndex === 0 ? undefined : next.pageIndex + 1,
        size: next.pageSize === defaultPageSize ? undefined : next.pageSize,
      })
    },
    [pagination, setSearch, defaultPageSize],
  )
  const onColumnFiltersChange = useCallback(
    (updater: Updater<ColumnFiltersState>) => {
      const next = typeof updater === 'function' ? updater(columnFilters) : updater
      const filter: Record<string, string> = {}
      for (const f of next)
        if (f.value !== undefined && f.value !== '') filter[f.id] = String(f.value)
      setSearch({ filter: Object.keys(filter).length ? filter : undefined, page: undefined })
    },
    [columnFilters, setSearch],
  )

  return {
    state: { sorting, pagination, columnFilters },
    onSortingChange,
    onPaginationChange,
    onColumnFiltersChange,
    manualSorting: manual,
    manualPagination: manual,
    manualFiltering: manual,
  }
}

/** `-name,createdAt` ⇄ `[{ id: 'name', desc: true }, { id: 'createdAt', desc: false }]` */
export function parseSort(sort?: string): SortingState {
  if (!sort) return []
  return sort
    .split(',')
    .filter(Boolean)
    .map((part) =>
      part.startsWith('-') ? { id: part.slice(1), desc: true } : { id: part, desc: false },
    )
}

/** Turns TanStack's sorting state into the URL's `sort` string: `[{ id: 'total', desc: true }]` becomes `-total`. */
export function formatSort(sorting: SortingState): string {
  return sorting.map((s) => (s.desc ? `-${s.id}` : s.id)).join(',')
}

/** Validate raw search params into `TableSearch`. Plug into `validateSearch` or wrap with zod. */
export function parseTableSearch(raw: Record<string, unknown>): TableSearch {
  const out: TableSearch = {}
  const page = Number(raw.page)
  if (Number.isInteger(page) && page > 0) out.page = page
  const size = Number(raw.size)
  if (Number.isInteger(size) && size > 0 && size <= 500) out.size = size
  if (typeof raw.sort === 'string' && /^-?[\w.]+(,-?[\w.]+)*$/.test(raw.sort)) out.sort = raw.sort
  if (raw.filter && typeof raw.filter === 'object') {
    const filter: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw.filter as Record<string, unknown>))
      if (typeof v === 'string') filter[k] = v
    if (Object.keys(filter).length) out.filter = filter
  }
  return out
}
