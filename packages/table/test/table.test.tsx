import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  type ClientTableFeatures,
  type ColumnDef,
  clientTableFeatures,
  dataTableFeatures,
  formatSort,
  parseSort,
  parseTableSearch,
  type TableSearch,
  useTable,
  useUrlTableState,
} from '../src'

describe('sort strings', () => {
  it('round-trips', () => {
    const sorting = [
      { id: 'name', desc: true },
      { id: 'createdAt', desc: false },
    ]
    expect(formatSort(sorting)).toBe('-name,createdAt')
    expect(parseSort('-name,createdAt')).toEqual(sorting)
    expect(parseSort('')).toEqual([])
    expect(parseSort(undefined)).toEqual([])
    expect(parseSort('a,,b')).toEqual([
      { id: 'a', desc: false },
      { id: 'b', desc: false },
    ])
  })
})

describe('parseTableSearch', () => {
  it('keeps valid values and drops junk from untrusted URLs', () => {
    expect(
      parseTableSearch({
        page: '2',
        size: '50',
        sort: '-name,owner.email',
        filter: { status: 'open', n: 1 },
      }),
    ).toEqual({
      page: 2,
      size: 50,
      sort: '-name,owner.email',
      filter: { status: 'open' },
    })
    expect(
      parseTableSearch({ page: '0', size: '9999', sort: 'name;drop table', filter: 'x' }),
    ).toEqual({})
    expect(parseTableSearch({ page: '1.5', size: '-1' })).toEqual({})
    expect(parseTableSearch({ filter: { a: 1 } })).toEqual({})
  })
})

describe('useUrlTableState', () => {
  const setup = (search: TableSearch, defaultPageSize?: number) => {
    const setSearch = vi.fn()
    const { result } = renderHook(() => useUrlTableState({ search, setSearch, defaultPageSize }))
    return { result, setSearch }
  }

  it('derives table state from the URL', () => {
    const { result } = setup({ page: 3, size: 10, sort: '-name', filter: { status: 'open' } })
    expect(result.current.state).toEqual({
      sorting: [{ id: 'name', desc: true }],
      pagination: { pageIndex: 2, pageSize: 10 },
      columnFilters: [{ id: 'status', value: 'open' }],
    })
    expect(result.current.manualPagination).toBe(true)
  })

  it('defaults to the first page and default size', () => {
    expect(setup({}).result.current.state.pagination).toEqual({ pageIndex: 0, pageSize: 20 })
    expect(setup({}, 5).result.current.state.pagination.pageSize).toBe(5)
  })

  it('writes sorting back and resets to page 1', () => {
    const { result, setSearch } = setup({ page: 4, sort: 'name' })
    act(() => result.current.onSortingChange((prev) => [{ id: prev[0]!.id, desc: true }]))
    expect(setSearch).toHaveBeenLastCalledWith({ sort: '-name', page: undefined })
    act(() => result.current.onSortingChange([]))
    expect(setSearch).toHaveBeenLastCalledWith({ sort: undefined, page: undefined })
  })

  it('writes pagination and omits defaults from the URL', () => {
    const { result, setSearch } = setup({})
    act(() => result.current.onPaginationChange({ pageIndex: 1, pageSize: 50 }))
    expect(setSearch).toHaveBeenLastCalledWith({ page: 2, size: 50 })
    act(() => result.current.onPaginationChange((p) => ({ ...p, pageIndex: 0 })))
    expect(setSearch).toHaveBeenLastCalledWith({ page: undefined, size: undefined })
  })

  it('writes filters, dropping empty ones', () => {
    const { result, setSearch } = setup({ page: 2 })
    act(() =>
      result.current.onColumnFiltersChange([
        { id: 'status', value: 'open' },
        { id: 'q', value: '' },
        { id: 'n', value: 3 },
      ]),
    )
    expect(setSearch).toHaveBeenLastCalledWith({
      filter: { status: 'open', n: '3' },
      page: undefined,
    })
    act(() => result.current.onColumnFiltersChange(() => []))
    expect(setSearch).toHaveBeenLastCalledWith({ filter: undefined, page: undefined })
  })
})

describe('dataTableFeatures', () => {
  it('registers sorting, pagination, filtering and visibility', () => {
    expect(Object.keys(dataTableFeatures).sort()).toEqual([
      'columnFilteringFeature',
      'columnVisibilityFeature',
      'rowPaginationFeature',
      'rowSortingFeature',
    ])
  })
})

// Data the page already has in full sorts, filters and pages in the browser, not on the server.
describe('client-side tables', () => {
  it('sort, filter and page in the browser with clientTableFeatures and manual: false', () => {
    const rows = [
      { name: 'Grace', total: 120, status: 'open' },
      { name: 'Ada', total: 80, status: 'open' },
      { name: 'Linus', total: 300, status: 'closed' },
    ]
    const columns: ColumnDef<ClientTableFeatures, (typeof rows)[number]>[] = [
      { accessorKey: 'name' },
      { accessorKey: 'total' },
      { accessorKey: 'status' },
    ]
    const names = (search: TableSearch) => {
      const { result } = renderHook(() => {
        const state = useUrlTableState({
          search,
          setSearch: () => {},
          defaultPageSize: 2,
          manual: false,
        })
        return useTable({ features: clientTableFeatures, columns, data: rows, ...state })
      })
      return result.current.getRowModel().rows.map((r) => r.original.name)
    }
    expect(names({})).toEqual(['Grace', 'Ada'])
    expect(names({ sort: '-total' })).toEqual(['Linus', 'Grace'])
    expect(names({ sort: 'name', page: 2 })).toEqual(['Linus'])
    expect(names({ filter: { status: 'open' }, sort: 'total' })).toEqual(['Ada', 'Grace'])
  })

  it('stays manual by default, for server-side data', () => {
    const { result } = renderHook(() => useUrlTableState({ search: {}, setSearch: () => {} }))
    expect(result.current.manualSorting).toBe(true)
  })
})
