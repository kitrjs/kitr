---
title: Overview
description: Show rows of data with sorting, paging and filters that stay in the URL.
order: 0
---

# Tables

## What it is

`@kitr/table` is TanStack Table plus URL state. `useUrlTableState()` keeps sorting, paging and filters in the route's search params; `parseTableSearch()` validates them, so `?page=abc` becomes page 1. Rows come from the server through [query](/packages/query).

Runs in the browser. Made for [router](/packages/router)'s `validateSearch` and `navigate`.

## Install

```sh
kitr add table
```

Adds `@kitr/table` and TanStack Table. No provider, no config file. [Every change](/packages/table/guide#install).

## Quick start

Three pieces: columns, a route that accepts table params, and the table. The columns:

```tsx
// app/features/orders/columns.tsx
import type { ColumnDef, DataTableFeatures } from '@kitr/table'

export interface Order {
  id: string
  customer: string
  total: number
  status: 'open' | 'paid' | 'refunded'
}

export const columns: ColumnDef<DataTableFeatures, Order>[] = [
  { accessorKey: 'customer', header: 'Customer' },
  { accessorKey: 'total', header: 'Total', cell: ({ row }) => `€${row.original.total.toFixed(2)}` },
  { accessorKey: 'status', header: 'Status', enableSorting: false },
]
```

`validateSearch: parseTableSearch` on the route makes `page`, `size`, `sort` and `filter` typed search params. The page turns them into table state and hands them to the registry's `<DataTable>`:

```tsx
// app/pages/orders/index.tsx
import { useSuspenseQuery } from '@kitr/query'
import { getRouteApi } from '@kitr/router'
import { useUrlTableState } from '@kitr/table'
import { DataTable } from '#components/ui/data-table'
import { columns } from '#app/features/orders/columns'
import { ordersPageQuery } from '#app/features/orders/queries'

const route = getRouteApi('/orders')

export default function OrdersPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const { data } = useSuspenseQuery(ordersPageQuery.options(search))
  const urlState = useUrlTableState({
    search,
    setSearch: (patch) => navigate({ search: (prev) => ({ ...prev, ...patch }) }),
  })
  return <DataTable columns={columns} data={data.rows} rowCount={data.total} {...urlState} />
}
```

Click the Total header. The URL becomes `/orders?sort=-total`, the loader fetches that page, and the table shows the largest orders first. Reload and it stays sorted. Next in the guide: [Show your first sortable table](/packages/table/guide#show-your-first-sortable-table).

## Built on

kitr adds the URL state hook, the search param parser and the feature set for the data table component.

## Problems it solves

- **Table state lost on reload.** [Keep sorting, paging and filters in the URL](/packages/table/guide#keep-sorting-paging-and-filters-in-the-url).
- **Crashes from hand-edited URLs.** [Validate the URL](/packages/table/guide#validate-the-url).
- **Thousands of rows in the browser.** [Fetch one page from the server](/packages/table/guide#fetch-one-page-from-the-server).
- **Filters per column.** [Filter by a column](/packages/table/guide#filter-by-a-column).
- **Small datasets that need no API paging.** [Sort and page in the browser](/packages/table/guide#sort-and-page-in-the-browser).
- **Styling someone else's table markup.** [Render your own markup](/packages/table/guide#render-your-own-markup).

## Further reading

- [Guide](/packages/table/guide).
- [API reference](/packages/table/api).
- [TanStack Table docs](https://tanstack.com/table/latest).
- [Router](/packages/router) and [Query](/packages/query).
