import {
  type CacheEffect,
  type InferOutput,
  inProduction,
  KitrError,
  type MutationContract,
  type QueryContract,
  type QueryKey,
  type StandardSchemaV1,
  toKitrError,
  validate,
} from '@kitr/core'
import {
  type Envelope,
  failEnvelope,
  keyFor,
  linkSignals,
  okEnvelope,
  unwrapEnvelope,
} from '@kitr/core/request'
import {
  mutationFrom as defineMutationContract,
  queryFrom as defineQueryContract,
  type MutationDefinition,
  type QueryDefinition,
} from '@kitr/query'
import { createMiddleware } from '@tanstack/react-start'

type InputOf<S> = S extends StandardSchemaV1 ? InferOutput<S> : void

type UnionToIntersection<U> = (U extends unknown ? (u: U) => void : never) extends (
  i: infer I,
) => void
  ? I
  : never
type ServerContextOf<M> = M extends { '~types': { allServerContext: infer C } }
  ? C extends object
    ? C
    : {}
  : {}

/** The context a list of Start function middleware gives the handler: every middleware's `next({ context })`, merged. */
export type MiddlewareContext<M extends ReadonlyArray<unknown>> = [M[number]] extends [never]
  ? {}
  : UnionToIntersection<ServerContextOf<M[number]>> & {}

/** What a handler receives: the validated input, Start middleware context, and the request's abort signal. */
export interface HandlerContext<TInput, TContext> {
  input: TInput
  /** Context from Start middleware (request, session...). */
  context: TContext
  signal: AbortSignal
}

/** Options shared by `defineQuery` and `defineMutation`. */
export interface DefineOperationOptions<
  S extends StandardSchemaV1 | undefined,
  TOutput,
  TContext,
  M extends ReadonlyArray<unknown> = ReadonlyArray<unknown>,
> {
  /** Any Standard Schema. Validated on the server; a failure reaches the caller as a VALIDATION error with field errors. */
  input?: S
  /**
   * TanStack Start function middleware (`createMiddleware({ type: 'function' })`). What each one
   * passes to `next({ context })` is typed on the handler's `context`. An error thrown here reaches
   * the caller the same way a handler error does, masked in production when it is a server error.
   */
  middleware?: M
  /** Runs on the server only. Its code, and anything it imports, never reaches the browser bundle. */
  handler: (ctx: HandlerContext<InputOf<S>, TContext>) => TOutput | Promise<TOutput>
}

/** The second argument of `defineQuery`: the shared options plus `staleTime`. */
export interface DefineQueryOptions<
  S extends StandardSchemaV1 | undefined,
  TOutput,
  TContext,
  M extends ReadonlyArray<unknown> = ReadonlyArray<unknown>,
> extends DefineOperationOptions<S, TOutput, TContext, M> {
  /** How long a result counts as fresh, in milliseconds. Carried into the query options. */
  staleTime?: number
}

/** The second argument of `defineMutation`: the shared options plus cache `effects`. */
export interface DefineMutationOptions<
  S extends StandardSchemaV1 | undefined,
  TOutput,
  TContext,
  M extends ReadonlyArray<unknown> = ReadonlyArray<unknown>,
> extends DefineOperationOptions<S, TOutput, TContext, M> {
  /** Cache effects applied on the client after success. A function gets the result and the input. */
  effects?: CacheEffect | ((result: TOutput, input: InputOf<S>) => CacheEffect)
}

/** Options for a direct call or `.run()`. */
export interface CallOptions<TContext = unknown> {
  signal?: AbortSignal
  /** `.run()` only: the middleware context the handler would see. */
  context?: Partial<TContext>
}

/** The raw TanStack server function behind a definition, for `useServerFn` or middleware composition. */
export type ServerFn<TOutput> = (opts: {
  data: unknown
  signal?: AbortSignal
}) => Promise<Envelope<TOutput>>

/** What a Start server function passes to its handler. */
export interface ServerFnContext<TContext = unknown> {
  data: unknown
  context: TContext
  signal: AbortSignal
}

/**
 * A server query: a `QueryDefinition` from `@kitr/query` that is also a function. Call it to fetch,
 * pass `.options(input)` to any TanStack hook or loader, or use it by name once `kitr types` has
 * registered it.
 */
export interface ServerQuery<TInput, TOutput, TContext = unknown>
  extends QueryDefinition<TInput, TOutput> {
  (input: TInput, options?: { signal?: AbortSignal }): Promise<TOutput>
  readonly name: string
  /** Validation and the handler in-process, for tests. Skips Start middleware. */
  run(input: TInput, options?: CallOptions<TContext>): Promise<TOutput>
  /** The Start server function behind this action, bound by the registry `kitr types` writes. */
  readonly serverFn: ServerFn<TOutput>
  /** The middleware passed to `middleware`. The registry puts it on the server function. */
  readonly middleware: ReadonlyArray<unknown>
  /** The server function's body: validate, run the handler and wrap the result. For the generated registry. */
  handle(ctx: ServerFnContext<TContext>): Promise<Envelope<TOutput>>
  /** Attach the server function the registry created. For the generated registry. */
  bind(serverFn: ServerFn<TOutput>): void
}

/**
 * A server mutation: a `MutationDefinition` from `@kitr/query` that is also a function. Call it to
 * mutate, pass it to `useMutation` for pending state and cache effects, or use it by name.
 */
export interface ServerMutation<TInput, TOutput, TContext = unknown>
  extends MutationDefinition<TInput, TOutput> {
  (input: TInput, options?: { signal?: AbortSignal }): Promise<TOutput>
  readonly name: string
  /** Validation and the handler in-process, for tests. Skips Start middleware. */
  run(input: TInput, options?: CallOptions<TContext>): Promise<TOutput>
  /** The Start server function behind this action, bound by the registry `kitr types` writes. */
  readonly serverFn: ServerFn<TOutput>
  /** The middleware passed to `middleware`. The registry puts it on the server function. */
  readonly middleware: ReadonlyArray<unknown>
  /** The server function's body: validate, run the handler and wrap the result. For the generated registry. */
  handle(ctx: ServerFnContext<TContext>): Promise<Envelope<TOutput>>
  /** Attach the server function the registry created. For the generated registry. */
  bind(serverFn: ServerFn<TOutput>): void
}

/**
 * Define a query whose handler runs on the server. The name is the registry key `kitr types`
 * writes to `.kitr/actions.ts`, so `useQuery('projects.list', input)` works with these types.
 *
 *   export const listProjects = defineQuery('projects.list', {
 *     input: z.object({ status: z.enum(['open', 'closed']).optional() }),
 *     handler: ({ input }) => db.projects.findMany({ where: input }),
 *   })
 */
export function defineQuery<
  S extends StandardSchemaV1 | undefined = undefined,
  TOutput = unknown,
  const M extends ReadonlyArray<unknown> = [],
  TContext = MiddlewareContext<M>,
>(
  name: string,
  options: DefineQueryOptions<S, TOutput, TContext, M>,
): ServerQuery<InputOf<S>, TOutput, TContext> {
  type TInput = InputOf<S>
  const { call, members } = build<S, TOutput, TContext>(name, options)
  const key = (input: TInput): QueryKey => keyFor('action', name, input)
  const contract: Omit<QueryContract<TInput, TOutput>, 'kind'> = {
    source: 'action',
    key,
    fetch: (input, ctx) => call(input, ctx),
    ...(options.staleTime !== undefined ? { staleTime: options.staleTime } : {}),
  }
  const definition = Object.assign(call, defineQueryContract<TInput, TOutput>(contract))
  Object.defineProperties(definition, members)
  return definition as unknown as ServerQuery<TInput, TOutput, TContext>
}

/**
 * Define a mutation whose handler runs on the server, with the cache effects it has on success.
 *
 *   export const updateProject = defineMutation('projects.update', {
 *     input: z.object({ id: z.string(), name: z.string().min(2) }),
 *     effects: (project) => ({ set: [{ key: projectKeys.detail(project.id), data: project }], invalidate: [projectKeys.lists()] }),
 *     handler: ({ input }) => db.projects.update(input),
 *   })
 */
export function defineMutation<
  S extends StandardSchemaV1 | undefined = undefined,
  TOutput = unknown,
  const M extends ReadonlyArray<unknown> = [],
  TContext = MiddlewareContext<M>,
>(
  name: string,
  options: DefineMutationOptions<S, TOutput, TContext, M>,
): ServerMutation<InputOf<S>, TOutput, TContext> {
  type TInput = InputOf<S>
  const { call, members } = build<S, TOutput, TContext>(name, options)
  const contract: Omit<MutationContract<TInput, TOutput>, 'kind'> = {
    source: 'action',
    mutate: (input) => call(input),
    effects: options.effects as MutationContract<TInput, TOutput>['effects'],
  }
  const definition = Object.assign(call, defineMutationContract<TInput, TOutput>(contract))
  Object.defineProperties(definition, members)
  return definition as unknown as ServerMutation<TInput, TOutput, TContext>
}

/** The error envelope for a failed operation. Server errors are logged and, in production, masked. */
function failure(name: string, error: unknown): Envelope<never> {
  const kitrError = toKitrError(error)
  if (kitrError.status >= 500) console.error(`[@kitr/actions] ${name} failed:`, error)
  // Same rule as the kitr server: in production a server error's message and data
  // stay in the server log and never reach the browser.
  return failEnvelope(kitrError, { mask: inProduction() })
}

/** redirect() throws a Response and notFound() a marked object: both steer the router, so pass them on. */
const steersRouter = (error: unknown) =>
  error instanceof Response || (error as { isNotFound?: unknown } | null)?.isNotFound === true

/**
 * A function middleware that wraps the rest of the chain. When a later middleware throws, it
 * answers with the error envelope as the function's result instead of letting Start send the raw
 * error. A redirect or other Response is let through.
 */
function guard(name: string) {
  return createMiddleware({ type: 'function' }).server((async (ctx: any) => {
    const { next, ...rest } = ctx
    try {
      return await next()
    } catch (error) {
      if (steersRouter(error)) throw error
      return { ...rest, result: failure(name, error) }
    }
  }) as any)
}

/**
 * What both definitions share. The Start server function is not made here: Start compiles
 * `createServerFn` only where it is written in the app's own source, so the registry `kitr types`
 * writes creates one per action and hands it to `bind`. Until then (a unit test that imports an
 * action) a call runs the handler in-process, as `run` does.
 */
function build<S extends StandardSchemaV1 | undefined, TOutput, TContext>(
  name: string,
  options: DefineOperationOptions<S, TOutput, TContext, ReadonlyArray<unknown>>,
) {
  type TInput = InputOf<S>
  const execute = async (
    data: unknown,
    context: TContext,
    signal: AbortSignal,
  ): Promise<TOutput> => {
    let input = data as TInput
    if (options.input) {
      const result = await validate(options.input, data)
      if (!result.success) throw KitrError.validation(result.fieldErrors)
      input = result.data as TInput
    }
    if (typeof options.handler !== 'function')
      throw new Error(
        `[@kitr/actions] ${name} has no handler here: its handler runs on the server and is left out of the browser bundle. Call it through its server function.`,
      )
    return options.handler({ input, context, signal })
  }
  let serverFn: ServerFn<TOutput> | undefined
  const call = async (input: TInput, callOptions: { signal?: AbortSignal } = {}) => {
    if (!serverFn) return run(input, { signal: callOptions.signal })
    const envelope = await serverFn({ data: input ?? undefined, signal: callOptions.signal })
    return unwrapEnvelope(envelope)
  }
  const run = (input: TInput, runOptions: CallOptions<TContext> = {}) =>
    execute(input, (runOptions.context ?? {}) as TContext, linkSignals(runOptions.signal))
  const handle = async ({
    data,
    context,
    signal,
  }: ServerFnContext<TContext>): Promise<Envelope<TOutput>> => {
    try {
      return okEnvelope(await execute(data, context, signal))
    } catch (error) {
      if (steersRouter(error)) throw error
      return failure(name, error)
    }
  }
  const members: PropertyDescriptorMap = {
    name: { value: name },
    run: { value: run },
    handle: { value: handle },
    middleware: { value: options.middleware ?? [] },
    bind: {
      value: (fn: ServerFn<TOutput>) => {
        serverFn = fn
      },
    },
    serverFn: {
      get: () => {
        if (!serverFn)
          throw new Error(
            `[@kitr/actions] ${name} has no server function yet: run \`kitr types\` and import the action through the generated registry (#kitr/actions).`,
          )
        return serverFn
      },
    },
  }
  return { call, members }
}

/**
 * The middleware for an action's server function, for the generated registry: the middleware the
 * action lists, behind kitr's guard, so an error any of them throws reaches the caller as the same
 * typed envelope a handler error does, masked in production.
 */
export function actionMiddleware(action: { name: string; middleware: ReadonlyArray<unknown> }) {
  return (action.middleware.length ? [guard(action.name), ...action.middleware] : []) as never[]
}

/** Re-exported so apps write middleware with the same import path. */
export { createMiddleware }

/** Shortcut: a function middleware that rejects anonymous callers. Expects `context.session` from an earlier middleware. */
export const requireSession = createMiddleware({ type: 'function' }).server(
  async ({ next, context }) => {
    const session = (context as unknown as { session?: { user?: unknown } } | undefined)?.session
    if (!session?.user) throw KitrError.unauthorized()
    return next()
  },
)
