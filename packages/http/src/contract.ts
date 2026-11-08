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

/**
 * The client, or a function that returns it. Pass the function when the module loads before the
 * app boots, such as a `queries.ts` that `app/routes.ts` imports for its loaders:
 * `const http = () => app.container.use('http')`. It is called on each request.
 */
export type HttpClientSource = KyInstance | (() => KyInstance)

// A ky instance is itself a function, so tell the two apart by its methods.
const resolve = (client: HttpClientSource): KyInstance =>
  'extend' in client ? client : (client as () => KyInstance)()

/** Options for `httpQuery`: how one GET endpoint maps to a cached query. */
export interface HttpQueryOptions<TInput, TOutput> {
  /** Path relative to the client's base URL, or a function of the input. */
  path: string | ((input: TInput) => string)
  /** The cache key for an input. Include every input that changes the result. */
  key: (input: TInput) => QueryKey
  /** Query string values from the input; `undefined` values are left out. */
  searchParams?: (input: TInput) => Record<string, string | number | boolean | undefined>
  /** Validate the response; also types `TOutput`. */
  schema?: StandardSchemaV1<unknown, TOutput>
  /** ky options for this request only, such as `headers` or `timeout`. */
  options?: Options
  /** How long this query's data stays fresh, in ms; overrides `config/query.ts`. */
  staleTime?: number
}

/** External HTTP API as a query contract. Use with `queryFrom` from @kitr/query. */
export function httpQuery<TInput = void, TOutput = unknown>(
  client: HttpClientSource,
  opts: HttpQueryOptions<TInput, TOutput>,
): Omit<QueryContract<TInput, TOutput>, 'kind'> {
  return {
    source: 'http',
    key: opts.key,
    staleTime: opts.staleTime,
    fetch: async (input, { signal }) => {
      const path = typeof opts.path === 'function' ? opts.path(input) : opts.path
      const searchParams = clean(opts.searchParams?.(input))
      const data = await resolve(client)
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

/** Options for `httpMutation`: how one endpoint that changes data maps to a mutation. */
export interface HttpMutationOptions<TInput, TOutput> {
  /** HTTP method. Default `'post'`. */
  method?: Method
  /** Path relative to the client's base URL, or a function of the input. */
  path: string | ((input: TInput) => string)
  /** Builds the JSON body. Default: the input itself, or no body for `get` and `delete`. */
  body?: (input: TInput) => unknown
  /** Validate the response; also types `TOutput`. */
  schema?: StandardSchemaV1<unknown, TOutput>
  /** Cache effects applied after success: an object, or a function of the result and input. */
  effects?: CacheEffect | ((result: TOutput, input: TInput) => CacheEffect)
  /** ky options for this request only. */
  options?: Options
}

/** External HTTP API as a mutation contract. Use with `mutationFrom` from @kitr/query. */
export function httpMutation<TInput = void, TOutput = unknown>(
  client: HttpClientSource,
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
      const response = await resolve(client)[method](path, {
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
