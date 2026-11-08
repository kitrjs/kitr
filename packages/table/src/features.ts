import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_arrIncludes,
  filterFn_arrIncludesAll,
  filterFn_arrIncludesSome,
  filterFn_equals,
  filterFn_equalsString,
  filterFn_includesString,
  filterFn_inNumberRange,
  filterFn_weakEquals,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
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

/**
 * `dataTableFeatures` plus the browser-side row models: for a list that arrives in one response,
 * the table sorts, filters and pages it itself. Turn the manual flags off with it
 * (`useUrlTableState({ ..., manual: false })` does), or nothing changes when a header is clicked.
 */
export const clientTableFeatures = tableFeatures({
  ...dataTableFeatures,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  // The names TanStack's `auto` sort and filter pick, so plain columns work without a sortFn.
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    text: sortFn_text,
    datetime: sortFn_datetime,
    basic: sortFn_basic,
  },
  filterFns: {
    includesString: filterFn_includesString,
    equalsString: filterFn_equalsString,
    equals: filterFn_equals,
    weakEquals: filterFn_weakEquals,
    inNumberRange: filterFn_inNumberRange,
    arrIncludes: filterFn_arrIncludes,
    arrIncludesAll: filterFn_arrIncludesAll,
    arrIncludesSome: filterFn_arrIncludesSome,
  },
})

/** The type of `clientTableFeatures`. */
export type ClientTableFeatures = typeof clientTableFeatures
