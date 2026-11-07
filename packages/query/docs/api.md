---
title: API
description: Every export of kitr/query.
order: 2
---

# API

`kitr/query` re-exports everything from `@tanstack/react-query` and adds the following.

## defineQuery

```ts
function defineQuery<TInput = void, TOutput = unknown>(contract: {
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

## defineMutation

```ts
function defineMutation<TInput = void, TOutput = unknown>(contract: {
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

## useKitrMutation

```ts
function useKitrMutation<TInput, TOutput>(
  definition: MutationDefinition<TInput, TOutput>,
  overrides?: Omit<UseMutationOptions<TOutput, Error, TInput>, 'mutationFn'>,
): UseMutationResult<TOutput, Error, TInput>
```

`useMutation` with effects applied to the active `QueryClient`. Your own `onSuccess` runs after the effects.

## defineSubscription and useSubscription

```ts
function defineSubscription<TInput = void, TEvent = unknown>(contract: {
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
