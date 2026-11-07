import {
  type ColumnDef,
  type DataTableFeatures,
  dataTableFeatures,
  type RowData,
  type TableOptions,
  useTable,
} from 'kitr/table'
import { cn } from 'kitr/tailwind'
import type { ReactNode } from 'react'
import { Button } from '#components/ui/button'

export interface DataTableProps<TData extends RowData>
  extends Partial<Omit<TableOptions<DataTableFeatures, TData>, 'data' | 'columns' | 'features'>> {
  columns: ColumnDef<DataTableFeatures, TData, any>[]
  data: TData[]
  /** Total rows for server-side pagination. */
  rowCount?: number
  empty?: ReactNode
  className?: string
}

/**
 * Spread `useUrlTableState(...)` from kitr/table into the props to bind sorting,
 * pagination and filters to the URL. Built on TanStack Table v9's feature slices,
 * so only sorting, pagination and filtering ship with it.
 */
export function DataTable<TData extends RowData>({
  columns,
  data,
  rowCount,
  empty = 'No results.',
  className,
  ...options
}: DataTableProps<TData>) {
  const table = useTable<DataTableFeatures, TData>({
    features: dataTableFeatures,
    data,
    columns,
    rowCount,
    ...options,
  })
  const rows = table.getRowModel().rows
  const pageIndex = table.state.pagination.pageIndex
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full caption-bottom text-sm">
          <thead className="bg-muted/50 [&_tr]:border-b [&_tr]:border-border">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const sortable = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      className="h-10 px-3 text-left align-middle font-medium text-muted-foreground"
                    >
                      {header.isPlaceholder ? null : sortable ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <table.FlexRender header={header} />
                          <span aria-hidden>
                            {sorted === 'asc' ? '↑' : sorted === 'desc' ? '↓' : ''}
                          </span>
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {rows.length ? (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border transition-colors hover:bg-muted/40 data-[state=selected]:bg-muted"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="p-3 align-middle">
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {pageIndex + 1}
          {table.getPageCount() > 0 ? ` of ${table.getPageCount()}` : ''}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
