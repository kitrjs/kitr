import {
  type CacheEffect,
  isKitrErrorShape,
  KitrError,
  type MutationContract,
  type QueryContract,
  type QueryKey,
  toKitrError,
} from '@kitr/core'
import type { RouteMap, RouteType } from './types'

/**
 * The typed client. No codegen: it is typed from `typeof routes.$types`.
 *
 *   const api = createApiClient<AppRoutes>({ baseUrl: env.VITE_API_URL })
 *   const project = await api.projects.show({ params: { id } })
 *   const projectQuery = defineQuery(api.projects.show.query())
 *   useSuspenseQuery(projectQuery.options({ params: { id } }))
 */
export interface ApiClientOptions {
  baseUrl: string
  /** Custom fetch (ky's `fetch`, a test fetch, or `server.fetch` for in-process calls). */
  fetch?: (input: Request) => Promise<Response>
  headers?: () => Promise<HeadersInit> | HeadersInit
  /** Called before every request; return a bearer token. */
  getToken?: () => Promise<string | null | undefined> | string | null | undefined
  credentials?: RequestCredentials
}

type IsNever<T> = [T] extends [never] ? true : false
type EmptyObject = Record<string, never>

type InputFor<R extends RouteType> = (keyof R['params'] extends never
  ? { params?: EmptyObject }
  : { params: R['params'] }) &
  (IsNever<R['body']> extends true
    ? { body?: undefined }
    : unknown extends R['body']
      ? { body?: unknown }
      : { body: R['body'] }) &
  (unknown extends R['query']
    ? { query?: Record<string, string | number | boolean | undefined> }
    : Record<string, string | string[]> extends R['query']
      ? { query?: Record<string, string | number | boolean | undefined> }
      : { query?: Partial<R['query']> })

type MaybeOptional<I> = {} extends I ? [input?: I] : [input: I]

export interface Endpoint<R extends RouteType> {
  (...args: MaybeOptional<InputFor<R>>): Promise<R['output']>
  /** Query contract for `defineQuery` (kitr/query). Input is the request input. */
  query(): Omit<QueryContract<InputFor<R>, R['output']>, 'kind'>
  /** Mutation contract for `defineMutation` (kitr/query). */
  mutation(options?: {
    effects?: CacheEffect | ((result: R['output'], input: InputFor<R>) => CacheEffect)
  }): Omit<MutationContract<InputFor<R>, R['output']>, 'kind'>
  key(...args: MaybeOptional<InputFor<R>>): QueryKey
  url(...args: MaybeOptional<InputFor<R>>): string
  readonly method: R['method']
  readonly path: R['path']
}

type Head<K> = K extends `${infer H}.${string}` ? H : K
type Rest<K, H extends string> = K extends `${H}.${infer R}` ? R : never

export type ApiClient<R extends RouteMap> = {
  [H in Head<keyof R & string>]: IsNever<Rest<keyof R & string, H>> extends true
    ? R[H & keyof R] extends RouteType
      ? Endpoint<R[H & keyof R]>
      : never
    : {
        [K in keyof R as K extends `${H}.${infer N}` ? N : never]: R[K] extends RouteType
          ? Endpoint<R[K]>
          : never
      }
}

export function createApiClient<R extends RouteMap>(
  options: ApiClientOptions,
): ApiClient<R> & { $routes: R } {
  const doFetch = options.fetch ?? ((req: Request) => fetch(req))
  const base = options.baseUrl.replace(/\/$/, '')

  const makeEndpoint = (name: string): Endpoint<any> => {
    // Routes are resolved lazily by name: `GET /x` style names carry method+path; `a.b` names need the route table.
    const [method, path] = parseName(name)
    const buildUrl = (input: any = {}) => {
      let p = path.replace(/:(\w+)/g, (_, key) => {
        const v = input.params?.[key]
        if (v === undefined)
          throw new KitrError('BAD_REQUEST', `Missing param "${key}" for ${name}`)
        return encodeURIComponent(String(v))
      })
      if (input.query) {
        const qs = new URLSearchParams()
        for (const [k, v] of Object.entries(input.query))
          if (v !== undefined && v !== null) qs.set(k, String(v))
        const s = qs.toString()
        if (s) p += `?${s}`
      }
      return `${base}${p}`
    }
    const call = async (input: any = {}, signal?: AbortSignal) => {
      const headers = new Headers(await options.headers?.())
      const token = await options.getToken?.()
      if (token) headers.set('authorization', `Bearer ${token}`)
      const hasBody = input.body !== undefined && method !== 'GET' && method !== 'HEAD'
      if (hasBody) headers.set('content-type', 'application/json')
      headers.set('accept', 'application/json')
      const request = new Request(buildUrl(input), {
        method,
        headers,
        body: hasBody ? JSON.stringify(input.body) : undefined,
        credentials: options.credentials,
        signal,
      })
      let response: Response
      try {
        response = await doFetch(request)
      } catch (error) {
        throw toKitrError(error, 'NETWORK')
      }
      if (response.status === 204) return undefined
      const text = await response.text()
      const data = text ? safeJson(text) : undefined
      if (!response.ok) {
        if (isKitrErrorShape(data))
          throw new KitrError(data.code, data.message, {
            status: data.status,
            fieldErrors: data.fieldErrors,
            data: data.data,
          })
        throw KitrError.fromStatus(
          response.status,
          typeof (data as any)?.message === 'string' ? (data as any).message : undefined,
          data,
        )
      }
      return data
    }
    const key = (input: any = {}) => ['api', name, input.params ?? {}, input.query ?? {}] as const
    const endpoint = Object.assign(call, {
      method,
      path,
      key,
      url: buildUrl,
      query: () => ({
        source: 'api',
        key,
        fetch: (input: any, ctx: { signal?: AbortSignal }) => call(input, ctx.signal),
      }),
      mutation: (opts: { effects?: any } = {}) => ({
        source: 'api',
        mutate: (input: any) => call(input),
        effects: opts.effects,
      }),
    })
    return endpoint as unknown as Endpoint<any>
  }

  const routeTable = new Map<string, { method: string; path: string }>()
  const parseName = (name: string): [string, string] => {
    const known = routeTable.get(name)
    if (known) return [known.method, known.path]
    const m = name.match(/^([A-Z]+) (\/.*)$/)
    if (m) return [m[1]!, m[2]!]
    throw new KitrError(
      'INTERNAL',
      `[kitr/api] Unknown route "${name}". Pass \`routes\` to createApiClient or use "METHOD /path" names.`,
    )
  }

  const cache = new Map<string, Endpoint<any>>()
  const endpointFor = (name: string) => {
    let e = cache.get(name)
    if (!e) {
      e = makeEndpoint(name)
      cache.set(name, e)
    }
    return e
  }
  const group = (prefix: string): any =>
    new Proxy(() => {}, {
      get: (_t, prop) => {
        if (typeof prop !== 'string' || nonRouteProps.has(prop)) return undefined
        const name = prefix ? `${prefix}.${prop}` : prop
        if (name === '$routes') return undefined
        if (name === '$register')
          return (table: Array<{ name: string; method: string; path: string }>) => {
            for (const r of table) routeTable.set(r.name, { method: r.method, path: r.path })
          }
        // A group when some registered route starts with `name.`; else an endpoint.
        for (const key of routeTable.keys()) if (key.startsWith(`${name}.`)) return group(name)
        if (routeTable.size === 0 && !/^[A-Z]+ \//.test(name) && !prefix) return group(name)
        return endpointFor(name)
      },
      apply: (_t, _this, args) => (endpointFor(prefix) as any)(...args),
    })
  return group('')
}

/** Give the client the runtime route table (names → method/path). Call once with `routes.toJSON()`. */
export function registerRoutes(
  client: ApiClient<any>,
  table: Array<{ name: string; method: string; path: string }>,
) {
  ;(client as any).$register(table)
}

/**
 * Properties the runtime probes on any object: `then` (await, async return), `toJSON`
 * (JSON.stringify), `$$typeof` (React), `asymmetricMatch` (test matchers). They are never routes.
 */
const nonRouteProps = new Set(['then', 'toJSON', '$$typeof', 'asymmetricMatch', 'nodeType'])

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
