import {
  type CacheEffect,
  type MutationContract,
  type QueryContract,
  type SubscriptionContract,
  toKitrError,
} from '@kitr/core'
import { type QueryClient, queryOptions, type UseMutationOptions } from '@tanstack/react-query'
import { applyCacheEffect } from './effects'

/** What `queryFrom` returns: the contract plus `key`, `options` and `fetch` helpers for one query. */
export type QueryDefinition<TInput, TOutput> = ReturnType<typeof queryFrom<TInput, TOutput>>

/**
 * Turns a query contract from any source (HTTP, API routes, actions or hand-written) into a reusable query.
 * `orderQuery.options(id)` gives TanStack `queryOptions` for `useQuery`, `useSuspenseQuery` or
 * `ensureQueryData` in a loader, with failures normalised to `KitrError`.
 */
export function queryFrom<TInput = void, TOutput = unknown>(
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

/** What `mutationFrom` returns: a mutation contract with helpers to run it through TanStack with its cache effects. */
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
 * (set, invalidate, remove) are applied to the cache on success. Run it with `useMutation`.
 */
export function mutationFrom<TInput = void, TOutput = unknown>(
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

/** What `subscriptionFrom` returns: an event stream contract that `useSubscription` opens. */
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
export function subscriptionFrom<TInput = void, TEvent = unknown>(
  contract: Omit<SubscriptionContract<TInput, TEvent>, 'kind'>,
): SubscriptionDefinition<TInput, TEvent> {
  const full: SubscriptionContract<TInput, TEvent> = { kind: 'subscription', ...contract }
  return { kind: 'subscription', contract: full, key: (input) => full.key(input) }
}
