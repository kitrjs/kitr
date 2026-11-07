import type { InferOutput, MaybePromise, StandardSchemaV1 } from '@kitr/core'
import type { HttpContext } from './context'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

/** `/projects/:id/tasks/:taskId` → `{ id: string; taskId: string }` */
export type PathParams<Path extends string> = Path extends `${string}:${infer Param}/${infer Rest}`
  ? { [K in Param | keyof PathParams<`/${Rest}`>]: string }
  : Path extends `${string}:${infer Param}`
    ? { [K in Param]: string }
    : {}

export interface Validators {
  params?: StandardSchemaV1
  query?: StandardSchemaV1
  body?: StandardSchemaV1
}

type Out<S, Fallback> = S extends StandardSchemaV1 ? InferOutput<S> : Fallback

export type ValidatedParams<Path extends string, V extends Validators | undefined> = V extends {
  params: infer S
}
  ? Out<S, PathParams<Path>>
  : PathParams<Path>
export type ValidatedQuery<V extends Validators | undefined> = V extends { query: infer S }
  ? Out<S, Record<string, string | string[]>>
  : Record<string, string | string[]>
export type ValidatedBody<V extends Validators | undefined> = V extends { body: infer S }
  ? Out<S, unknown>
  : unknown

/** A plain function handler. */
export type HandlerFn<P = any, Q = any, B = any, Output = unknown> = (
  ctx: HttpContext<P, Q, B>,
) => MaybePromise<Output>

export type Middleware<P = any, Q = any, B = any> = (
  ctx: HttpContext<P, Q, B>,
  next: () => Promise<unknown>,
) => MaybePromise<unknown>

export interface RouteOptions<Name extends string = string, V extends Validators = Validators> {
  /** Route name, used by the typed client (`api.projects.show`) and `router.url()`. */
  name?: Name
  validate?: V
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
  method: Method
  path: Path
  params: Params
  query: Query
  body: Body
  output: Output
}

export type RouteMap = Record<string, RouteType>

/** Runtime route entry. */
export interface RouteEntry {
  method: HttpMethod
  path: string
  name: string
  handler: unknown
  middleware: Middleware[]
  validate?: Validators
  meta?: RouteOptions['meta']
}
