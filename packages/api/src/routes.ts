import {
  type AnyRouteTable,
  defineRouteExtension,
  type ExtensionKey,
  type GroupOptions,
  type KitrRouter,
  type RouteEntry as TableEntry,
  type RouteMap as TableMap,
} from '@kitr/core'
import type { KitrServer } from '@kitr/server'
import type {
  ControllerClass,
  ControllerOutput,
  ControllerRef,
  ControllerValidators,
  LazyController,
  MethodNames,
  ResolvedController,
} from './controller'
import { toH3 } from './h3'
import type {
  HandlerFn,
  HttpMethod,
  Middleware,
  RouteEntry,
  RouteOptions,
  RouteType,
  ValidatedBody,
  ValidatedParams,
  ValidatedQuery,
  Validators,
} from './types'

/** A function, or a `[Controller, 'method']` tuple. The method name is checked by `ControllerOutput` in the route type. */
export type Handler<P, Q, B, Output> =
  | HandlerFn<P, Q, B, Output>
  | readonly [ControllerClass | LazyController, string]

/** Validators given in options, or none (`V` is `never` when `validate` is omitted). */
type GivenValidators<V> = [V] extends [never] ? undefined : V extends Validators ? V : undefined

/** The handler for a route at `Path`: `ctx.params`, `ctx.query` and `ctx.body` typed from the path and validators. */
export type RouteHandler<Path extends string, V> = Handler<
  ValidatedParams<Path, GivenValidators<V>>,
  ValidatedQuery<GivenValidators<V>>,
  ValidatedBody<GivenValidators<V>>,
  any
>

type OutputOf<H> =
  H extends HandlerFn<any, any, any, infer O>
    ? O
    : H extends readonly [infer C, infer M extends string]
      ? ControllerOutput<C, M>
      : unknown

// `[V] extends [never]` keeps `never` (no `validate` option) from distributing to nothing: controller
// validators (`static validation`) then type the route, same as at runtime.
type ValidatorsOf<H, V> = [V] extends [never]
  ? H extends readonly [infer C, infer M extends string]
    ? ControllerValidators<C, M>
    : undefined
  : V extends Validators
    ? V
    : H extends readonly [infer C, infer M extends string]
      ? ControllerValidators<C, M>
      : undefined

export type RouteFor<Method extends HttpMethod, Path extends string, H, V> = RouteType<
  Method,
  Path,
  ValidatedParams<Path, ValidatorsOf<H, V>>,
  ValidatedQuery<ValidatorsOf<H, V>>,
  ValidatedBody<ValidatorsOf<H, V>>,
  OutputOf<H>
>

// `[Name] extends [never]`: without `{ name }` the default `never` would distribute to no key at all,
// and the endpoint would vanish from `$types`. It is keyed `"GET /path"` instead.
type NameOf<Name, Method extends string, Path extends string> = [Name] extends [never]
  ? `${Method} ${Path}`
  : Name extends string
    ? Name
    : `${Method} ${Path}`

export type ResourceAction = 'index' | 'store' | 'show' | 'update' | 'destroy'
const resourceActions: Array<{ action: ResourceAction; method: HttpMethod; suffix: string }> = [
  { action: 'index', method: 'GET', suffix: '' },
  { action: 'store', method: 'POST', suffix: '' },
  { action: 'show', method: 'GET', suffix: '/:id' },
  { action: 'update', method: 'PATCH', suffix: '/:id' },
  { action: 'destroy', method: 'DELETE', suffix: '/:id' },
]

type ResourceRoute<
  N extends string,
  C,
  A extends ResourceAction,
  Method extends HttpMethod,
  Path extends string,
> =
  A extends MethodNames<InstanceType<ResolvedController<C>>>
    ? { [K in `${N}.${A}`]: RouteFor<Method, Path, readonly [C, A], undefined> }
    : {}

export type ResourceRoutes<N extends string, C, Prefix extends string> = ResourceRoute<
  N,
  C,
  'index',
  'GET',
  `${Prefix}/${N}`
> &
  ResourceRoute<N, C, 'store', 'POST', `${Prefix}/${N}`> &
  ResourceRoute<N, C, 'show', 'GET', `${Prefix}/${N}/:id`> &
  ResourceRoute<N, C, 'update', 'PATCH', `${Prefix}/${N}/:id`> &
  ResourceRoute<N, C, 'destroy', 'DELETE', `${Prefix}/${N}/:id`>

export interface ResourceOptions {
  only?: ResourceAction[]
  except?: ResourceAction[]
  middleware?: Middleware[]
  /** The id segment name. Default `id`. */
  param?: string
}

/**
 * One http method on the table: `get`, `post`, `put`, `patch`, `delete`. The result is written inline
 * (`R & { [N in ...]: ... }`), not through an alias like `Add<R, N, T>`: an alias stamps each step's
 * type with its arguments, which include the previous step's type, and TypeScript instantiates that
 * chain recursively. At about 60 chained endpoints that is TS2589. A plain intersection is flattened.
 */
export type HttpMethodFn<K extends ExtensionKey, R extends TableMap, Method extends HttpMethod> = <
  Path extends string,
  H extends RouteHandler<Path, V>,
  Name extends string = never,
  V extends Validators = never,
>(
  path: Path,
  handler: H,
  options?: RouteOptions<Name, V>,
) => KitrRouter<K, R & { [N in NameOf<Name, Method, Path>]: RouteFor<Method, Path, H, V> }>

declare module '@kitr/core' {
  interface RouterExtensions<K extends string, R extends TableMap> {
    /**
     * `@kitr/api/routes`: Adonis-style endpoints. Types accumulate as you chain, so the
     * client knows every route's params, body and output with no codegen:
     *
     *   r.group({ prefix: '/api', middleware: [auth()] }, (api) =>
     *     api.resource('projects', ProjectsController)
     *        .get('/me', [UsersController, 'me'], { name: 'me' }))
     */
    http: {
      get: HttpMethodFn<K & ExtensionKey, R, 'GET'>
      post: HttpMethodFn<K & ExtensionKey, R, 'POST'>
      put: HttpMethodFn<K & ExtensionKey, R, 'PUT'>
      patch: HttpMethodFn<K & ExtensionKey, R, 'PATCH'>
      delete: HttpMethodFn<K & ExtensionKey, R, 'DELETE'>
      /** Register for every method. Not typed into the client. */
      any(
        path: string,
        handler: Handler<any, any, any, any>,
        options?: RouteOptions,
      ): KitrRouter<K & ExtensionKey, R>
      /**
       * RESTful resource on a controller: index, store, show, update, destroy, named
       * `<name>.<action>`. Only the methods the controller defines are registered.
       */
      resource<N extends string, C extends ControllerClass | LazyController>(
        name: N,
        controller: C,
        options?: ResourceOptions,
      ): KitrRouter<K & ExtensionKey, R & ResourceRoutes<N, C, ''>>
    }
  }
}

function addHttp(
  table: AnyRouteTable,
  method: HttpMethod,
  path: string,
  handler: unknown,
  options: RouteOptions<string, Validators> = {},
): TableEntry {
  const fullPath = joinPath(table.prefix, path)
  const name = options.name ? `${table.namePrefix}${options.name}` : `${method} ${fullPath}`
  return table.add({
    kind: 'http',
    method,
    path: fullPath,
    name,
    handler,
    middleware: options.middleware ?? [],
    validate: options.validate,
    meta: options.meta,
  })
}

function definesAction(controller: ControllerClass | LazyController, action: string): boolean {
  // Lazy controllers can't be inspected synchronously; register all and let the runtime 404 undefined methods.
  if (
    typeof controller === 'function' &&
    !/^class\s/.test(Function.prototype.toString.call(controller))
  )
    return true
  return typeof (controller as ControllerClass).prototype?.[action] === 'function'
}

/**
 * The http extension: `.get`, `.post`, `.put`, `.patch`, `.delete`, `.any` and `.resource` on
 * the route table, compiled to h3 by `createServer({ routes })` (the `h3` target).
 *
 *   import { defineRoutes } from 'kitr/app'
 *   import http from 'kitr/api/routes'
 *   export const routes = defineRoutes([http], (r) => r.group('/api', (api) => api.resource('projects', ProjectsController)))
 */
const http = defineRouteExtension({
  key: 'http',
  kinds: ['http'],
  methods: {
    get(this: AnyRouteTable, path: string, handler: unknown, options?: RouteOptions) {
      addHttp(this, 'GET', path, handler, options)
      return this
    },
    post(this: AnyRouteTable, path: string, handler: unknown, options?: RouteOptions) {
      addHttp(this, 'POST', path, handler, options)
      return this
    },
    put(this: AnyRouteTable, path: string, handler: unknown, options?: RouteOptions) {
      addHttp(this, 'PUT', path, handler, options)
      return this
    },
    patch(this: AnyRouteTable, path: string, handler: unknown, options?: RouteOptions) {
      addHttp(this, 'PATCH', path, handler, options)
      return this
    },
    delete(this: AnyRouteTable, path: string, handler: unknown, options?: RouteOptions) {
      addHttp(this, 'DELETE', path, handler, options)
      return this
    },
    any(this: AnyRouteTable, path: string, handler: unknown, options?: RouteOptions) {
      for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as const)
        addHttp(this, method, path, handler, options)
      return this
    },
    resource(
      this: AnyRouteTable,
      name: string,
      controller: ControllerClass | LazyController,
      options: ResourceOptions = {},
    ) {
      const param = options.param ?? 'id'
      for (const { action, method, suffix } of resourceActions) {
        if (options.only && !options.only.includes(action)) continue
        if (options.except?.includes(action)) continue
        if (!definesAction(controller, action)) continue
        addHttp(
          this,
          method,
          `/${name}${suffix.replace(':id', `:${param}`)}`,
          [controller, action] as unknown as ControllerRef,
          { name: `${name}.${action}`, middleware: options.middleware },
        )
      }
      return this
    },
  },
  targets: {
    /** Mount every endpoint on a kitr server (`createServer({ routes })`). */
    h3(entries: TableEntry[], server: KitrServer) {
      server.mount('/', toH3(entries as unknown as RouteEntry[], server.app))
      return entries.length
    },
  },
})

export default http
export { http }

/** The http entries of a table, or the table's own list when given one. */
export function httpEntries(source: { entries: TableEntry[] } | RouteEntry[]): RouteEntry[] {
  if (Array.isArray(source)) return source
  return source.entries.filter((e) => e.kind === 'http') as unknown as RouteEntry[]
}

export function joinPath(base: string, path: string): string {
  const joined = `${base}/${path}`.replace(/\/{2,}/g, '/').replace(/\/$/, '')
  return joined === '' ? '/' : joined.startsWith('/') ? joined : `/${joined}`
}

/** Group options as `kitr/api` always spelled them: `{ prefix, middleware, as }`. */
export type { GroupOptions }
