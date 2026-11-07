import {
  type CacheEffect,
  type MutationContract,
  type QueryContract,
  type SubscriptionContract,
  toKitrError,
} from '@kitr/core'
import {
  type QueryClient,
  queryOptions,
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { applyCacheEffect } from './effects'

/**
 * `defineQuery` turns a contract from any source into a reusable query definition.
 * `projectQuery.options(id)` gives TanStack `queryOptions`, ready for `useQuery`,
 * `useSuspenseQuery` or `ensureQueryData` in a loader.
 */
export type QueryDefinition<TInput, TOutput> = ReturnType<typeof defineQuery<TInput, TOutput>>

export function defineQuery<TInput = void, TOutput = unknown>(
  contract: Omit<QueryContract<TInput, TOutput>, 'kind'>,
) {
  const full: QueryContract<TInput, TOutput> = { kind: 'query', ...contract }
  return {
    kind: 'query' as const,
    contract: full,
    key: (input: TInput) => full.key(input),
    options: (input: TInput) =>
      queryOptions<TOutput, Error, TOutput, readonly unknown[]>({
        queryKey: full.key(input),
        queryFn: async ({ signal }) => {
          try {
            return await full.fetch(input, { signal })
          } catch (error) {
            throw toKitrError(error)
          }
        },
        ...(full.staleTime !== undefined ? { staleTime: full.staleTime } : {}),
        meta: { source: full.source },
      }),
    fetch: (input: TInput, signal?: AbortSignal) => full.fetch(input, { signal }),
  }
}

export interface MutationDefinition<TInput, TOutput> {
  readonly kind: 'mutation'
  readonly contract: MutationContract<TInput, TOutput>
  /** TanStack mutation options; pass a queryClient to get cache effects applied. */
  options(ctx: { queryClient: QueryClient }): UseMutationOptions<TOutput, Error, TInput>
  mutate(input: TInput): Promise<TOutput>
  effectsFor(result: TOutput, input: TInput): CacheEffect | undefined
}

export function defineMutation<TInput = void, TOutput = unknown>(
  contract: Omit<MutationContract<TInput, TOutput>, 'kind'>,
): MutationDefinition<TInput, TOutput> {
  const full: MutationContract<TInput, TOutput> = { kind: 'mutation', ...contract }
  const effectsFor = (result: TOutput, input: TInput) =>
    typeof full.effects === 'function' ? full.effects(result, input) : full.effects
  return {
    kind: 'mutation',
    contract: full,
    effectsFor,
    mutate: full.mutate,
    options: ({ queryClient }) => ({
      mutationFn: async (input: TInput) => {
        try {
          return await full.mutate(input)
        } catch (error) {
          throw toKitrError(error)
        }
      },
      onSuccess: async (result, input) => {
        await applyCacheEffect(queryClient, effectsFor(result, input))
      },
      meta: { source: full.source },
    }),
  }
}

/**
 * `useMutation` for a kitr mutation definition, with cache effects wired to the active QueryClient.
 * `useMutation(definition)` from `kitr/query` does the same; this name stays for existing code.
 */
export function useKitrMutation<TInput, TOutput>(
  definition: MutationDefinition<TInput, TOutput>,
  overrides: Omit<UseMutationOptions<TOutput, Error, TInput>, 'mutationFn'> = {},
) {
  const queryClient = useQueryClient()
  const base = definition.options({ queryClient })
  return useMutation<TOutput, Error, TInput>({
    ...base,
    ...overrides,
    onSuccess: async (result, input, ctx, mutation) => {
      await base.onSuccess?.(result, input, ctx, mutation)
      await overrides.onSuccess?.(result, input, ctx, mutation)
    },
  })
}

export interface SubscriptionDefinition<TInput, TEvent> {
  readonly kind: 'subscription'
  readonly contract: SubscriptionContract<TInput, TEvent>
  key(input: TInput): readonly unknown[]
}

export function defineSubscription<TInput = void, TEvent = unknown>(
  contract: Omit<SubscriptionContract<TInput, TEvent>, 'kind'>,
): SubscriptionDefinition<TInput, TEvent> {
  const full: SubscriptionContract<TInput, TEvent> = { kind: 'subscription', ...contract }
  return { kind: 'subscription', contract: full, key: (input) => full.key(input) }
}
