import {
  type CacheEffect,
  type InferOutput,
  KitrError,
  type KitrErrorShape,
  type MutationContract,
  type QueryContract,
  type QueryKey,
  type StandardSchemaV1,
  toKitrError,
  validate,
} from '@kitr/core'
import {
  mutationFrom as defineMutationContract,
  queryFrom as defineQueryContract,
  type MutationDefinition,
  type QueryDefinition,
} from '@kitr/query'
import { createMiddleware, createServerFn } from '@tanstack/react-start'

type Envelope<T> = { ok: true; data: T } | { ok: false; error: KitrErrorShape }

type InputOf<S> = S extends StandardSchemaV1 ? InferOutput<S> : void

/** What a handler receives: the validated input, Start middleware context, and the request's abort signal. */
export interface HandlerContext<TInput, TContext> {
  input: TInput
  /** Context from Start middleware (request, session...). */
  context: TContext
  signal: AbortSignal
}

/** Options shared by `defineQuery` and `defineMutation`. */
export interface DefineOperationOptions<S extends StandardSchemaV1 | undefined, TOutput, TContext> {
  /** Any Standard Schema. Validated on the server; a failure reaches the caller as a VALIDATION error with field errors. */
  input?: S
  /** TanStack Start function middleware (`createMiddleware({ type: 'function' })`). */
  middleware?: ReadonlyArray<any>
  /** Runs on the server only. Its code, and anything it imports, never reaches the browser bundle. */
  handler: (ctx: HandlerContext<InputOf<S>, TContext>) => TOutput | Promise<TOutput>
}

/** The second argument of `defineQuery`: the shared options plus `staleTime`. */
export interface DefineQueryOptions<S extends StandardSchemaV1 | undefined, TOutput, TContext>
  extends DefineOperationOptions<S, TOutput, TContext> {
  /** How long a result counts as fresh, in milliseconds. Carried into the query options. */
  staleTime?: number
}

/** The second argument of `defineMutation`: the shared options plus cache `effects`. */
export interface DefineMutationOptions<S extends StandardSchemaV1 | undefined, TOutput, TContext>
  extends DefineOperationOptions<S, TOutput, TContext> {
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

/**
 * A server query: a `QueryDefinition` from `kitr/query` that is also a function. Call it to fetch,
 * pass `.options(input)` to any TanStack hook or loader, or use it by name once `kitr types` has
 * registered it.
 */
export interface ServerQuery<TInput, TOutput, TContext = unknown>
  extends QueryDefinition<TInput, TOutput> {
  (input: TInput, options?: { signal?: AbortSignal }): Promise<TOutput>
  readonly name: string
  /** Validation and the handler in-process, for tests. Skips Start middleware. */
  run(input: TInput, options?: CallOptions<TContext>): Promise<TOutput>
  readonly serverFn: ServerFn<TOutput>
}

/**
 * A server mutation: a `MutationDefinition` from `kitr/query` that is also a function. Call it to
 * mutate, pass it to `useMutation` for pending state and cache effects, or use it by name.
 */
export interface ServerMutation<TInput, TOutput, TContext = unknown>
  extends MutationDefinition<TInput, TOutput> {
  (input: TInput, options?: { signal?: AbortSignal }): Promise<TOutput>
  readonly name: string
  /** Validation and the handler in-process, for tests. Skips Start middleware. */
  run(input: TInput, options?: CallOptions<TContext>): Promise<TOutput>
  readonly serverFn: ServerFn<TOutput>
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
  TContext = {},
>(
  name: string,
  options: DefineQueryOptions<S, TOutput, TContext>,
): ServerQuery<InputOf<S>, TOutput, TContext> {
  type TInput = InputOf<S>
  const { serverFn, call, run } = build<S, TOutput, TContext>(name, 'GET', options)
  const key = (input: TInput): QueryKey =>
    input === undefined ? ['action', name] : ['action', name, input]
  const contract: Omit<QueryContract<TInput, TOutput>, 'kind'> = {
    source: 'action',
    key,
    fetch: (input, ctx) => call(input, ctx),
    ...(options.staleTime !== undefined ? { staleTime: options.staleTime } : {}),
  }
  const definition = Object.assign(call, defineQueryContract<TInput, TOutput>(contract), {
    run,
    serverFn,
  })
  Object.defineProperty(definition, 'name', { value: name })
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
  TContext = {},
>(
  name: string,
  options: DefineMutationOptions<S, TOutput, TContext>,
): ServerMutation<InputOf<S>, TOutput, TContext> {
  type TInput = InputOf<S>
  const { serverFn, call, run } = build<S, TOutput, TContext>(name, 'POST', options)
  const contract: Omit<MutationContract<TInput, TOutput>, 'kind'> = {
    source: 'action',
    mutate: (input) => call(input),
    effects: options.effects as MutationContract<TInput, TOutput>['effects'],
  }
  const definition = Object.assign(call, defineMutationContract<TInput, TOutput>(contract), {
    run,
    serverFn,
  })
  Object.defineProperty(definition, 'name', { value: name })
  return definition as unknown as ServerMutation<TInput, TOutput, TContext>
}

/** The Start server function, the client-side call and the in-process run, shared by both definitions. */
function build<S extends StandardSchemaV1 | undefined, TOutput, TContext>(
  name: string,
  method: 'GET' | 'POST',
  options: DefineOperationOptions<S, TOutput, TContext>,
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
    return options.handler({ input, context, signal })
  }
  let builder: any = createServerFn({ method })
  if (options.middleware?.length) builder = builder.middleware(options.middleware)
  const serverFn: ServerFn<TOutput> = builder
    .validator((data: unknown) => data)
    .handler(
      async ({
        data,
        context,
        signal,
      }: {
        data: unknown
        context: TContext
        signal: AbortSignal
      }): Promise<Envelope<TOutput>> => {
        try {
          return { ok: true, data: await execute(data, context, signal) }
        } catch (error) {
          const kitrError = toKitrError(error)
          const shape = kitrError.toJSON()
          if (kitrError.status >= 500) {
            console.error(`[kitr/actions] ${name} failed:`, error)
            // Same rule as the kitr server: in production a server error's message and data
            // stay in the server log and never reach the browser.
            if ((globalThis as any).process?.env?.NODE_ENV === 'production') {
              shape.message = 'Internal server error'
              shape.data = undefined
            }
          }
          return { ok: false, error: shape }
        }
      },
    )
  const call = async (input: TInput, callOptions: { signal?: AbortSignal } = {}) => {
    const envelope = await serverFn({ data: input ?? undefined, signal: callOptions.signal })
    if (!envelope.ok) {
      const e = envelope.error
      throw new KitrError(e.code, e.message, {
        status: e.status,
        fieldErrors: e.fieldErrors,
        data: e.data,
      })
    }
    return envelope.data
  }
  const run = (input: TInput, runOptions: CallOptions<TContext> = {}) =>
    execute(
      input,
      (runOptions.context ?? {}) as TContext,
      runOptions.signal ?? new AbortController().signal,
    )
  return { serverFn, call, run }
}

/** Re-exported so apps write middleware with the same import path. */
export { createMiddleware, createServerFn }

/** Shortcut: a function middleware that rejects anonymous callers. Expects `context.session` from an earlier middleware. */
export const requireSession = createMiddleware({ type: 'function' }).server(
  async ({ next, context }) => {
    const session = (context as unknown as { session?: { user?: unknown } } | undefined)?.session
    if (!session?.user) throw KitrError.unauthorized()
    return next()
  },
)
