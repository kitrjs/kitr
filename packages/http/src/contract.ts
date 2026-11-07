import {
  type CacheEffect,
  type MutationContract,
  parse,
  type QueryContract,
  type QueryKey,
  type StandardSchemaV1,
} from '@kitr/core'
import type { KyInstance, Options } from 'ky'

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'

export interface HttpQueryOptions<TInput, TOutput> {
  /** Path relative to the client's base URL, or a function of the input. */
  path: string | ((input: TInput) => string)
  key: (input: TInput) => QueryKey
  searchParams?: (input: TInput) => Record<string, string | number | boolean | undefined>
  /** Validate the response; also types `TOutput`. */
  schema?: StandardSchemaV1<unknown, TOutput>
  options?: Options
  staleTime?: number
}

/** External HTTP API as a query contract. Use with `defineQuery` from kitr/query. */
export function httpQuery<TInput = void, TOutput = unknown>(
  client: KyInstance,
  opts: HttpQueryOptions<TInput, TOutput>,
): Omit<QueryContract<TInput, TOutput>, 'kind'> {
  return {
    source: 'http',
    key: opts.key,
    staleTime: opts.staleTime,
    fetch: async (input, { signal }) => {
      const path = typeof opts.path === 'function' ? opts.path(input) : opts.path
      const searchParams = clean(opts.searchParams?.(input))
      const data = await client
        .get(path, {
          ...opts.options,
          signal: signal ?? opts.options?.signal,
          ...(searchParams ? { searchParams } : {}),
        })
        .json<unknown>()
      return opts.schema ? parse(opts.schema, data) : (data as TOutput)
    },
  }
}

export interface HttpMutationOptions<TInput, TOutput> {
  method?: Method
  path: string | ((input: TInput) => string)
  body?: (input: TInput) => unknown
  schema?: StandardSchemaV1<unknown, TOutput>
  effects?: CacheEffect | ((result: TOutput, input: TInput) => CacheEffect)
  options?: Options
}

/** External HTTP API as a mutation contract. Use with `defineMutation` from kitr/query. */
export function httpMutation<TInput = void, TOutput = unknown>(
  client: KyInstance,
  opts: HttpMutationOptions<TInput, TOutput>,
): Omit<MutationContract<TInput, TOutput>, 'kind'> {
  const method = opts.method ?? 'post'
  return {
    source: 'http',
    effects: opts.effects,
    mutate: async (input) => {
      const path = typeof opts.path === 'function' ? opts.path(input) : opts.path
      const body = opts.body
        ? opts.body(input)
        : method === 'get' || method === 'delete'
          ? undefined
          : input
      const response = await client[method](path, {
        ...opts.options,
        ...(body !== undefined ? { json: body } : {}),
      })
      if (response.status === 204) return undefined as TOutput
      const data = await response.json<unknown>()
      return opts.schema ? parse(opts.schema, data) : (data as TOutput)
    },
  }
}

function clean(params?: Record<string, string | number | boolean | undefined>) {
  if (!params) return undefined
  const out: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(params)) if (v !== undefined) out[k] = v
  return out
}
