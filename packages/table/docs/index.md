---
title: Tables
description: Show rows of data with sorting, paging and filters that stay in the URL.
order: 1
---

# Tables

Admin screens, dashboards and reports all need the same thing: a table people can sort, page through and filter. `kitr/table` keeps those choices in the page's URL, so a filtered view survives a reload, works with the back button, and can be shared as a link.

It is [TanStack Table](https://tanstack.com/table) v9, re-exported, plus `useUrlTableState` and a ready-made feature set.

## Install

```sh
kitr add table
```

This installs `@kitr/table` and `@tanstack/react-table`. There is no config file. `kitr ui add data-table` copies a styled `<DataTable>` into `app/components/ui`.

## Sorting and paging in the URL

Three steps: let the route accept table search params, bind the table to them, and fetch the matching page.

```tsx
// app/routes/projects/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from 'kitr/query'
import { parseTableSearch, useUrlTableState } from 'kitr/table'
import { DataTable } from '#app/components/ui/data-table'
import { columns } from '#app/features/projects/columns'
import { projectsQuery } from '#app/features/projects/queries'

export const Route = createFileRoute('/projects/')({
  // 1. ?page=2&size=50&sort=-createdAt&filter[status]=active
  validateSearch: parseTableSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(projectsQuery.options(deps)),
  component: Projects,
})

function Projects() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data } = useSuspenseQuery(projectsQuery.options(search))

  // 2. Sorting, paging and filters read from and write to the URL.
  const urlState = useUrlTableState({
    search,
    setSearch: (patch) => navigate({ search: (s) => ({ ...s, ...patch }) }),
  })

  // 3. The table itself.
  return <DataTable columns={columns} data={data.rows} rowCount={data.total} {...urlState} />
}
```

Without the registry component, pass the same options to `useTable` with `features: dataTableFeatures` and render the rows yourself.

Changing the sort resets to page one. Default values (page 1, the default page size, no sort) are left out of the URL to keep links short.

## How the URL looks

| Table state | URL | Notes |
| --- | --- | --- |
| Page 3 | `?page=3` | One-based, unlike TanStack's zero-based `pageIndex`. |
| 50 rows per page | `?size=50` | Up to 500. |
| Name A to Z, then newest | `?sort=name,-createdAt` | A leading `-` means descending. |
| Status is active | `?filter[status]=active` | One entry per filtered column. |

`parseTableSearch` validates all of this and drops anything malformed, so a hand-edited URL can't break the page.

## Server-side by default

`useUrlTableState` sets `manualSorting`, `manualPagination` and `manualFiltering`, because the usual case is a server that returns one page at a time. Pass the same `search` object to your query so the API sorts and filters.

For a small dataset you sort in the browser, override them after the spread: `{ ...urlState, manualSorting: false, manualPagination: false }`.

## Next steps

- [API reference](/packages/table/api)
- [TanStack Table docs](https://tanstack.com/table/latest): everything there works as written, imported from `kitr/table`.
