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

/** What `defineQuery` returns: the contract plus `key`, `options` and `fetch` helpers for one query. */
export type QueryDefinition<TInput, TOutput> = ReturnType<typeof defineQuery<TInput, TOutput>>

/**
 * Turns a query contract from any source (HTTP, API routes, actions or hand-written) into a reusable query.
 * `orderQuery.options(id)` gives TanStack `queryOptions` for `useQuery`, `useSuspenseQuery` or
 * `ensureQueryData` in a loader, with failures normalised to `KitrError`.
 */
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

/** What `defineMutation` returns: a mutation contract with helpers to run it through TanStack with its cache effects. */
export interface MutationDefinition<TInput, TOutput> {
  /** Always `'mutation'`; tells definitions apart at run time. */
  readonly kind: 'mutation'
  /** The full contract, including `kind`, for tooling and devtools. */
  readonly contract: MutationContract<TInput, TOutput>
  /** TanStack mutation options; pass a queryClient to get cache effects applied. */
  options(ctx: { queryClient: QueryClient }): UseMutationOptions<TOutput, Error, TInput>
  /** Calls the source directly: no cache effects and no `KitrError` normalisation. */
  mutate(input: TInput): Promise<TOutput>
  /** The cache effects one result would produce, for tests and custom handlers. */
  effectsFor(result: TOutput, input: TInput): CacheEffect | undefined
}

/**
 * Turns a mutation contract from any source into a reusable mutation whose `effects`
 * (set, invalidate, remove) are applied to the cache on success. Run it with `useKitrMutation`.
 */
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

/** `useMutation` for a kitr mutation definition, with cache effects wired to the active QueryClient. */
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

/** What `defineSubscription` returns: an event stream contract that `useSubscription` opens. */
export interface SubscriptionDefinition<TInput, TEvent> {
  /** Always `'subscription'`; tells definitions apart at run time. */
  readonly kind: 'subscription'
  /** The full contract: `subscribe`, `effects` and `source`. */
  readonly contract: SubscriptionContract<TInput, TEvent>
  /** The key for one input; `useSubscription` resubscribes only when it changes. */
  key(input: TInput): readonly unknown[]
}

/**
 * Turns a stream of events (a socket channel, an SSE feed) into a subscription whose
 * `effects` land in the same cache that queries read. Open it with `useSubscription`.
 */
export function defineSubscription<TInput = void, TEvent = unknown>(
  contract: Omit<SubscriptionContract<TInput, TEvent>, 'kind'>,
): SubscriptionDefinition<TInput, TEvent> {
  const full: SubscriptionContract<TInput, TEvent> = { kind: 'subscription', ...contract }
  return { kind: 'subscription', contract: full, key: (input) => full.key(input) }
}
