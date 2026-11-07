import { definePackage } from '@kitr/core/package'

/** `kitr add query`: TanStack Query over kitr's data contract, with its provider and config. */
export default definePackage({
  name: 'query',
  client: true,
  add(ctx) {
    ctx.deps.add('@tanstack/react-query', { name: '@tanstack/react-query-devtools', dev: true })
    ctx.provider.add('@kitr/query/provider')
    ctx.config(
      'query',
      `import { defineConfig } from 'kitr/query'\n\nexport default defineConfig({\n  // Navigating back within 30s never refetches.\n  staleTime: 30_000,\n})\n`,
    )
    ctx.agents.add(
      'query',
      `- Import from \`kitr/query\`, never from \`@tanstack/react-query\` directly.\n- Every data source becomes \`queryFrom(...)\` / \`mutationFrom(...)\` in \`app/features/<name>/queries.ts\`. Components use \`useSuspenseQuery(x.options(input))\`.\n- Route loaders call \`context.queryClient.ensureQueryData(x.options(input))\` so data is fetched once for server and client.\n- Mutations declare \`effects\` (invalidate/set keys). Never call \`queryClient.invalidateQueries\` inline in components.`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/query/provider')
    ctx.deps.remove('@tanstack/react-query', '@tanstack/react-query-devtools')
    ctx.agents.remove('query')
  },
  wraps: { '@tanstack/react-query': 'kitr/query' },
  eject: { 'kitr/query': '@tanstack/react-query (+ queryOptions helpers)' },
  vite: { optimizeDeps: ['@tanstack/react-query'] },
})
