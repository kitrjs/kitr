import type { Prettify } from '@kitr/core'
import type {
  ControllerClass,
  ControllerOutput,
  ControllerRef,
  ControllerValidators,
  LazyController,
  MethodNames,
  ResolvedController,
} from './controller'
import type {
  HandlerFn,
  HttpMethod,
  Middleware,
  RouteEntry,
  RouteMap,
  RouteOptions,
  RouteType,
  ValidatedBody,
  ValidatedParams,
  ValidatedQuery,
  Validators,
} from './types'

/** A function, or a `[Controller, 'method']` tuple. The method name is checked by `ControllerOutput` in the route type. */
type Handler<P, Q, B, Output> =
  | HandlerFn<P, Q, B, Output>
  | readonly [ControllerClass | LazyController, string]

type OutputOf<H> =
  H extends HandlerFn<any, any, any, infer O>
    ? O
    : H extends readonly [infer C, infer M extends string]
      ? ControllerOutput<C, M>
      : unknown

type ValidatorsOf<H, V> = V extends Validators
  ? V
  : H extends readonly [infer C, infer M extends string]
    ? ControllerValidators<C, M>
    : undefined

type RouteFor<Method extends HttpMethod, Path extends string, H, V> = RouteType<
  Method,
  Path,
  ValidatedParams<Path, ValidatorsOf<H, V>>,
  ValidatedQuery<ValidatorsOf<H, V>>,
  ValidatedBody<ValidatorsOf<H, V>>,
  OutputOf<H>
>

type NameOf<Name, Method extends string, Path extends string> = Name extends string
  ? Name
  : `${Method} ${Path}`

type Add<R extends RouteMap, Name extends string, Route extends RouteType> = Prettify<
  R & { [K in Name]: Route }
>

type ResourceAction = 'index' | 'store' | 'show' | 'update' | 'destroy'
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

type ResourceRoutes<N extends string, C, Prefix extends string> = ResourceRoute<
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

export interface GroupOptions {
  prefix?: string
  middleware?: Middleware[]
  /** Prefix for route names, e.g. `admin` makes `admin.projects.index`. */
  as?: string
}

/**
 * Adonis-style router with types that accumulate as you chain, so the client
 * knows every route's params, body and output with no codegen:
 *
 *   export const routes = defineRoutes((r) =>
 *     r.group({ prefix: '/api', middleware: [auth()] }, (api) =>
 *       api.resource('projects', ProjectsController)
 *          .get('/me', [UsersController, 'me'], { name: 'me' }),
 *     ),
 *   )
 *   export type AppRoutes = typeof routes.$types
 */
export class Router<R extends RouteMap = {}> {
  readonly routes: RouteEntry[] = []
  /** Phantom: the accumulated route types. Use `typeof routes.$types`. */
  declare readonly $types: R

  constructor(
    private readonly prefix = '',
    private readonly middleware: Middleware[] = [],
    private readonly namePrefix = '',
  ) {}

  private add<
    Method extends HttpMethod,
    Path extends string,
    H extends Handler<any, any, any, any>,
    Name extends string,
    V extends Validators,
  >(
    method: Method,
    path: Path,
    handler: H,
    options: RouteOptions<Name, V> = {},
  ): Router<Add<R, NameOf<Name, Method, `${string}${Path}`>, RouteFor<Method, Path, H, V>>> {
    const fullPath = joinPath(this.prefix, path)
    const name = options.name ? `${this.namePrefix}${options.name}` : `${method} ${fullPath}`
    this.routes.push({
      method,
      path: fullPath,
      name,
      handler,
      middleware: [...this.middleware, ...(options.middleware ?? [])],
      validate: options.validate,
      meta: options.meta,
    })
    return this as unknown as Router<any>
  }

  get<
    Path extends string,
    H extends Handler<any, any, any, any>,
    Name extends string = never,
    V extends Validators = never,
  >(path: Path, handler: H, options?: RouteOptions<Name, V>) {
    return this.add('GET', path, handler, options)
  }
  post<
    Path extends string,
    H extends Handler<any, any, any, any>,
    Name extends string = never,
    V extends Validators = never,
  >(path: Path, handler: H, options?: RouteOptions<Name, V>) {
    return this.add('POST', path, handler, options)
  }
  put<
    Path extends string,
    H extends Handler<any, any, any, any>,
    Name extends string = never,
    V extends Validators = never,
  >(path: Path, handler: H, options?: RouteOptions<Name, V>) {
    return this.add('PUT', path, handler, options)
  }
  patch<
    Path extends string,
    H extends Handler<any, any, any, any>,
    Name extends string = never,
    V extends Validators = never,
  >(path: Path, handler: H, options?: RouteOptions<Name, V>) {
    return this.add('PATCH', path, handler, options)
  }
  delete<
    Path extends string,
    H extends Handler<any, any, any, any>,
    Name extends string = never,
    V extends Validators = never,
  >(path: Path, handler: H, options?: RouteOptions<Name, V>) {
    return this.add('DELETE', path, handler, options)
  }
  /** Register for every method. Not typed into the client. */
  any(path: string, handler: Handler<any, any, any, any>, options?: RouteOptions): Router<R> {
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as const)
      this.add(method, path, handler, options)
    return this
  }

  /**
   * RESTful resource on a controller: index, store, show, update, destroy,
   * named `<name>.<action>`. Only the methods the controller defines are registered.
   */
  resource<N extends string, C extends ControllerClass | LazyController>(
    name: N,
    controller: C,
    options: {
      only?: ResourceAction[]
      except?: ResourceAction[]
      middleware?: Middleware[]
      param?: string
    } = {},
  ): Router<Prettify<R & ResourceRoutes<N, C, ''>>> {
    const param = options.param ?? 'id'
    const defined = (action: string) => {
      // Lazy controllers can't be inspected synchronously; register all and let the runtime 404 undefined methods.
      if (
        typeof controller === 'function' &&
        !/^class\s/.test(Function.prototype.toString.call(controller))
      )
        return true
      return typeof (controller as ControllerClass).prototype?.[action] === 'function'
    }
    for (const { action, method, suffix } of resourceActions) {
      if (options.only && !options.only.includes(action)) continue
      if (options.except?.includes(action)) continue
      if (!defined(action)) continue
      this.add(
        method,
        `/${name}${suffix.replace(':id', `:${param}`)}`,
        [controller, action] as unknown as ControllerRef,
        {
          name: `${name}.${action}`,
          middleware: options.middleware,
        },
      )
    }
    return this as unknown as Router<any>
  }

  /** Routes under a prefix and/or middleware. Names inside get `as` as a prefix when given. */
  group<G extends RouteMap>(
    options: GroupOptions | string,
    define: (router: Router<{}>) => Router<G>,
  ): Router<Prettify<R & G>> {
    const opts: GroupOptions = typeof options === 'string' ? { prefix: options } : options
    const child = new Router<{}>(
      joinPath(this.prefix, opts.prefix ?? ''),
      [...this.middleware, ...(opts.middleware ?? [])],
      opts.as ? `${this.namePrefix}${opts.as}.` : this.namePrefix,
    )
    define(child)
    this.routes.push(...child.routes)
    return this as unknown as Router<any>
  }

  /** Apply middleware to every route registered after this call. */
  use(...middleware: Middleware[]): Router<R> {
    this.middleware.push(...middleware)
    return this
  }

  /** Build a URL for a named route. */
  url(
    name: keyof R & string,
    params: Record<string, string | number> = {},
    query?: Record<string, string | number | boolean>,
  ): string {
    const route = this.routes.find((r) => r.name === name)
    if (!route) throw new Error(`[kitr/api] No route named "${name}"`)
    let path = route.path.replace(/:(\w+)/g, (_, key) => {
      if (params[key] === undefined)
        throw new Error(`[kitr/api] Missing param "${key}" for route "${name}"`)
      return encodeURIComponent(String(params[key]))
    })
    if (query && Object.keys(query).length)
      path += `?${new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]))}`
    return path
  }

  /** Serialisable description for `kitr routes:list` and `api:sync`. */
  toJSON() {
    return this.routes.map(({ method, path, name, validate, meta }) => ({
      method,
      path,
      name,
      validates: { params: !!validate?.params, query: !!validate?.query, body: !!validate?.body },
      meta,
    }))
  }
}

export function joinPath(base: string, path: string): string {
  const joined = `${base}/${path}`.replace(/\/{2,}/g, '/').replace(/\/$/, '')
  return joined === '' ? '/' : joined.startsWith('/') ? joined : `/${joined}`
}

/** Entry point for `start/routes.ts`. Returns the router with accumulated types. */
export function defineRoutes<R extends RouteMap>(
  define: (router: Router<{}>) => Router<R>,
): Router<R> {
  return define(new Router<{}>())
}

export function createRouter(): Router<{}> {
  return new Router<{}>()
}
