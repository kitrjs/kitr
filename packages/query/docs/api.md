---
title: API
description: Every export of kitr/query.
order: 2
---

# API

`kitr/query` re-exports everything from `@tanstack/react-query` and adds the following.

## queryFrom

```ts
function queryFrom<TInput = void, TOutput = unknown>(contract: {
  key: (input: TInput) => QueryKey
  fetch: (input: TInput, ctx: { signal?: AbortSignal }) => Promise<TOutput>
  staleTime?: number
  source?: string
}): QueryDefinition<TInput, TOutput>
```

| Member | Description |
| --- | --- |
| `options(input)` | TanStack `queryOptions` for `useQuery`, `useSuspenseQuery`, `ensureQueryData`. Errors are normalised to `KitrError`. |
| `key(input)` | The cache key. |
| `fetch(input, signal?)` | Call the source directly, bypassing the cache. |
| `contract` | The full contract, for tooling. |

## mutationFrom

```ts
function mutationFrom<TInput = void, TOutput = unknown>(contract: {
  mutate: (input: TInput) => Promise<TOutput>
  effects?: CacheEffect | ((result: TOutput, input: TInput) => CacheEffect)
  source?: string
}): MutationDefinition<TInput, TOutput>
```

| Member | Description |
| --- | --- |
| `options({ queryClient })` | TanStack mutation options that apply `effects` on success. |
| `mutate(input)` | Call the source directly, without effects. |
| `effectsFor(result, input)` | The effects for one result. |

## useMutation

```ts
function useMutation<TInput, TOutput>(
  definition: MutationDefinition<TInput, TOutput> | MutationName,
  overrides?: Omit<UseMutationOptions<TOutput, Error, TInput>, 'mutationFn'>,
): UseMutationResult<TOutput, Error, TInput>
```

TanStack's `useMutation`, plus two more forms: a mutation definition from `mutationFrom`, or a name `kitr types` registered. Both apply the mutation's cache effects to the active `QueryClient`, then your own `onSuccess`. Plain TanStack options pass straight through.

## subscriptionFrom and useSubscription

```ts
function subscriptionFrom<TInput = void, TEvent = unknown>(contract: {
  key: (input: TInput) => QueryKey
  subscribe: (input: TInput, handlers: { next(event: TEvent): void; error?(e: KitrErrorShape): void }) => () => void
  effects?: (event: TEvent, input: TInput) => CacheEffect | void
}): SubscriptionDefinition<TInput, TEvent>

function useSubscription<TInput, TEvent>(
  definition: SubscriptionDefinition<TInput, TEvent>,
  input: TInput,
  options?: { enabled?: boolean; onEvent?: (event: TEvent) => void; onError?: (error: KitrErrorShape) => void },
): { status: 'idle' | 'open' | 'error'; lastEvent?: TEvent; error?: KitrErrorShape }
```

## CacheEffect

```ts
interface CacheEffect {
  invalidate?: QueryKey[]                       // prefix match
  set?: Array<{ key: QueryKey; data: unknown }> // write without refetching
  remove?: QueryKey[]
}
```

## applyCacheEffect and invalidate

```ts
applyCacheEffect(queryClient, effect): Promise<void>
invalidate(queryClient, ...keys): Promise<void[]>
```

For applying effects outside a mutation, such as in a test or a custom event handler.

## createQueryClient and defineConfig

```ts
createQueryClient(config?: QueryConfig): QueryClient
defineConfig(config: QueryConfig): QueryConfig
```

The provider calls `createQueryClient` with `config/query.ts` and binds it as `queryClient` in the container and in router context.
