import {
  type ClientTableFeatures,
  type ColumnDef,
  clientTableFeatures,
  flexRender,
  parseTableSearch,
  type TableSearch,
  useTable,
  useUrlTableState,
} from '@kitr/table'
import { useCallback, useState } from 'react'

export const meta = {
  title: 'A sort that lives in the URL',
  description:
    'Click a header to sort, click again to reverse, then press Reload: the sort comes back from the URL. Status is not sortable.',
  storage: false,
}

interface Order {
  id: string
  customer: string
  total: number
  status: 'open' | 'paid' | 'refunded'
}

const orders: Order[] = [
  { id: 'ord_1042', customer: 'Ada', total: 129, status: 'paid' },
  { id: 'ord_1043', customer: 'Grace', total: 84, status: 'open' },
  { id: 'ord_1044', customer: 'Linus', total: 300, status: 'open' },
  { id: 'ord_1045', customer: 'Margaret', total: 42, status: 'refunded' },
  { id: 'ord_1046', customer: 'Edsger', total: 215, status: 'paid' },
]

const columns: ColumnDef<ClientTableFeatures, Order>[] = [
  { accessorKey: 'customer', header: 'Customer' },
  {
    accessorKey: 'total',
    header: 'Total',
    cell: ({ row }) => `$${row.original.total.toFixed(2)}`,
  },
  { accessorKey: 'status', header: 'Status', enableSorting: false },
]

/**
 * This page's search params, read once and written with replaceState. In an app, pass the route's
 * `Route.useSearch()` and a `navigate({ search })` instead.
 */
function useLocationSearch() {
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

export default function SortableOrders() {
  const { search, setSearch } = useLocationSearch()
  const table = useTable<ClientTableFeatures, Order>({
    features: clientTableFeatures,
    data: orders,
    columns,
    ...useUrlTableState({ search, setSearch, manual: false }),
  })
  return (
    <div className="demo">
      <table className="demo-table">
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => {
                const dir = header.column.getIsSorted()
                return (
                  <th key={header.id}>
                    {header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="demo-link"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {dir === 'asc' ? ' ↑' : dir === 'desc' ? ' ↓' : ''}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="demo-muted mono">
        {search.sort ? `?sort=${search.sort}` : 'No sort: rows in the order the API returned them'}
      </p>
    </div>
  )
}
