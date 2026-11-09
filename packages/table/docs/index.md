---
title: Tables
description: Show rows of data with sorting, paging and filters that stay in the URL.
order: 1
---

# Tables

Admin screens, dashboards and reports all need a table people can sort, page through and filter. Grace sorts Acme's orders by total, filters to the open ones, goes to page 3, and sends Linus the link. `@kitr/table` keeps those choices in the page's URL, so the view survives a reload, works with the back button, and opens the same for Linus.

> [!SUMMARY]
> Sortable, pageable, filterable tables whose state lives in the URL. Add it with `kitr add table`; the overview is at [/packages/table](/packages/table).

It is [TanStack Table](https://tanstack.com/table/latest) v9, re-exported unchanged, plus `useUrlTableState()` (binds sorting, pagination and filters to search params), `parseTableSearch()` (validates those params from an untrusted URL) and `dataTableFeatures` (the feature set kitr's `<DataTable>` expects). It runs in the browser, inside React; the examples use [router](/packages/router).

The examples build Acme's orders screen at `app.acme.com/orders`: thousands of orders with a customer, a total, a status and a date, served one page at a time by `/api/orders`.

## Install

```sh
kitr add table
```

<details>
<summary>Everything kitr add changes</summary>

- Adds `@kitr/table` and `@tanstack/react-table` to `dependencies` and installs them. Pass `--no-install` to skip the install.
- Adds `'@kitr/table'` to `packages` in `kitrrc.ts`. It registers no provider.
- Adds a `## kitr: table` section to `AGENTS.md`.

It writes no config file, adds no env variables or scripts, and asks no questions. Tables are a client package, so in a project without React `kitr add` skips it with a warning. The `app`, `fullstack`, `saas`, `desktop` and `mobile` kits include it, along with the `data-table` component.

`kitr remove table` takes the package out of `kitrrc.ts`, removes both dependencies and the `AGENTS.md` section, and lists files that still import `@kitr/table`. It leaves `data-table.tsx` in place.

</details>

The styled table component is yours to edit, so copy it in separately:

```sh
kitr ui add data-table
```

That writes `app/components/ui/data-table.tsx`, plus the `button` and `icon` components it uses.

## Configure

`@kitr/table` has no config file. Each table is configured where you call `useUrlTableState`:

```ts
// app/routes.ts
import { parseTableSearch } from '@kitr/table'

r.page('/orders', {
  validateSearch: parseTableSearch,
  lazy: () => import('./pages/orders/index'),
})
```

```tsx
// app/pages/orders/index.tsx
import { useUrlTableState } from '@kitr/table'
import { getRouteApi } from '@kitr/router'

const route = getRouteApi('/orders')

export default function OrdersPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const urlState = useUrlTableState({
    search,
    setSearch: (patch) => navigate({ search: (prev) => ({ ...prev, ...patch }) }),
    defaultPageSize: 25,
  })
  // ...
}
```

| Option | Default | Description |
| --- | --- | --- |
| `search` | required | The current table params, `{ page?, size?, sort?, filter? }`. Usually `getRouteApi(path).useSearch()`. |
| `setSearch` | required | Merges a patch into the URL. A key set to `undefined` is removed from it. |
| `defaultPageSize` | `20` | Rows per page when the URL has no `size`. A size equal to it is left out of the URL. |
| `manual` | `true` | `false` turns the three manual flags off, for data the table sorts and pages itself (with `clientTableFeatures`). |

`useUrlTableState` returns options to spread into `useTable` or `<DataTable>`:

| Returned | Value |
| --- | --- |
| `state` | `{ sorting, pagination, columnFilters }`, derived from `search`. |
| `onSortingChange`, `onPaginationChange`, `onColumnFiltersChange` | Write the change to the URL through `setSearch`. |
| `manualSorting`, `manualPagination`, `manualFiltering` | All `true`: the server sorts, pages and filters. See [Sort and page in the browser](#sort-and-page-in-the-browser) to turn them off. |

The `<DataTable>` component from `kitr ui add data-table` takes these props, plus any [TanStack table option](https://tanstack.com/table/latest/docs/api/core/table):

| Prop | Default | Description |
| --- | --- | --- |
| `columns` | required | Column definitions, typed `ColumnDef<DataTableFeatures, Order>[]`. |
| `data` | required | The rows to show: the current page when the server pages. |
| `rowCount` | none | Total rows across all pages, so the footer can say "Page 3 of 40" and disable Next on the last page. |
| `empty` | `'No results.'` | What the body shows when `data` is empty. |
| `className` | none | Classes for the outer wrapper. |

## Show your first sortable table

Three pieces: column definitions, a route that accepts table params, and the table bound to them. Start with the columns:

```tsx
// app/components/orders/columns.tsx
import type { ColumnDef, DataTableFeatures } from '@kitr/table'

export interface Order {
  id: string
  customer: string
  total: number
  status: 'open' | 'paid' | 'refunded'
  placedAt: string
}

export const columns: ColumnDef<DataTableFeatures, Order>[] = [
  { accessorKey: 'customer', header: 'Customer' },
  {
    accessorKey: 'total',
    header: 'Total',
    cell: ({ row }) => `€${row.original.total.toFixed(2)}`,
  },
  { accessorKey: 'status', header: 'Status', enableSorting: false },
  {
    accessorKey: 'placedAt',
    header: 'Placed',
    cell: ({ row }) => new Date(row.original.placedAt).toLocaleDateString('en-GB'),
  },
]
```

Then the page. `validateSearch: parseTableSearch` makes `page`, `size`, `sort` and `filter` typed search params; the loader fetches the matching page; `useUrlTableState` turns the params into table state:

```ts
// app/routes.ts
import { parseTableSearch } from '@kitr/table'
import { ordersPageQuery } from '#app/queries/orders'

r.page('/orders', {
  validateSearch: parseTableSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(ordersPageQuery.options(deps)),
  lazy: () => import('./pages/orders/index'),
})
```

```tsx
// app/pages/orders/index.tsx
import { useSuspenseQuery } from '@kitr/query'
import { useUrlTableState } from '@kitr/table'
import { DataTable } from '#components/ui/data-table'
import { columns } from '#app/components/orders/columns'
import { ordersPageQuery } from '#app/queries/orders'
import { getRouteApi } from '@kitr/router'

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

Open `/orders` and click the Total header. The URL becomes `/orders?sort=-total` and the table shows the largest orders first, even after a reload. [Fetch one page from the server](#fetch-one-page-from-the-server) shows `ordersPageQuery` and the API behind it.

## Define columns

A column needs an id and a header. `accessorKey` reads a field and doubles as the id; `cell` renders it; `id` names a column that reads no field, such as a row of buttons:

```tsx
// app/components/orders/columns.tsx
import type { ColumnDef, DataTableFeatures } from '@kitr/table'
import { Badge } from '#components/ui/badge'
import { Button } from '#components/ui/button'
import type { Order } from '#app/lib/orders/types'

export const columns: ColumnDef<DataTableFeatures, Order>[] = [
  { accessorKey: 'customer', header: 'Customer' },
  {
    accessorKey: 'status',
    header: 'Status',
    enableSorting: false,
    cell: ({ row }) => (
      <Badge variant={row.original.status === 'paid' ? 'default' : 'secondary'}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    id: 'actions',
    header: '',
    enableSorting: false,
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" onClick={() => console.log('refund', row.original.id)}>
        Refund
      </Button>
    ),
  },
]
```

The column id is what appears in the URL (`sort=customer`), so keep ids short and stable: changing one breaks saved links. `enableSorting: false` makes a header plain text in `<DataTable>`.

For a typed `getValue()` in each cell, use TanStack's column helper with the same feature set:

```tsx
// app/components/orders/columns.tsx
import { createColumnHelper, type DataTableFeatures } from '@kitr/table'
import type { Order } from '#app/lib/orders/types'

const column = createColumnHelper<DataTableFeatures, Order>()

export const columns = [
  column.accessor('customer', { header: 'Customer' }),
  column.accessor('total', {
    header: 'Total',
    cell: (info) => `€${info.getValue().toFixed(2)}`,
  }),
]
```

Define columns outside the component, or in `useMemo`, so the table does not rebuild them on every render.

## Keep sorting, paging and filters in the URL

`useUrlTableState` reads the table's state from `search` and writes every change back through `setSearch`. The URL is the only copy of the state, so there is nothing to sync. With TanStack Router's default serialiser:

| Table state | URL | Notes |
| --- | --- | --- |
| Page 3 | `?page=3` | One-based, unlike TanStack's zero-based `pageIndex`. Page 1 is left out. |
| 50 rows per page | `?size=50` | The default size is left out. `parseTableSearch` accepts up to 500. |
| Total, largest first | `?sort=-total` | A leading `-` means descending. |
| Customer A to Z, then newest | `?sort=customer%2C-placedAt` | Comma-separated, in priority order. The comma is URL-encoded. |
| Status is open | `?filter=%7B%22status%22%3A%22open%22%7D` | `filter` is an object, which the router stores as JSON: `{"status":"open"}`. |

Some writes also reset the page, because page 4 of the old order means nothing in the new one:

| Change | What `setSearch` receives |
| --- | --- |
| Click a header | `{ sort: '-total', page: undefined }` |
| Clear sorting | `{ sort: undefined, page: undefined }` |
| Set a filter | `{ filter: { status: 'open' }, page: undefined }` |
| Clear the last filter | `{ filter: undefined, page: undefined }` |
| Next page | `{ page: 2, size: undefined }` |
| Back to page 1 at the default size | `{ page: undefined, size: undefined }` |

Clicking a header cycles the sort directions. A number column such as Total starts largest first (`-total`, then `total`, then unsorted); a text column starts A to Z.

> [!WARNING] One source of truth
> Don't keep a copy of the sort or page in `useState` next to the table. The two drift apart, and the back button restores only one.

## Validate the URL

Anyone can edit a URL, so every search param is untrusted. `parseTableSearch` keeps what is valid and drops the rest without throwing:

```ts
// app/lib/orders/search.ts
import { parseTableSearch } from '@kitr/table'

parseTableSearch({ page: '2', size: '50', sort: '-total,customer', filter: { status: 'open' } })
// => { page: 2, size: 50, sort: '-total,customer', filter: { status: 'open' } }

parseTableSearch({ page: '0', size: '9999', sort: 'total;drop table', filter: 'open' })
// => {}

parseTableSearch({ page: '1.5', filter: { status: 'open', total: 100 } })
// => { filter: { status: 'open' } }
```

| Param | Kept when |
| --- | --- |
| `page` | A whole number of 1 or more. |
| `size` | A whole number from 1 to 500. |
| `sort` | Comma-separated column ids of letters, digits, `_` and `.`, each optionally prefixed with `-`. |
| `filter` | An object; only its string values are kept. |

For params of your own, such as a search box, call it inside your own `validateSearch`:

```ts
// app/routes.ts
import { parseTableSearch } from '@kitr/table'

r.page('/orders', {
  validateSearch: (raw: Record<string, unknown>) => ({
    ...parseTableSearch(raw),
    q: typeof raw.q === 'string' && raw.q.length <= 100 ? raw.q : undefined,
  }),
  lazy: () => import('./pages/orders/index'),
})
```

```tsx
// app/pages/orders/index.tsx
import { getRouteApi } from '@kitr/router'

const route = getRouteApi('/orders')

export default function OrdersPage() {
  const { q } = route.useSearch()
  return <p>Searching for {q}</p>
}
```

The sort pattern allows dotted ids such as `customer.name`. Your API should still accept only the columns it knows.

## Fetch one page from the server

`useUrlTableState` sets `manualSorting`, `manualPagination` and `manualFiltering`: the server sorts, filters and slices, and the table shows what came back. Turn the search into a request in the query:

```ts
// app/queries/orders.ts
import { queryFrom } from '@kitr/query'
import type { TableSearch } from '@kitr/table'
import type { Order } from './columns'

export interface OrdersPage {
  rows: Order[]
  total: number
}

export const ordersPageQuery = queryFrom<TableSearch, OrdersPage>({
  key: (search) => ['orders', 'page', search],
  fetch: async (search, { signal }) => {
    const params = new URLSearchParams()
    if (search.page) params.set('page', String(search.page))
    if (search.size) params.set('size', String(search.size))
    if (search.sort) params.set('sort', search.sort)
    for (const [column, value] of Object.entries(search.filter ?? {})) params.set(column, value)
    const res = await fetch(`/api/orders?${params}`, { signal })
    return (await res.json()) as OrdersPage
  },
})
```

The whole `search` object is in the key, so every view is cached on its own and the back button shows the previous page instantly. On the server, read the same params, allow only known columns, and return the page with the total:

```ts
// server/controllers/orders-controller.ts
import type { HttpContext } from '@kitr/api'
import { parseSort } from '@kitr/table'
import { type Order, orders } from '#server/orders/data'

const sorters = {
  customer: (a: Order, b: Order) => a.customer.localeCompare(b.customer),
  total: (a: Order, b: Order) => a.total - b.total,
  placedAt: (a: Order, b: Order) => a.placedAt.localeCompare(b.placedAt),
}

export default class OrdersController {
  async index({ query }: HttpContext<Record<string, string>, Record<string, string>>) {
    const page = Math.max(1, Number(query.page) || 1)
    const size = Math.min(500, Number(query.size) || 20)
    const sorting = parseSort(query.sort).filter((s) => s.id in sorters)

    const rows = query.status ? orders.filter((o) => o.status === query.status) : [...orders]
    rows.sort((a, b) => {
      for (const { id, desc } of sorting) {
        const result = sorters[id as keyof typeof sorters](a, b)
        if (result) return desc ? -result : result
      }
      return 0
    })
    return { rows: rows.slice((page - 1) * size, page * size), total: rows.length }
  }
}
```

`parseSort('-total,customer')` returns `[{ id: 'total', desc: true }, { id: 'customer', desc: false }]`, and `formatSort()` reverses it. Use the same page size default on both sides, or always pass `size`. Pass the total as `rowCount`, or Next stays disabled.

> [!WARNING] Allow-list sort columns
> Only ids in `sorters` are used, so a hand-edited `?sort=password` sorts nothing. With a database, build the `ORDER BY` from such an allow-list, never from the raw string.

`@kitr/table` imports React; in a server without React, split the sort string yourself.

## Filter by a column

A filter is a column id and a string value. Set it from any input with `column.setFilterValue()`; `useUrlTableState` writes it to the URL and resets to page 1. An empty string removes it:

```tsx
// app/components/orders/status-filter.tsx
import type { DataTableFeatures, ReactTable } from '@kitr/table'
import type { Order } from './columns'

export function StatusFilter({ table }: { table: ReactTable<DataTableFeatures, Order> }) {
  const column = table.getColumn('status')
  return (
    <select
      aria-label="Status"
      value={(column?.getFilterValue() as string | undefined) ?? ''}
      onChange={(event) => column?.setFilterValue(event.target.value)}
    >
      <option value="">All statuses</option>
      <option value="open">Open</option>
      <option value="paid">Paid</option>
      <option value="refunded">Refunded</option>
    </select>
  )
}
```

`<DataTable>` builds its table inside, so a filter outside it writes the URL directly, which is the same thing because the URL is the state:

```ts
// app/routes.ts
import { parseTableSearch } from '@kitr/table'

r.page('/orders', {
  validateSearch: parseTableSearch,
  lazy: () => import('./pages/orders/index'),
})
```

```tsx
// app/pages/orders/index.tsx
import { getRouteApi } from '@kitr/router'

const route = getRouteApi('/orders')

export default function OrdersToolbar() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  return (
    <select
      aria-label="Status"
      value={search.filter?.status ?? ''}
      onChange={(event) => {
        const status = event.target.value
        const { status: _, ...rest } = search.filter ?? {}
        const filter = status ? { ...rest, status } : rest
        navigate({
          search: (prev) => ({
            ...prev,
            filter: Object.keys(filter).length ? filter : undefined,
            page: undefined,
          }),
        })
      }}
    >
      <option value="">All statuses</option>
      <option value="open">Open</option>
      <option value="paid">Paid</option>
    </select>
  )
}
```

Filter values are always strings in the URL, so convert a number filter (`minTotal=100`) on the server. For free-text search across columns, add your own `q` param as in [Validate the URL](#validate-the-url).

## Change the page size

`table.setPageSize()` writes `size` to the URL and keeps the first visible row on screen:

```tsx
// app/components/orders/page-size.tsx
import type { DataTableFeatures, ReactTable } from '@kitr/table'
import type { Order } from './columns'

export function PageSize({ table }: { table: ReactTable<DataTableFeatures, Order> }) {
  return (
    <select
      aria-label="Rows per page"
      value={table.state.pagination.pageSize}
      onChange={(event) => table.setPageSize(Number(event.target.value))}
    >
      {[20, 50, 100].map((size) => (
        <option key={size} value={size}>
          {size} rows
        </option>
      ))}
    </select>
  )
}
// choosing 50 => setSearch({ page: undefined, size: 50 })
```

The default size is removed from the URL, and `parseTableSearch` drops sizes above 500, so a hand-edited `?size=100000` falls back to the default.

## Sort and page in the browser

For a small list that arrives in one response, such as one customer's twenty orders, let the table sort, filter and page itself. Add TanStack's row models to the feature set, and turn the manual flags off after the spread:

```tsx
// app/components/orders/customer-orders.tsx
import {
  type ColumnDef,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  dataTableFeatures,
  filterFn_equalsString,
  sortFn_alphanumeric,
  sortFn_basic,
  type TableSearch,
  tableFeatures,
  useTable,
  useUrlTableState,
} from '@kitr/table'
import type { Order } from './columns'

const clientFeatures = tableFeatures({
  ...dataTableFeatures,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
  filterFns: { equalsString: filterFn_equalsString },
})

const columns: ColumnDef<typeof clientFeatures, Order>[] = [
  { accessorKey: 'customer', header: 'Customer' },
  { accessorKey: 'total', header: 'Total' },
  { accessorKey: 'status', header: 'Status', filterFn: 'equalsString' },
]

export function CustomerOrders(props: {
  orders: Order[]
  search: TableSearch
  setSearch: (patch: Partial<TableSearch>) => void
}) {
  const urlState = useUrlTableState({ ...props, defaultPageSize: 10 })
  const table = useTable({
    features: clientFeatures,
    columns,
    data: props.orders,
    ...urlState,
    manualSorting: false,
    manualPagination: false,
    manualFiltering: false,
  })
  return <p>{table.getRowModel().rows.map((row) => row.original.customer).join(', ')}</p>
}
```

Given Grace's 120, Ada's 80 and Linus's 300 and `?sort=-total`, the rows come out Linus, Grace, Ada. The state still lives in the URL; only the work moved to the browser.

> [!WARNING] Add the row models
> Turning the flags off is not enough: `dataTableFeatures` has no row models, so without `sortedRowModel` and the rest the table keeps your row order, whatever the URL says.

`clientTableFeatures` is that feature set ready-made. With it, `useUrlTableState({ search, setSearch, manual: false })` is all a client-side table needs, and `<DataTable columns={columns} data={rows} clientSide {...tableState} />` does both.

## Hide columns

`dataTableFeatures` includes column visibility. Keep it in component state, or in [state](/packages/state) to remember it across visits, and merge it into the URL state:

```tsx
// app/components/orders/orders-table.tsx
import {
  type ColumnDef,
  type DataTableFeatures,
  dataTableFeatures,
  type TableSearch,
  useTable,
  useUrlTableState,
  type VisibilityState,
} from '@kitr/table'
import { useState } from 'react'
import type { Order } from './columns'

export function OrdersTable(props: {
  columns: ColumnDef<DataTableFeatures, Order>[]
  rows: Order[]
  search: TableSearch
  setSearch: (patch: Partial<TableSearch>) => void
}) {
  const urlState = useUrlTableState(props)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({ placedAt: false })
  const table = useTable({
    features: dataTableFeatures,
    columns: props.columns,
    data: props.rows,
    ...urlState,
    state: { ...urlState.state, columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
  })

  return (
    <fieldset>
      {table.getAllLeafColumns().map((column) => (
        <label key={column.id}>
          <input
            type="checkbox"
            checked={column.getIsVisible()}
            onChange={column.getToggleVisibilityHandler()}
          />
          {column.id}
        </label>
      ))}
    </fieldset>
  )
}
```

Spread `urlState` first and merge `urlState.state` into `state`: writing `state: { columnVisibility }` alone would drop sorting, paging and filters. Visibility is a viewer's preference, so it stays out of the URL.

## Select rows

Row selection is not in the default set. Add `rowSelectionFeature` to a feature set of your own, and give rows a stable id so a selection survives a refetch:

```tsx
// app/components/orders/refund-table.tsx
import {
  type ColumnDef,
  dataTableFeatures,
  type RowSelectionState,
  rowSelectionFeature,
  tableFeatures,
  useTable,
} from '@kitr/table'
import { useState } from 'react'
import type { Order } from './columns'

const features = tableFeatures({ ...dataTableFeatures, rowSelectionFeature })

const columns: ColumnDef<typeof features, Order>[] = [{ accessorKey: 'customer', header: 'Customer' }]

export function RefundTable({ orders }: { orders: Order[] }) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const table = useTable({
    features,
    columns,
    data: orders,
    getRowId: (order) => order.id,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
  })

  return (
    <form>
      {table.getRowModel().rows.map((row) => (
        <label key={row.id}>
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
          {row.original.customer}
        </label>
      ))}
      <button type="submit" disabled={!table.getSelectedRowModel().rows.length}>
        Refund {table.getSelectedRowModel().rows.length} orders
      </button>
    </form>
  )
}
```

Checking Grace's order 1001 sets `rowSelection` to `{ '1001': true }`. Without `getRowId`, rows are keyed by page index, so a selection points at different orders after a sort. `<DataTable>` is typed for `dataTableFeatures`; for extra features, edit your copy of `data-table.tsx` or render the rows yourself.

## Render your own markup

`<DataTable>` is one rendering. For another, such as cards on phones, call `useTable` with `dataTableFeatures` and render with `table.FlexRender`:

```tsx
// app/components/orders/orders-grid.tsx
import {
  type ColumnDef,
  type DataTableFeatures,
  dataTableFeatures,
  type TableSearch,
  useTable,
  useUrlTableState,
} from '@kitr/table'
import type { Order } from './columns'

export function OrdersGrid(props: {
  columns: ColumnDef<DataTableFeatures, Order>[]
  rows: Order[]
  total: number
  search: TableSearch
  setSearch: (patch: Partial<TableSearch>) => void
}) {
  const table = useTable({
    features: dataTableFeatures,
    columns: props.columns,
    data: props.rows,
    rowCount: props.total,
    ...useUrlTableState(props),
  })

  return (
    <table>
      <thead>
        {table.getHeaderGroups().map((group) => (
          <tr key={group.id}>
            {group.headers.map((header) => (
              <th key={header.id} aria-sort={header.column.getIsSorted() === 'desc' ? 'descending' : header.column.getIsSorted() === 'asc' ? 'ascending' : 'none'}>
                <button
                  type="button"
                  disabled={!header.column.getCanSort()}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <table.FlexRender header={header} />
                </button>
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id}>
                <table.FlexRender cell={cell} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td>
            Page {table.state.pagination.pageIndex + 1} of {table.getPageCount()}
            <button type="button" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
              Next
            </button>
          </td>
        </tr>
      </tfoot>
    </table>
  )
}
```

With 45 orders and the default size of 20, `table.getPageCount()` is `3`. [TanStack's table guides](https://tanstack.com/table/latest/docs/guide/tables) cover header groups, footers, pinning and the rest.

## Keep table state out of the URL

`useUrlTableState` only needs `search` and `setSearch`, so any state store works. For a table in a dialog, where the URL should not change, use `useState`:

```tsx
// app/components/orders/pick-order-dialog.tsx
import { type ColumnDef, type DataTableFeatures, type TableSearch, useUrlTableState } from '@kitr/table'
import { useState } from 'react'
import { DataTable } from '#components/ui/data-table'
import type { Order } from './columns'

export function PickOrderDialog(props: { columns: ColumnDef<DataTableFeatures, Order>[]; orders: Order[] }) {
  const [search, setSearchState] = useState<TableSearch>({})
  const urlState = useUrlTableState({
    search,
    setSearch: (patch) => setSearchState((prev) => ({ ...prev, ...patch })),
    defaultPageSize: 10,
  })
  return <DataTable columns={props.columns} data={props.orders} {...urlState} />
}
```

Closing the dialog forgets the sort; everything else behaves as it does in the URL.

## Testing

A test renders the table with a `search` object and a mock `setSearch`, clicks, and asserts what would have gone into the URL. No router is needed:

```tsx
// app/components/orders/orders-grid.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import {
  type ColumnDef,
  type DataTableFeatures,
  dataTableFeatures,
  type TableSearch,
  useTable,
  useUrlTableState,
} from '@kitr/table'
import { describe, expect, it, vi } from 'vitest'

interface Order {
  id: string
  customer: string
  total: number
  status: string
}

const orders: Order[] = [
  { id: '1001', customer: 'Grace', total: 120, status: 'open' },
  { id: '1002', customer: 'Ada', total: 80, status: 'paid' },
]

const columns: ColumnDef<DataTableFeatures, Order>[] = [
  { accessorKey: 'customer', header: 'Customer' },
  { accessorKey: 'total', header: 'Total' },
  { accessorKey: 'status', header: 'Status', enableSorting: false },
]

function OrdersGrid(props: { search: TableSearch; setSearch: (patch: Partial<TableSearch>) => void }) {
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: orders,
    rowCount: 45,
    ...useUrlTableState(props),
  })
  return (
    <div>
      {table.getHeaderGroups()[0]?.headers.map((header) => (
        <button
          key={header.id}
          type="button"
          disabled={!header.column.getCanSort()}
          onClick={header.column.getToggleSortingHandler()}
        >
          <table.FlexRender header={header} />
        </button>
      ))}
      <button type="button" onClick={() => table.nextPage()}>
        Next
      </button>
      <p>
        Page {table.state.pagination.pageIndex + 1} of {table.getPageCount()}
      </p>
    </div>
  )
}

describe('orders grid', () => {
  it('reads the page from the URL', () => {
    render(<OrdersGrid search={{ page: 2 }} setSearch={vi.fn()} />)
    expect(screen.getByText('Page 2 of 3')).toBeTruthy()
  })

  it('sorts by total, largest first, and resets the page', () => {
    const setSearch = vi.fn()
    render(<OrdersGrid search={{ page: 2 }} setSearch={setSearch} />)

    fireEvent.click(screen.getByRole('button', { name: 'Total' }))

    expect(setSearch).toHaveBeenLastCalledWith({ sort: '-total', page: undefined })
  })

  it('writes the next page to the URL', () => {
    const setSearch = vi.fn()
    render(<OrdersGrid search={{}} setSearch={setSearch} />)

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(setSearch).toHaveBeenLastCalledWith({ page: 2, size: undefined })
  })

  it('does not sort by status', () => {
    render(<OrdersGrid search={{}} setSearch={vi.fn()} />)
    expect((screen.getByRole('button', { name: 'Status' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
```

To test the route's own `validateSearch`, call `parseTableSearch` with the raw params a link could carry, as in [Validate the URL](#validate-the-url). To render the real page with its loader, see [testing](/packages/testing/guide#render-a-whole-page).

## Next steps

- [API reference](/packages/table/api): every export of `@kitr/table`.
- [Router](/packages/router): `validateSearch`, `loaderDeps` and `navigate`, which the URL state uses.
- [Query](/packages/query): cache each page of rows by its search params.
