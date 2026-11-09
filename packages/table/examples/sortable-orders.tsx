import {
  type ClientTableFeatures,
  type ColumnDef,
  clientTableFeatures,
  flexRender,
  useTable,
  useUrlTableState,
} from '@kitr/table'
import { useLocationSearch } from './sortable-orders/app/hooks/use-location-search'

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

// Tailwind utilities on the kitr tokens, so the example looks the same in any kitr app.
const link = 'cursor-pointer border-0 bg-transparent p-0 text-primary'

export default function SortableOrders() {
  const { search, setSearch } = useLocationSearch()
  const table = useTable<ClientTableFeatures, Order>({
    features: clientTableFeatures,
    data: orders,
    columns,
    ...useUrlTableState({ search, setSearch, manual: false }),
  })
  return (
    <div className="flex flex-col gap-3 text-[15px]">
      <table className="w-full border-collapse overflow-hidden rounded-[10px] border border-border [&_td]:border-b [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:text-left [&_th]:border-b [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_tr:last-child_td]:border-b-0">
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
                        className={link}
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
      <p className="m-0 font-mono text-muted-foreground">
        {search.sort ? `?sort=${search.sort}` : 'No sort: rows in the order the API returned them'}
      </p>
    </div>
  )
}
