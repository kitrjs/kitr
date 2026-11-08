import { createDefineConfig, defineProvider, getDevtools, type KitrProvider } from '@kitr/core'
import { type DefaultOptions, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

/** Options for `config/query.ts`; the provider builds the app's `QueryClient` from them. */
export interface QueryConfig {
  /** Default `staleTime` in ms. kitr defaults to 30s so back-navigation doesn't refetch. */
  staleTime?: number
  /** Passed straight to `new QueryClient({ defaultOptions })`. */
  defaultOptions?: DefaultOptions
  /** Build your own client instead. */
  createClient?: () => QueryClient
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    query: QueryConfig
  }
  interface ContainerBindings {
    queryClient: QueryClient
  }
}

/** Types `config/query.ts`: `export default defineConfig({ staleTime: 30_000 })`. */
export const defineConfig = createDefineConfig<QueryConfig>()

/**
 * Builds the `QueryClient` the provider binds: `staleTime` defaults to 30s, and queries never
 * retry a 4xx error but retry other failures twice. `createClient` replaces all of it.
 */
export function createQueryClient(config: QueryConfig = {}): QueryClient {
  if (config.createClient) return config.createClient()
  return new QueryClient({
    defaultOptions: {
      ...config.defaultOptions,
      queries: {
        staleTime: config.staleTime ?? 30_000,
        retry: (count, error) => {
          const status = (error as any)?.status
          if (status && status >= 400 && status < 500) return false
          return count < 2
        },
        ...config.defaultOptions?.queries,
      },
    },
  })
}

/**
 * Binds `queryClient` into the container and wraps the tree in QueryClientProvider.
 * Listed in `kitrrc.ts` as `() => import('@kitr/query/provider')`.
 */
export const queryProvider: KitrProvider = defineProvider({
  name: 'query',
  register(app) {
    // Scoped: on the server every request (a forked app) gets its own cache, so one user's
    // data can never render for another. In the browser there is one app, so one client.
    app.container.scoped('queryClient', () => createQueryClient(app.config.get('query', {})))
  },
  boot(app) {
    const hub = getDevtools(app)
    if (!hub) return
    // Re-render the Query panel whenever the cache changes; log failed mutations.
    const client = app.container.use('queryClient')
    client.getQueryCache().subscribe(() => hub.notify())
    client.getMutationCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'error')
        hub.log(
          'query',
          `mutation failed: ${JSON.stringify(event.mutation.options.mutationKey ?? '')}`,
          event.action.error,
          'error',
        )
    })
  },
  wrap(children, app) {
    const client = app.container.use('queryClient')
    return <QueryClientProvider client={client}>{children as ReactNode}</QueryClientProvider>
  },
  devtools: (_app, ui) => import('./devtools').then((m) => m.panels(ui)),
})

export default queryProvider
