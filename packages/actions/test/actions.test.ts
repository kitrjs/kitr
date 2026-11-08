import { KitrError } from '@kitr/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Start's server functions need the Start bundler to run on the client. Here they run
 * in-process: the builder records method and middleware and calls the handler directly,
 * the way Start does on the server. What is tested is kitr's part: validation, the error
 * envelope, keys, and the query and mutation contracts.
 */
const built: Array<{ method: string; middleware?: unknown[] }> = []
vi.mock('@tanstack/react-start', () => ({
  createServerFn: ({ method }: { method: string }) => {
    const record: { method: string; middleware?: unknown[] } = { method }
    built.push(record)
    const builder = {
      middleware(m: unknown[]) {
        record.middleware = m
        return builder
      },
      validator: () => builder,
      handler:
        (h: (o: { data: unknown; context: unknown; signal: AbortSignal }) => unknown) =>
        (opts: { data: unknown; signal?: AbortSignal; context?: unknown }) =>
          // Start serializes data over the wire; do the same so tests catch non-JSON results.
          Promise.resolve(
            h({
              data: JSON.parse(JSON.stringify(opts.data ?? null)) ?? undefined,
              context: opts.context ?? { session: { user: { id: 'u1' } } },
              signal: opts.signal ?? new AbortController().signal,
            }),
          ).then((r) => JSON.parse(JSON.stringify(r))),
    }
    return builder
  },
  createMiddleware: () => ({ server: (fn: unknown) => ({ fn }) }),
}))

const { defineMutation, defineQuery, requireSession } = await import('../src')

/** A minimal Standard Schema: `{ title: string }` with a trimmed, non-empty title. */
const titleSchema = {
  '~standard': {
    version: 1 as const,
    vendor: 'test',
    validate(value: unknown) {
      const title = (value as { title?: unknown } | undefined)?.title
      if (typeof title !== 'string' || !title.trim())
        return { issues: [{ message: 'Title is required', path: ['title'] }] }
      return { value: { title: title.trim() } }
    },
  },
} as const

afterEach(() => {
  built.length = 0
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('defineQuery and defineMutation', () => {
  it('validates input, passes the parsed value to the handler and returns its result', async () => {
    const handler = vi.fn(({ input }: { input: { title: string } }) => ({ id: 1, ...input }))
    const create = defineMutation('projects.create', { input: titleSchema, handler })
    await expect(create({ title: '  Launch  ' })).resolves.toEqual({ id: 1, title: 'Launch' })
    expect(handler.mock.calls[0]![0].input).toEqual({ title: 'Launch' })
    expect(built[0]!.method).toBe('POST')
    expect(create.kind).toBe('mutation')
  })

  it('rejects invalid input with VALIDATION and field errors, without running the handler', async () => {
    const handler = vi.fn()
    const create = defineMutation('projects.create', { input: titleSchema, handler })
    const error = await create({ title: ' ' }).catch((e) => e)
    expect(error).toBeInstanceOf(KitrError)
    expect(error.code).toBe('VALIDATION')
    expect(error.status).toBe(422)
    expect(error.fieldErrors).toEqual({ title: ['Title is required'] })
    expect(handler).not.toHaveBeenCalled()
  })

  it('turns thrown KitrErrors into the same error on the caller, data included', async () => {
    const archive = defineMutation('projects.archive', {
      handler: () => {
        throw new KitrError('CONFLICT', 'Already archived', { data: { id: 7 } })
      },
    })
    const error = await archive().catch((e) => e)
    expect(error).toBeInstanceOf(KitrError)
    expect(error).toMatchObject({ code: 'CONFLICT', message: 'Already archived', status: 409 })
    expect(error.data).toEqual({ id: 7 })
  })

  it('hides server errors from the browser in production and logs them', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const broken = defineQuery('reports.build', {
      handler: () => {
        throw new KitrError('INTERNAL', 'db password is hunter2', { data: { dsn: 'pg://x' } })
      },
    })
    const error = await broken().catch((e) => e)
    expect(error).toBeInstanceOf(KitrError)
    expect(error.status).toBe(500)
    expect(error.message).toBe('Internal server error')
    expect(error.data).toBeUndefined()
    expect(log).toHaveBeenCalledWith(
      '[@kitr/actions] reports.build failed:',
      expect.objectContaining({ message: 'db password is hunter2' }),
    )
  })

  it('keeps server error messages in development, and client errors always', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const broken = defineQuery('x', {
      handler: () => {
        throw new Error('boom')
      },
    })
    expect((await broken().catch((e) => e)).message).toBe('boom')
    vi.stubEnv('NODE_ENV', 'production')
    const conflict = defineMutation('y', {
      handler: () => {
        throw new KitrError('CONFLICT', 'Already archived')
      },
    })
    expect((await conflict().catch((e) => e)).message).toBe('Already archived')
  })

  it('does not log client errors', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const create = defineMutation('projects.create', { input: titleSchema, handler: () => 1 })
    await create({ title: '' }).catch(() => {})
    expect(log).not.toHaveBeenCalled()
  })

  it('passes the abort signal through to the handler', async () => {
    let seen: AbortSignal | undefined
    const slow = defineQuery('slow', {
      handler: ({ signal }) => {
        seen = signal
        return true
      },
    })
    const controller = new AbortController()
    await slow(undefined, { signal: controller.signal })
    expect(seen).toBe(controller.signal)
  })

  it('a query is GET with a name, stable keys and ready-made query options', () => {
    const list = defineQuery('projects.list', { handler: () => [] })
    expect(list.name).toBe('projects.list')
    expect(list.kind).toBe('query')
    expect(list.key(undefined)).toEqual(['action', 'projects.list'])
    const search = defineQuery('projects.search', {
      input: titleSchema,
      staleTime: 5_000,
      handler: () => [],
    })
    expect(search.key({ title: 'a' })).toEqual(['action', 'projects.search', { title: 'a' }])
    const options = search.options({ title: 'a' })
    expect(options.queryKey).toEqual(['action', 'projects.search', { title: 'a' }])
    expect(options.staleTime).toBe(5_000)
    expect(options.meta).toEqual({ source: 'action' })
    expect(built.map((b) => b.method)).toEqual(['GET', 'GET'])
  })

  it('a query fetches through its options and its contract', async () => {
    const get = defineQuery('projects.get', {
      input: titleSchema,
      handler: ({ input }) => ({ found: input.title }),
    })
    expect(get.contract.source).toBe('action')
    await expect(get.contract.fetch({ title: 'x' }, {})).resolves.toEqual({ found: 'x' })
    await expect(
      get.options({ title: 'y' }).queryFn!({ signal: new AbortController().signal } as any),
    ).resolves.toEqual({ found: 'y' })
    await expect(get.fetch({ title: 'z' })).resolves.toEqual({ found: 'z' })
  })

  it('a mutation carries its cache effects into the contract and mutation options', async () => {
    const effects = (project: { id: number }) => ({
      invalidate: [['projects', 'list']],
      id: project.id,
    })
    const update = defineMutation('projects.update', {
      input: titleSchema,
      effects: effects as any,
      handler: ({ input }) => ({ id: 3, ...input }),
    })
    expect(update.kind).toBe('mutation')
    expect(update.contract.source).toBe('action')
    expect(update.contract.effects).toBe(effects)
    await expect(update.mutate({ title: 'New' })).resolves.toEqual({ id: 3, title: 'New' })
    expect(update.effectsFor({ id: 3, title: 'New' }, { title: 'New' })).toEqual({
      invalidate: [['projects', 'list']],
      id: 3,
    })
    const options = update.options({ queryClient: { invalidateQueries: vi.fn() } as any })
    await expect(options.mutationFn!({ title: 'Again' }, {} as any)).resolves.toEqual({
      id: 3,
      title: 'Again',
    })
  })

  it('run() validates and runs the handler in-process with the given context, skipping Start', async () => {
    const rename = defineMutation('projects.rename', {
      input: titleSchema,
      handler: ({ input, context }) => ({
        title: input.title,
        user: (context as { session?: { user?: { id: string } } }).session?.user?.id,
      }),
    })
    await expect(
      rename.run({ title: ' Hi ' }, { context: { session: { user: { id: 'u9' } } } }),
    ).resolves.toEqual({
      title: 'Hi',
      user: 'u9',
    })
    const error = await rename.run({ title: '' }).catch((e) => e)
    expect(error).toBeInstanceOf(KitrError)
    expect(error.code).toBe('VALIDATION')
  })

  it('registers middleware only when given', () => {
    const mw = [{ fn: () => {} }]
    defineQuery('a', { handler: () => 1 })
    defineMutation('b', { middleware: mw, handler: () => 1 })
    expect(built[0]!.middleware).toBeUndefined()
    // kitr's error guard goes first, then the app's middleware in order.
    expect(built[1]!.middleware).toHaveLength(2)
    expect(built[1]!.middleware![1]).toBe(mw[0])
  })
})

// An error thrown by middleware goes through the envelope too, so the client gets a KitrError
// and a production server error does not leak its message.
describe('middleware errors', () => {
  const guardOf = () => {
    defineMutation('guarded', { middleware: [{ fn: () => {} }], handler: () => 1 })
    const guard = built.at(-1)!.middleware![0] as { fn: (ctx: unknown) => Promise<any> }
    return (next: () => unknown) => guard.fn({ data: undefined, context: {}, next })
  }

  it('turns a KitrError from middleware into the error envelope', async () => {
    const run = guardOf()
    const out = await run(() => {
      throw KitrError.unauthorized()
    })
    expect(out.result).toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED', status: 401 } })
    expect('error' in out).toBe(false)
  })

  it('masks a server error from middleware in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const run = guardOf()
    const out = await run(async () => {
      throw new Error('db password is hunter2')
    })
    expect(out.result.ok).toBe(false)
    expect(out.result.error.message).toBe('Internal server error')
    expect(JSON.stringify(out)).not.toContain('hunter2')
  })

  it('passes results, redirects and notFound through untouched', async () => {
    const run = guardOf()
    await expect(run(async () => ({ result: 'fine' }))).resolves.toEqual({ result: 'fine' })
    const redirect = new Response(null, { status: 307 })
    await expect(
      run(() => {
        throw redirect
      }),
    ).rejects.toBe(redirect)
    const missing = { isNotFound: true }
    await expect(
      run(() => {
        throw missing
      }),
    ).rejects.toBe(missing)
  })
})

describe('requireSession', () => {
  const run = (context: unknown) => {
    const next = vi.fn(() => 'next')
    const fn = (requireSession as unknown as { fn: (o: unknown) => unknown }).fn
    return { next, result: () => fn({ next, context }) }
  }

  it('lets signed-in callers through', async () => {
    const { next, result } = run({ session: { user: { id: 'u1' } } })
    await expect(result()).resolves.toBe('next')
    expect(next).toHaveBeenCalledOnce()
  })

  it.each([undefined, {}, { session: null }, { session: {} }])(
    'rejects anonymous callers (%o) with UNAUTHORIZED',
    async (context) => {
      const { next, result } = run(context)
      await expect(result()).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 })
      expect(next).not.toHaveBeenCalled()
    },
  )
})
