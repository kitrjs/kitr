import { createDefineConfig, defineProvider, type KitrProvider } from '@kitr/core'
import { type DefaultOptions, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

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

export const defineConfig = createDefineConfig<QueryConfig>()

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
    app.container.singleton('queryClient', () => createQueryClient(app.config.get('query', {})))
  },
  wrap(children, app) {
    const client = app.container.use('queryClient')
    return <QueryClientProvider client={client}>{children as ReactNode}</QueryClientProvider>
  },
})

export default queryProvider
