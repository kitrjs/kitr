import { definePackage } from '@kitr/core/package'

/** `kitr add table`: TanStack Table with sorting, pagination and filters bound to URL search params. */
export default definePackage({
  name: 'table',
  client: true,
  add(ctx) {
    ctx.deps.add('@tanstack/react-table')
    ctx.agents.add(
      'table',
      `- Tables: \`validateSearch: parseTableSearch\` on the route, \`useUrlTableState({ search, setSearch })\` spread into \`useReactTable\` or the registry \`<DataTable>\`. Sorting/paging live in the URL, so views are shareable.`,
    )
  },
  remove(ctx) {
    ctx.deps.remove('@tanstack/react-table')
    ctx.agents.remove('table')
  },
  wraps: { '@tanstack/react-table': '@kitr/table' },
  eject: { '@kitr/table': '@tanstack/react-table' },
  vite: { optimizeDeps: ['@tanstack/react-table'] },
})
