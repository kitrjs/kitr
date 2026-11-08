import type { KitrErrorShape } from './errors'

/**
 * The data contract. Every source (external HTTP API, server action, kitr API
 * route, socket channel) produces these shapes, and `@kitr/query` turns them
 * into TanStack Query options over one cache.
 */
export type QueryKey = readonly unknown[]

/** What a mutation or socket event does to the cache. */
export interface CacheEffect {
  /** Keys to invalidate (prefix match, as TanStack does). */
  invalidate?: QueryKey[]
  /** Entries to set directly, skipping a refetch. */
  set?: Array<{ key: QueryKey; data: unknown }>
  /** Entries to remove. */
  remove?: QueryKey[]
}

export interface QueryContract<TInput, TOutput> {
  kind: 'query'
  /** Stable key for the cache. Must include every input that changes the result. */
  key: (input: TInput) => QueryKey
  fetch: (input: TInput, ctx: { signal?: AbortSignal }) => Promise<TOutput>
  /** Source label for devtools and doctor: 'http' | 'action' | 'api' | 'socket'. */
  source?: string
  staleTime?: number
}

export interface MutationContract<TInput, TOutput> {
  kind: 'mutation'
  mutate: (input: TInput) => Promise<TOutput>
  /** Cache effects after success. A function gets the result and input. */
  effects?: CacheEffect | ((result: TOutput, input: TInput) => CacheEffect)
  source?: string
}

export interface SubscriptionContract<TInput, TEvent> {
  kind: 'subscription'
  key: (input: TInput) => QueryKey
  subscribe: (
    input: TInput,
    handlers: { next: (event: TEvent) => void; error?: (e: KitrErrorShape) => void },
  ) => () => void
  /** Map an event to cache effects; `@kitr/query` applies them. */
  effects?: (event: TEvent, input: TInput) => CacheEffect | void
  source?: string
}

export type AnyContract =
  | QueryContract<any, any>
  | MutationContract<any, any>
  | SubscriptionContract<any, any>

export type ContractInput<C> =
  C extends QueryContract<infer I, any>
    ? I
    : C extends MutationContract<infer I, any>
      ? I
      : C extends SubscriptionContract<infer I, any>
        ? I
        : never

export type ContractOutput<C> =
  C extends QueryContract<any, infer O>
    ? O
    : C extends MutationContract<any, infer O>
      ? O
      : C extends SubscriptionContract<any, infer E>
        ? E
        : never

/** Query-key factory per resource, so every source agrees on key shapes. */
export function createKeys<const Name extends string>(name: Name) {
  const all = [name] as const
  return {
    all,
    lists: () => [name, 'list'] as const,
    list: <F = unknown>(filters?: F) =>
      filters === undefined ? ([name, 'list'] as const) : ([name, 'list', filters] as const),
    details: () => [name, 'detail'] as const,
    detail: <Id = string | number>(id: Id) => [name, 'detail', id] as const,
    custom: <const Rest extends readonly unknown[]>(...rest: Rest) => [name, ...rest] as const,
  }
}

export type Keys<Name extends string> = ReturnType<typeof createKeys<Name>>

/** Does `candidate` start with `prefix`? Mirrors TanStack's partial key matching. */
export function keyMatches(prefix: QueryKey, candidate: QueryKey): boolean {
  if (prefix.length > candidate.length) return false
  return prefix.every((part, i) => deepEqual(part, candidate[i]))
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  const ak = Object.keys(a as object)
  const bk = Object.keys(b as object)
  if (ak.length !== bk.length) return false
  return ak.every((k) => deepEqual((a as any)[k], (b as any)[k]))
}

/** Merge several cache effects into one. */
export function mergeEffects(...effects: Array<CacheEffect | void | undefined>): CacheEffect {
  const out: CacheEffect = {}
  for (const e of effects) {
    if (!e) continue
    if (e.invalidate) out.invalidate = [...(out.invalidate ?? []), ...e.invalidate]
    if (e.set) out.set = [...(out.set ?? []), ...e.set]
    if (e.remove) out.remove = [...(out.remove ?? []), ...e.remove]
  }
  return out
}
