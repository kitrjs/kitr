import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  ArrowUpDownIcon,
} from '@hugeicons/core-free-icons'
import {
  type ColumnDef,
  clientTableFeatures,
  type DataTableFeatures,
  dataTableFeatures,
  type RowData,
  type TableOptions,
  useTable,
} from 'kitr/table'
import { cn } from 'kitr/tailwind'
import type { ReactNode } from 'react'
import { Button } from '#components/ui/button'
import { Icon } from '#components/ui/icon'

export interface DataTableProps<TData extends RowData>
  extends Partial<Omit<TableOptions<DataTableFeatures, TData>, 'data' | 'columns' | 'features'>> {
  // biome-ignore lint/suspicious/noExplicitAny: each column has its own value type
  columns: ColumnDef<DataTableFeatures, TData, any>[]
  data: TData[]
  /** Total rows for server-side pagination. */
  rowCount?: number
  /**
   * Sort, filter and page in the browser: for data that arrives in one response. Without it the
   * table expects the server to do that work (what `useUrlTableState` assumes by default).
   */
  clientSide?: boolean
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
  clientSide = false,
  empty = 'No results.',
  className,
  ...options
}: DataTableProps<TData>) {
  const table = useTable<DataTableFeatures, TData>({
    // A superset of dataTableFeatures, so the same columns work with either.
    features: clientSide ? (clientTableFeatures as DataTableFeatures) : dataTableFeatures,
    data,
    columns,
    rowCount: clientSide ? undefined : rowCount,
    ...options,
    ...(clientSide && { manualSorting: false, manualPagination: false, manualFiltering: false }),
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
                          <Icon
                            icon={
                              sorted === 'asc'
                                ? ArrowUp01Icon
                                : sorted === 'desc'
                                  ? ArrowDown01Icon
                                  : ArrowUpDownIcon
                            }
                            size={14}
                            className={sorted ? undefined : 'opacity-50'}
                          />
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
            <Icon icon={ArrowLeft01Icon} size={14} />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
            <Icon icon={ArrowRight01Icon} size={14} />
          </Button>
        </div>
      </div>
    </div>
  )
}
