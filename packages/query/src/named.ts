import {
  type MutationName,
  type OperationInput,
  type OperationLike,
  type OperationName,
  type OperationOf,
  type OperationOutput,
  operations,
  type QueryName,
} from '@kitr/core'
import {
  type QueryClient,
  type QueryKey,
  queryOptions as tanstackQueryOptions,
  useMutation as tanstackUseMutation,
  useQuery as tanstackUseQuery,
  useSuspenseQuery as tanstackUseSuspenseQuery,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
  type UseSuspenseQueryOptions,
  type UseSuspenseQueryResult,
  useQueryClient,
} from '@tanstack/react-query'
import type { MutationDefinition, QueryDefinition } from './contract'

/**
 * The name forms. Every hook here takes a query or mutation three ways: by the name `kitr types`
 * registered (`useQuery('projects.list', input)`), as the imported definition
 * (`useQuery(listProjects, input)`), or as plain TanStack options, which pass straight through.
 * The first two resolve to the definition's own TanStack options, so there is nothing kitr adds
 * beyond the lookup and, for mutations, the cache effects.
 */

/** `[input?, options?]` when the input can be left out (`void`, or every field optional), `[input, options?]` otherwise. */
type InputArgs<I, O> = void extends I
  ? [input?: I, options?: O]
  : {} extends I
    ? [input?: I, options?: O]
    : [input: I, options?: O]

type QueryOverrides<TOutput> = Omit<
  UseQueryOptions<TOutput, Error, TOutput, QueryKey>,
  'queryKey' | 'queryFn'
>
type SuspenseOverrides<TOutput> = Omit<
  UseSuspenseQueryOptions<TOutput, Error, TOutput, QueryKey>,
  'queryKey' | 'queryFn'
>
type MutationOverrides<TInput, TOutput> = Omit<
  UseMutationOptions<TOutput, Error, TInput>,
  'mutationFn'
>

type InputOfName<N> = OperationInput<OperationOf<N>>
type OutputOfName<N> = OperationOutput<OperationOf<N>>

interface NamedUseQuery {
  <N extends QueryName>(
    name: N,
    ...args: InputArgs<InputOfName<N>, QueryOverrides<OutputOfName<N>>>
  ): UseQueryResult<OutputOfName<N>, Error>
  <TInput, TOutput>(
    definition: QueryDefinition<TInput, TOutput>,
    ...args: InputArgs<TInput, QueryOverrides<TOutput>>
  ): UseQueryResult<TOutput, Error>
}

interface NamedUseSuspenseQuery {
  <N extends QueryName>(
    name: N,
    ...args: InputArgs<InputOfName<N>, SuspenseOverrides<OutputOfName<N>>>
  ): UseSuspenseQueryResult<OutputOfName<N>, Error>
  <TInput, TOutput>(
    definition: QueryDefinition<TInput, TOutput>,
    ...args: InputArgs<TInput, SuspenseOverrides<TOutput>>
  ): UseSuspenseQueryResult<TOutput, Error>
}

interface NamedUseMutation {
  <N extends MutationName>(
    name: N,
    overrides?: MutationOverrides<InputOfName<N>, OutputOfName<N>>,
  ): UseMutationResult<OutputOfName<N>, Error, InputOfName<N>>
  <TInput, TOutput>(
    definition: MutationDefinition<TInput, TOutput>,
    overrides?: MutationOverrides<TInput, TOutput>,
  ): UseMutationResult<TOutput, Error, TInput>
}

interface NamedQueryOptions {
  <N extends QueryName>(
    name: N,
    ...args: InputArgs<InputOfName<N>, never>
  ): ReturnType<QueryDefinition<InputOfName<N>, OutputOfName<N>>['options']>
  <TInput, TOutput>(
    definition: QueryDefinition<TInput, TOutput>,
    ...args: InputArgs<TInput, never>
  ): ReturnType<QueryDefinition<TInput, TOutput>['options']>
}

function isDefinition(value: unknown): value is OperationLike {
  return (
    !!value &&
    (typeof value === 'object' || typeof value === 'function') &&
    'contract' in value &&
    ((value as OperationLike).kind === 'query' || (value as OperationLike).kind === 'mutation')
  )
}

/** The definition behind a name or a definition; anything else is TanStack's own input. */
function resolve(source: unknown): OperationLike | undefined {
  if (typeof source === 'string') return operations.get(source)
  if (isDefinition(source)) return source
  return undefined
}

function asQuery(op: OperationLike, source: unknown): QueryDefinition<unknown, unknown> {
  if (op.kind !== 'query')
    throw new Error(
      `[@kitr/query] ${typeof source === 'string' ? `"${source}"` : op.name} is a mutation; use useMutation or call`,
    )
  return op as unknown as QueryDefinition<unknown, unknown>
}

function asMutation(op: OperationLike, source: unknown): MutationDefinition<unknown, unknown> {
  if (op.kind !== 'mutation')
    throw new Error(
      `[@kitr/query] ${typeof source === 'string' ? `"${source}"` : op.name} is a query; use useQuery or queryOptions`,
    )
  return op as unknown as MutationDefinition<unknown, unknown>
}

/**
 * TanStack's `useQuery`, plus the name and definition forms:
 * `useQuery('projects.list', input)` and `useQuery(listProjects, input)`.
 */
export const useQuery: NamedUseQuery & typeof tanstackUseQuery = ((
  source: unknown,
  input?: unknown,
  overrides?: object,
) => {
  const op = resolve(source)
  if (!op) return tanstackUseQuery(source as any, input as any)
  return tanstackUseQuery({ ...asQuery(op, source).options(input), ...overrides } as any)
}) as any

/** TanStack's `useSuspenseQuery`, plus the name and definition forms. */
export const useSuspenseQuery: NamedUseSuspenseQuery & typeof tanstackUseSuspenseQuery = ((
  source: unknown,
  input?: unknown,
  overrides?: object,
) => {
  const op = resolve(source)
  if (!op) return tanstackUseSuspenseQuery(source as any, input as any)
  return tanstackUseSuspenseQuery({ ...asQuery(op, source).options(input), ...overrides } as any)
}) as any

/**
 * TanStack's `useMutation`, plus the name and definition forms: `useMutation('projects.update')`
 * and `useMutation(updateProject)`. Both apply the definition's cache effects on success, then
 * your own `onSuccess`.
 */
export const useMutation: NamedUseMutation & typeof tanstackUseMutation = ((
  source: unknown,
  overrides?: unknown,
) => {
  // Always the same hooks in the same order: a call site is one form for its whole life.
  const queryClient = useQueryClient()
  const op = resolve(source)
  if (!op) return tanstackUseMutation(source as any, overrides as any)
  const definition = asMutation(op, source)
  const name = typeof source === 'string' ? source : op.name
  const extra = (overrides ?? {}) as MutationOverrides<unknown, unknown>
  const base = definition.options({ queryClient })
  return tanstackUseMutation({
    // A named mutation is keyed by its name, so a paused one saved by @kitr/offline finds its
    // mutationFn again after the app restarts (mutationKeyFor).
    ...(name ? { mutationKey: mutationKeyFor(name) } : {}),
    ...base,
    ...extra,
    onSuccess: async (result, input, ctx, mutation) => {
      await base.onSuccess?.(result, input, ctx, mutation)
      await extra.onSuccess?.(result, input, ctx, mutation)
    },
  })
}) as any

/** The `mutationKey` every `useMutation(name)` call uses: `['kitr:mutation', name]`. */
export function mutationKeyFor(name: string): readonly unknown[] {
  return ['kitr:mutation', name]
}

/**
 * TanStack's `queryOptions`, plus the name and definition forms, for loaders and prefetching:
 * `context.queryClient.ensureQueryData(queryOptions('projects.list', input))`.
 */
export const queryOptions: NamedQueryOptions & typeof tanstackQueryOptions = ((
  source: unknown,
  input?: unknown,
) => {
  const op = resolve(source)
  if (!op) return tanstackQueryOptions(source as any)
  return asQuery(op, source).options(input)
}) as any

/**
 * Run an operation by name, outside React: a query fetches, a mutation mutates. On the client it
 * is a request; on the server it runs the handler in-process.
 *
 *   await call('projects.update', { id, name })
 */
export function call<N extends OperationName>(
  name: N,
  ...args: InputArgs<InputOfName<N>, { signal?: AbortSignal }>
): Promise<OutputOfName<N>>
export function call(name: string, input?: unknown, options: { signal?: AbortSignal } = {}) {
  const op = operations.get(name)
  if (op.kind === 'query')
    return (op as unknown as QueryDefinition<unknown, unknown>).fetch(input, options.signal)
  return (op as unknown as MutationDefinition<unknown, unknown>).mutate(input)
}

export type { QueryClient }
