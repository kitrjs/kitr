import { KitrError } from './errors'
import type { Prettify } from './types'

/**
 * The route table: one list of routes for a whole app, whatever kind they are. Core only knows
 * the shape of an entry, how to prefix and nest them (`group`), how to attach middleware (`use`)
 * and how to combine tables (`merge`). Every method that adds a route comes from a package:
 *
 *   import { defineRoutes } from 'kitr/app'
 *   import pages from '@kitr/router/routes'     // .page, .layout, .root, .notFound
 *   import http from '@kitr/api/routes'         // .get, .post, .put, .patch, .delete, .resource
 *   import ws from '@kitr/realtime/routes'      // .ws, .sse
 *
 *   export const routes = defineRoutes([pages, http, ws], (r) =>
 *     r.page('/', { lazy: () => import('#app/pages/home') })
 *      .group('/api', (api) => api.get('/health', () => ({ ok: true }), { name: 'health' })),
 *   )
 *   export type AppRoutes = typeof routes.$types
 *
 * A method exists only when its package is in the list, at run time and in the types: a
 * server-only app with `[http]` has no `.page`, and a client app with `[pages]` has no `.get`.
 * Each package also compiles its own entries (`compile('h3', server)` mounts endpoints and
 * sockets on a kitr server; `compile('tanstack', options)` builds the TanStack route tree).
 *
 * Extending the table has two halves, like `ContainerBindings`:
 *
 *   declare module '@kitr/core' {
 *     interface RouterExtensions<K extends ExtensionKey, R extends RouteMap> {
 *       http: { get<...>(path, handler, options?): KitrRouter<K, R & { ... }> }
 *     }
 *   }
 *   export default defineRouteExtension({ key: 'http', kinds: ['http'], methods: { get() { ... } }, targets: { h3 } })
 */

/** What every entry type carries. Packages extend it (`method`, `output`, `route`...). */
export interface RouteType {
  kind: string
  path: string
  /**
   * `relative` (default): `group` prefixes the path and the `METHOD /path` name. `absolute`: the
   * path is already full (pages resolve theirs through their TanStack parent) and is left alone.
   */
  scope?: 'relative' | 'absolute'
}

/**
 * The accumulated types of a table, keyed by route name. Keys starting with `~` are
 * bookkeeping a package keeps for itself (the pages extension stores the current parent route
 * type under `~parent`); they never leave a group and are not routes.
 */
export type RouteMap = Record<string, unknown>

/** A registered route at run time. Packages add their own fields (`handler`, `method`, `channels`...). */
export interface RouteEntry {
  kind: string
  /** Full path, prefixes applied. */
  path: string
  /** Unique name: `GET /api/projects`, `projects.show`, `page /projects/$id`, `WS /api/ws`. */
  name: string
  /** Middleware from `use()` and enclosing groups, outermost first. Packages decide what a middleware is. */
  middleware: unknown[]
  [field: string]: unknown
}

/**
 * Methods packages add to the table, by extension key. `K` is the set of installed keys and `R`
 * the accumulated route map; every method returns `KitrRouter<K, R & { [name]: RouteType }>`.
 */
// biome-ignore lint/suspicious/noEmptyInterface: augmented by packages
// biome-ignore lint/correctness/noUnusedVariables: the parameters are the augmentation's contract
export interface RouterExtensions<K extends string, R extends RouteMap> {}

export type ExtensionKey = keyof RouterExtensions<any, any>

/**
 * What a package adds to the route map of a group's child table, by extension key. The pages
 * extension sets `~parent` to the group's TanStack route so pages inside resolve their full path.
 */
// biome-ignore-start lint/correctness/noUnusedVariables: the parameters are the augmentation's contract
// biome-ignore lint/suspicious/noEmptyInterface: augmented by packages
export interface RouteGroupChild<
  K extends string,
  R extends RouteMap,
  P extends string,
  O extends GroupOptions,
> {}
// biome-ignore-end lint/correctness/noUnusedVariables: see above

export interface GroupOptions {
  /** Prefix for custom route names: `as: 'admin'` makes `admin.projects.index`. */
  as?: string
  /** Middleware around every endpoint inside (http). */
  middleware?: unknown[]
  /** Anything else a package reads: `beforeLoad`, `staticData` (pages). */
  [option: string]: unknown
}

type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void
  ? I
  : never

type Tilde<R> = { [N in keyof R as N extends `~${string}` ? N : never]: R[N] }
type Untilde<R> = { [N in keyof R as N extends `~${string}` ? never : N]: R[N] }

type GroupHooks<
  K extends ExtensionKey,
  R extends RouteMap,
  P extends string,
  O extends GroupOptions,
> = [K] extends [never] ? {} : UnionToIntersection<RouteGroupChild<K, R, P, O>[K]>

/** The route map a group's `define` callback starts from: the parent's bookkeeping, with the packages' overrides. */
export type GroupChildMap<
  K extends ExtensionKey,
  R extends RouteMap,
  P extends string,
  O extends GroupOptions,
> = Omit<Tilde<R>, keyof GroupHooks<K, R, P, O>> & GroupHooks<K, R, P, O>

/** `/api` + `/projects` → `/api/projects`; trailing slashes dropped. */
export type JoinPaths<A extends string, B extends string> = A extends '' | '/'
  ? B
  : A extends `${infer H}/`
    ? JoinPaths<H, B>
    : B extends '/' | ''
      ? A
      : `${A}${B}`

type GroupAs<O> = O extends { as: infer A extends string } ? `${A}.` : ''

type GroupedKey<N extends string, T, P extends string, O> = T extends { scope: 'absolute' }
  ? N
  : N extends `${infer Head} /${infer Rest}`
    ? `${Head} ${JoinPaths<P, `/${Rest}`>}`
    : `${GroupAs<O>}${N}`

type GroupedType<T, P extends string> = T extends { scope: 'absolute' }
  ? T
  : T extends { path: infer Path extends string }
    ? { [F in keyof T]: F extends 'path' ? JoinPaths<P, Path> : T[F] }
    : T

/** A group's routes as the parent sees them: paths prefixed, `METHOD /path` names rewritten, custom names under `as.`. */
export type Grouped<G extends RouteMap, P extends string, O> = {
  [N in keyof G & string as N extends `~${string}`
    ? never
    : GroupedKey<N, G[N], P, O>]: GroupedType<G[N], P>
}

type PrefixOrOptions = string | (GroupOptions & { prefix?: string })
type PrefixOf<A> = A extends string ? A : A extends { prefix: infer P extends string } ? P : ''
type OptionsOf<A, O> = A extends string ? O : A extends GroupOptions ? A : {}

/** The table's own methods. Everything else comes from `RouterExtensions`. */
export interface RouteTableBase<K extends ExtensionKey, R extends RouteMap> {
  /** Phantom: the accumulated route types. `export type AppRoutes = typeof routes.$types`. */
  readonly $types: Prettify<R>
  /** Every registered route, in registration order, full paths. */
  readonly entries: RouteEntry[]
  readonly extensions: readonly RouteExtension[]
  /** Path prefix of this (child) table. */
  readonly prefix: string
  /** Middleware every entry added here gets, outermost first. */
  readonly middleware: readonly unknown[]
  /** Prefix for custom names (`admin.`). */
  readonly namePrefix: string
  /** Per-extension bookkeeping, by extension key. A child table starts with a copy of its parent's. */
  readonly state: Record<string, unknown>

  /**
   * Routes under a prefix, with middleware and options for everything inside. The prefix applies
   * to every kind: a page, an endpoint and a socket under `group('/admin')` all live under `/admin`.
   * The first argument may also be an options object with `prefix` (`group({ prefix: '/api', middleware: [auth()] }, ...)`).
   */
  group<A extends PrefixOrOptions, const O extends GroupOptions, G extends RouteMap = {}>(
    prefixOrOptions: A,
    options: O,
    define: (r: KitrRouter<K, GroupChildMap<K, R, PrefixOf<A>, O>>) => KitrRouter<K, G> | void,
  ): KitrRouter<K, R & Grouped<G, PrefixOf<A>, O>>
  group<const A extends PrefixOrOptions, G extends RouteMap = {}>(
    prefixOrOptions: A,
    define: (
      r: KitrRouter<K, GroupChildMap<K, R, PrefixOf<A>, OptionsOf<A, {}>>>,
    ) => KitrRouter<K, G> | void,
  ): KitrRouter<K, R & Grouped<G, PrefixOf<A>, OptionsOf<A, {}>>>

  /** Middleware for every route registered after this call (in this table and its groups). */
  use(...middleware: unknown[]): KitrRouter<K, R>

  /**
   * Add another table's routes and types: `server/routes.ts` into `app/routes.ts`, so one
   * `AppRoutes` covers pages and endpoints while the server bundle never imports React.
   */
  merge<G extends RouteMap>(other: {
    readonly $types: G
    readonly entries: RouteEntry[]
  }): KitrRouter<K, R & Untilde<G>>

  /**
   * Hand the entries to every extension that knows `target`: `compile('h3', server)` mounts
   * endpoints and sockets on a kitr server, `compile('tanstack', options)` builds a route tree.
   * Returns each extension's result by key.
   */
  compile<T = unknown>(target: string, arg: T): Record<string, unknown>

  /** Register an entry with this table's prefix, middleware and name prefix applied. For extensions. */
  add(entry: Omit<RouteEntry, 'middleware'> & { middleware?: unknown[] }): RouteEntry
  /** Build a URL for a named route: `url('projects.show', { id: '1' }, { tab: 'files' })`. */
  url(
    name: keyof Untilde<R> & string,
    params?: Record<string, string | number>,
    query?: Record<string, string | number | boolean>,
  ): string
  /** `kitr routes:list`: every entry without handlers. */
  toJSON(): Array<{
    kind: string
    method?: string
    path: string
    name: string
    [k: string]: unknown
  }>
}

/** A table with the methods of the installed extensions. */
export type KitrRouter<K extends ExtensionKey, R extends RouteMap = {}> = RouteTableBase<K, R> &
  ([K] extends [never] ? {} : UnionToIntersection<RouterExtensions<K, R>[K]>)

export type AnyRouteTable = RouteTableBase<ExtensionKey, any>

/** What a package exports from its `routes` module (`@kitr/api/routes`). */
export interface RouteExtension<K extends string = string> {
  key: K
  /** Entry kinds this extension registers and compiles. */
  kinds: readonly string[]
  /** The methods added to every table. `this` is the table the method was called on. */
  methods: Record<string, (this: any, ...args: any[]) => any>
  /** Runs when a group opens, before `define`: set up `child.state[key]`, register a group entry. */
  group?(child: AnyRouteTable, parent: AnyRouteTable, prefix: string, options: GroupOptions): void
  /** Compile targets by name. Receives this extension's entries, the target's argument and the table. */
  targets?: Record<string, (entries: RouteEntry[], arg: any, table: AnyRouteTable) => unknown>
}

export function defineRouteExtension<const E extends RouteExtension>(extension: E): E {
  return extension
}

type KeysOf<E extends readonly RouteExtension[]> = E[number]['key'] & ExtensionKey

const RESERVED = new Set(['prefix', 'middleware', 'as']) // kitr-allow-module-state: constant set built once at import, never mutated

export class RouteTable {
  readonly entries: RouteEntry[]
  readonly extensions: readonly RouteExtension[]
  readonly state: Record<string, unknown>
  readonly middleware: readonly unknown[]
  declare readonly $types: RouteMap
  /** The same array as `middleware`, typed for the one place that appends to it (`use`). */
  readonly #middleware: unknown[]

  constructor(
    extensions: readonly RouteExtension[],
    readonly prefix = '',
    middleware: readonly unknown[] = [],
    readonly namePrefix = '',
    entries: RouteEntry[] = [],
    state: Record<string, unknown> = {},
  ) {
    this.extensions = extensions
    this.entries = entries
    this.state = state
    this.#middleware = [...middleware]
    this.middleware = this.#middleware
    for (const ext of extensions)
      for (const [name, fn] of Object.entries(ext.methods)) {
        if (name in this && !Object.hasOwn(this, name))
          throw new Error(`[kitr] route extension "${ext.key}" cannot redefine "${name}"`)
        Object.defineProperty(this, name, { value: fn, enumerable: false, configurable: true })
      }
  }

  group(prefixOrOptions: PrefixOrOptions, ...rest: unknown[]): this {
    const define = rest.pop() as (r: RouteTable) => unknown
    const given = (rest[0] ?? {}) as GroupOptions
    const options: GroupOptions =
      typeof prefixOrOptions === 'string' ? given : { ...prefixOrOptions, ...given }
    const prefix =
      typeof prefixOrOptions === 'string' ? prefixOrOptions : String(options.prefix ?? '')
    const child = new RouteTable(
      this.extensions,
      joinPath(this.prefix, prefix),
      [...this.middleware, ...(options.middleware ?? [])],
      options.as ? `${this.namePrefix}${options.as}.` : this.namePrefix,
      [],
      { ...this.state },
    )
    for (const ext of this.extensions) ext.group?.(child, this, prefix, options)
    define(child)
    this.entries.push(...child.entries)
    return this
  }

  use(...middleware: unknown[]): this {
    this.#middleware.push(...middleware)
    return this
  }

  merge(other: { entries: RouteEntry[] }): this {
    const names = new Set(this.entries.map((e) => e.name))
    for (const entry of other.entries) {
      if (names.has(entry.name))
        throw new KitrError(
          'CONFLICT',
          `[kitr] merge(): route "${entry.name}" is already registered. Give one of the two routes a different name, or drop the duplicate.`,
          { data: { name: entry.name } },
        )
      names.add(entry.name)
    }
    this.entries.push(...other.entries)
    return this
  }

  compile(target: string, arg: unknown): Record<string, unknown> {
    const results: Record<string, unknown> = {}
    for (const ext of this.extensions) {
      const fn = ext.targets?.[target]
      if (!fn) continue
      results[ext.key] = fn(
        this.entries.filter((e) => ext.kinds.includes(e.kind)),
        arg,
        this as unknown as AnyRouteTable,
      )
    }
    return results
  }

  add(entry: Omit<RouteEntry, 'middleware'> & { middleware?: unknown[] }): RouteEntry {
    const full = {
      ...entry,
      middleware: [...this.middleware, ...(entry.middleware ?? [])],
    } as RouteEntry
    this.entries.push(full)
    return full
  }

  url(
    name: string,
    params: Record<string, string | number> = {},
    query?: Record<string, string | number | boolean>,
  ): string {
    const route = this.entries.find((r) => r.name === name)
    if (!route) throw new Error(`[kitr] No route named "${name}"`)
    let path = route.path.replace(/[:$](\w+)/g, (_, key) => {
      if (params[key] === undefined)
        throw new Error(`[kitr] Missing param "${key}" for route "${name}"`)
      return encodeURIComponent(String(params[key]))
    })
    if (query && Object.keys(query).length)
      path += `?${new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]))}`
    return path
  }

  toJSON() {
    return this.entries.map((entry) => {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(entry)) {
        if (k === 'middleware' || typeof v === 'function') continue
        if (v && typeof v === 'object' && !Array.isArray(v) && k !== 'meta' && k !== 'validates')
          continue
        out[k] = v
      }
      if ('validate' in entry) {
        const v = entry.validate as Record<string, unknown> | undefined
        out.validates = { params: !!v?.params, query: !!v?.query, body: !!v?.body }
      }
      return out as { kind: string; path: string; name: string }
    })
  }
}

/** Is this value a route table (any extensions)? */
export function isRouteTable(value: unknown): value is AnyRouteTable {
  return value instanceof RouteTable
}

/** A new, empty table with the given extensions' methods. */
export function createRouteTable<const E extends readonly RouteExtension[]>(
  extensions: E,
): KitrRouter<KeysOf<E>, {}> {
  const keys = new Set<string>()
  for (const ext of extensions) {
    if (keys.has(ext.key))
      throw new Error(`[kitr] route extension "${ext.key}" is listed twice in defineRoutes()`)
    keys.add(ext.key)
    for (const name of Object.keys(ext.methods))
      if (RESERVED.has(name)) throw new Error(`[kitr] route extension method "${name}" is reserved`)
  }
  return new RouteTable(extensions) as unknown as KitrRouter<KeysOf<E>, {}>
}

/**
 * The route table entry point: the extensions you installed, then the routes.
 *
 *   export const routes = defineRoutes([pages, http], (r) => r.page('/').get('/api/health', ...))
 */
export function defineRoutes<const E extends readonly RouteExtension[], R extends RouteMap = {}>(
  extensions: E,
  define?: (r: KitrRouter<KeysOf<E>, {}>) => KitrRouter<KeysOf<E>, R> | void,
): KitrRouter<KeysOf<E>, R> {
  const table = createRouteTable(extensions)
  const result = define?.(table)
  return (result ?? table) as KitrRouter<KeysOf<E>, R>
}

/** `joinPath('/api/', '/projects/')` → `/api/projects`; `joinPath('', '')` → `/`. */
export function joinPath(base: string, path: string): string {
  const joined = `${base}/${path}`.replace(/\/{2,}/g, '/').replace(/\/$/, '')
  return joined === '' ? '/' : joined.startsWith('/') ? joined : `/${joined}`
}
