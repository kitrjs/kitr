---
title: API reference
description: Every export of @kitr/table.
order: 2
---

# API reference

`@kitr/table` re-exports everything from `@tanstack/react-table` v9 and adds the following.

## useUrlTableState

```ts
function useUrlTableState(options: {
  search: TableSearch
  setSearch: (patch: Partial<TableSearch>) => void
  defaultPageSize?: number // default 20
}): {
  state: { sorting; pagination; columnFilters }
  onSortingChange
  onPaginationChange
  onColumnFiltersChange
  manualSorting: true
  manualPagination: true
  manualFiltering: true
}
```

Spread the result into `useTable` or `<DataTable>`. Router-agnostic: any router that can read and patch search params works.

## TableSearch

```ts
interface TableSearch {
  page?: number                   // one-based
  size?: number
  sort?: string                   // "name,-createdAt"
  filter?: Record<string, string>
}
```

## parseTableSearch

```ts
function parseTableSearch(raw: Record<string, unknown>): TableSearch
```

For a route's `validateSearch`. Keeps positive integer pages, sizes up to 500, well-formed sort strings and string filters; drops everything else.

## parseSort and formatSort

```ts
parseSort('-name,createdAt') // [{ id: 'name', desc: true }, { id: 'createdAt', desc: false }]
formatSort([{ id: 'name', desc: true }]) // '-name'
```

## dataTableFeatures

```ts
const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
})
```

The features `<DataTable>` and `useUrlTableState` assume. TanStack Table v9 only bundles the features you register. Add more with `tableFeatures({ ...dataTableFeatures, rowSelectionFeature })`.
