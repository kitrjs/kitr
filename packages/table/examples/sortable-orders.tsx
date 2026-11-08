import {
  type ClientTableFeatures,
  type ColumnDef,
  clientTableFeatures,
  flexRender,
  useTable,
} from '@kitr/table'

export const meta = {
  title: 'A table that sorts by its headers',
  description:
    'Click a header to sort, again to reverse. Status is not sortable. The same column definitions drive a server-paged table in the guide.',
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

export default function SortableOrders() {
  const table = useTable<ClientTableFeatures, Order>({
    features: clientTableFeatures,
    data: orders,
    columns,
    manualSorting: false,
  })
  const sort = table.state.sorting?.[0]
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
        {sort
          ? `?sort=${sort.desc ? '-' : ''}${sort.id}`
          : 'No sort: rows in the order the API returned them'}
      </p>
    </div>
  )
}
