import type { InferOutput, MaybePromise, StandardSchemaV1 } from '@kitr/core'
import type { HttpContext } from './context'

/** The HTTP methods a route can answer. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

/** `/projects/:id/tasks/:taskId` → `{ id: string; taskId: string }` */
export type PathParams<Path extends string> = Path extends `${string}:${infer Param}/${infer Rest}`
  ? { [K in Param | keyof PathParams<`/${Rest}`>]: string }
  : Path extends `${string}:${infer Param}`
    ? { [K in Param]: string }
    : {}

/** Standard Schema validators for a route's inputs. */
export interface Validators {
  /** Validates and converts path parameters. */
  params?: StandardSchemaV1
  /** Validates and converts query values. */
  query?: StandardSchemaV1
  /** Validates the parsed body. */
  body?: StandardSchemaV1
}

type Out<S, Fallback> = S extends StandardSchemaV1 ? InferOutput<S> : Fallback

/** `ctx.params` type: the `params` schema output, or strings from the path. */
export type ValidatedParams<Path extends string, V extends Validators | undefined> = V extends {
  params: infer S
}
  ? Out<S, PathParams<Path>>
  : PathParams<Path>
/** `ctx.query` type: the `query` schema output, or raw query values. */
export type ValidatedQuery<V extends Validators | undefined> = V extends { query: infer S }
  ? Out<S, Record<string, string | string[]>>
  : Record<string, string | string[]>
/** `ctx.body` type: the `body` schema output, or `unknown`. */
export type ValidatedBody<V extends Validators | undefined> = V extends { body: infer S }
  ? Out<S, unknown>
  : unknown

/** A plain function handler. */
export type HandlerFn<P = any, Q = any, B = any, Output = unknown> = (
  ctx: HttpContext<P, Q, B>,
) => MaybePromise<Output>

/** Route middleware: `(ctx, next)`. Return `next()` to continue, or return or throw to stop. */
export type Middleware<P = any, Q = any, B = any> = (
  ctx: HttpContext<P, Q, B>,
  next: () => Promise<unknown>,
) => MaybePromise<unknown>

/** Options for one route: name, validators, middleware and OpenAPI metadata. */
export interface RouteOptions<Name extends string = string, V extends Validators = Validators> {
  /** Route name, used by the typed client (`api.projects.show`) and `router.url()`. */
  name?: Name
  /** Schemas for `params`, `query` and `body`. */
  validate?: V
  /** Middleware for this route, after the group's. */
  middleware?: Middleware[]
  /** Free-form metadata, emitted into OpenAPI (`summary`, `description`, `tags`). */
  meta?: { summary?: string; description?: string; tags?: string[]; deprecated?: boolean }
}

/** The type carried per route into the client. Never constructed at runtime. */
export interface RouteType<
  Method extends HttpMethod = HttpMethod,
  Path extends string = string,
  Params = any,
  Query = any,
  Body = any,
  Output = unknown,
> {
  /** The route's HTTP method. */
  method: Method
  /** The full path, prefixes included. */
  path: Path
  /** What the client passes as `params`. */
  params: Params
  /** What the client passes as `query`. */
  query: Query
  /** What the client passes as `body`. */
  body: Body
  /** What the call resolves to. */
  output: Output
}

/** Route types by name: what `typeof routes.$types` holds. */
export type RouteMap = Record<string, RouteType>

/** Runtime route entry. */
export interface RouteEntry {
  /** HTTP method. */
  method: HttpMethod
  /** Full path, prefixes included. */
  path: string
  /** The route name, or `METHOD /path` when none was given. */
  name: string
  /** A function or a `[Controller, 'method']` pair. */
  handler: unknown
  /** Group and route middleware, in run order. */
  middleware: Middleware[]
  /** Validators from the route options. */
  validate?: Validators
  /** OpenAPI metadata. */
  meta?: RouteOptions['meta']
}
