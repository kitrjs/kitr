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
import { createMiddleware, createServerFn } from '@tanstack/react-start'

type Envelope<T> = { ok: true; data: T } | { ok: false; error: KitrErrorShape }

export interface ActionContext<TInput, TContext> {
  input: TInput
  /** Context from Start middleware (request, session...). */
  context: TContext
  signal: AbortSignal
}

export interface DefineActionOptions<S extends StandardSchemaV1 | undefined, TOutput, TContext> {
  /** GET actions can be cached and prefetched like queries; POST (default) for mutations. */
  method?: 'GET' | 'POST'
  input?: S
  /** TanStack Start middleware (`createMiddleware({ type: 'function' })`). */
  middleware?: ReadonlyArray<any>
  /** Cache effects applied on the client after success (mutations). */
  effects?:
    | CacheEffect
    | ((result: TOutput, input: S extends StandardSchemaV1 ? InferOutput<S> : void) => CacheEffect)
  handler: (
    ctx: ActionContext<S extends StandardSchemaV1 ? InferOutput<S> : void, TContext>,
  ) => TOutput | Promise<TOutput>
}

export interface Action<TInput, TOutput> {
  (input: TInput, options?: { signal?: AbortSignal }): Promise<TOutput>
  readonly name: string
  key(input: TInput): QueryKey
  query(): Omit<QueryContract<TInput, TOutput>, 'kind'>
  mutation(): Omit<MutationContract<TInput, TOutput>, 'kind'>
  /** The raw TanStack server function, for `useServerFn` or middleware composition. */
  serverFn: (opts: { data: unknown; signal?: AbortSignal }) => Promise<Envelope<TOutput>>
}

/**
 * A server action: a TanStack Start server function with kitr's input validation,
 * one error shape (validation errors land on form fields) and cache effects.
 *
 *   export const updateProject = defineAction('projects.update', {
 *     input: updateProjectSchema,
 *     effects: (project) => ({ set: [{ key: ['projects', 'detail', project.id], data: project }], invalidate: [['projects', 'list']] }),
 *     handler: ({ input }) => db.projects.update(input),
 *   })
 */
export function defineAction<
  S extends StandardSchemaV1 | undefined = undefined,
  TOutput = unknown,
  TContext = {},
>(
  name: string,
  options: DefineActionOptions<S, TOutput, TContext>,
): Action<S extends StandardSchemaV1 ? InferOutput<S> : void, TOutput> {
  type TInput = S extends StandardSchemaV1 ? InferOutput<S> : void
  const method = options.method ?? 'POST'
  let builder: any = createServerFn({ method })
  if (options.middleware?.length) builder = builder.middleware(options.middleware)
  const serverFn = builder
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
          let input = data as TInput
          if (options.input) {
            const result = await validate(options.input, data)
            if (!result.success) throw KitrError.validation(result.fieldErrors)
            input = result.data as TInput
          }
          const out = await options.handler({ input, context, signal })
          return { ok: true, data: out }
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

  const call = async (
    input: TInput,
    callOptions: { signal?: AbortSignal } = {},
  ): Promise<TOutput> => {
    const envelope: Envelope<TOutput> = await serverFn({
      data: input ?? undefined,
      signal: callOptions.signal,
    })
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
  const key = (input: TInput): QueryKey =>
    input === undefined ? ['action', name] : ['action', name, input]
  const action = Object.assign(call, {
    key,
    serverFn,
    query: () => ({
      source: 'action',
      key,
      fetch: (input: TInput, ctx: { signal?: AbortSignal }) => call(input, ctx),
    }),
    mutation: () => ({
      source: 'action',
      mutate: (input: TInput) => call(input),
      effects: options.effects as any,
    }),
  })
  Object.defineProperty(action, 'name', { value: name })
  return action as unknown as Action<TInput, TOutput>
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
