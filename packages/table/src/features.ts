import {
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
} from '@tanstack/react-table'

/**
 * The feature set kitr's DataTable and `useUrlTableState` assume: sorting,
 * pagination, column filters and column visibility. TanStack Table v9 is feature-sliced, so a
 * table only ships the code for the features you register. Extend with
 * `tableFeatures({ ...dataTableFeatures, rowSelectionFeature })`.
 */
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
})

/** The type of `dataTableFeatures`, for `ColumnDef<DataTableFeatures, Order>` and `useTable` generics. */
export type DataTableFeatures = typeof dataTableFeatures
