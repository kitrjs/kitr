---
title: Overview
description: Show rows of data with sorting, paging and filters that stay in the URL.
order: 0
---

# Tables

Admin screens, dashboards and reports all need the same thing: a table people can sort, page through and filter. Then someone sorts by total, filters to open orders, goes to page 3 and sends a colleague the link, and the colleague lands on page 1 unsorted. The table state lived in a component, and the URL knew nothing about it.

`@kitr/table` keeps those choices in the page's URL, so the view survives a reload, works with the back button and opens the same for everyone.

## What it is

`@kitr/table` is TanStack Table plus URL state. `useUrlTableState()` binds sorting, pagination and column filters to the route's search params. `parseTableSearch()` validates those params from an untrusted URL, so `?page=abc` becomes page 1 instead of a crash. `dataTableFeatures` is the feature set kitr's `<DataTable>` component, copied in with `kitr ui add`, expects. Pages of rows come from the server through [query](/packages/query), cached by their search params.

It runs in the browser, inside React. The URL helpers do not depend on a router, but they were made for [router](/packages/router)'s `validateSearch` and `navigate`. For a list of cards or a feed rather than rows and columns, you don't need a table package.

## Install

```sh
kitr add table
```

This installs `@kitr/table` and TanStack Table and adds the package to `kitrrc.ts`. There is no provider and no config file. The guide's [Install](/packages/table/guide#install) section lists every change.

## Quick start

Three pieces: column definitions, a route that accepts table params, and the table bound to them. Start with the columns:

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

Open `/orders` and click the Total header. The URL becomes `/orders?sort=-total`, the loader fetches that page, and the table shows the largest orders first. Reload, or send the link to a colleague, and it is still sorted. The guide continues from here: [Show your first sortable table](/packages/table/guide#show-your-first-sortable-table).

## Built on

`@kitr/table` is [TanStack Table](https://tanstack.com/table/latest) v9, re-exported unchanged. `useTable`, column definitions, row models and every feature work as TanStack documents them, imported from `@kitr/table`. kitr adds the URL state hook, the search param parser and the feature set for the data table component.

## Problems it solves

- **Table state lost on reload.** Sorting, page and filters live in the URL. See [Keep sorting, paging and filters in the URL](/packages/table/guide#keep-sorting-paging-and-filters-in-the-url).
- **Crashes from hand-edited URLs.** `parseTableSearch()` validates every param and falls back. See [Validate the URL](/packages/table/guide#validate-the-url).
- **Thousands of rows in the browser.** Fetch one page at a time from the server, keyed by the search params. See [Fetch one page from the server](/packages/table/guide#fetch-one-page-from-the-server).
- **Filters per column.** Column filters in the URL, sent to the API. See [Filter by a column](/packages/table/guide#filter-by-a-column).
- **Small datasets that need no API paging.** Sort and page in the browser with the same hooks. See [Sort and page in the browser](/packages/table/guide#sort-and-page-in-the-browser).
- **Styling someone else's table markup.** Render your own rows and cells. See [Render your own markup](/packages/table/guide#render-your-own-markup).

## Further reading

- [Guide](/packages/table/guide): install, configure and every task.
- [API reference](/packages/table/api): every export of `@kitr/table`.
- [TanStack Table docs](https://tanstack.com/table/latest): features, row models and column options.
- [Router](/packages/router) and [Query](/packages/query): the search params the state lives in, and the cache for each page of rows.
