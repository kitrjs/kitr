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

const { defineAction, requireSession } = await import('../src')

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

describe('defineAction', () => {
  it('validates input, passes the parsed value to the handler and returns its result', async () => {
    const handler = vi.fn(({ input }: { input: { title: string } }) => ({ id: 1, ...input }))
    const create = defineAction('projects.create', { input: titleSchema, handler })
    await expect(create({ title: '  Launch  ' })).resolves.toEqual({ id: 1, title: 'Launch' })
    expect(handler.mock.calls[0]![0].input).toEqual({ title: 'Launch' })
    expect(built[0]!.method).toBe('POST')
  })

  it('rejects invalid input with VALIDATION and field errors, without running the handler', async () => {
    const handler = vi.fn()
    const create = defineAction('projects.create', { input: titleSchema, handler })
    const error = await create({ title: ' ' }).catch((e) => e)
    expect(error).toBeInstanceOf(KitrError)
    expect(error.code).toBe('VALIDATION')
    expect(error.status).toBe(422)
    expect(error.fieldErrors).toEqual({ title: ['Title is required'] })
    expect(handler).not.toHaveBeenCalled()
  })

  it('turns thrown KitrErrors into the same error on the caller, data included', async () => {
    const archive = defineAction('projects.archive', {
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
    const broken = defineAction('reports.build', {
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
      '[kitr/actions] reports.build failed:',
      expect.objectContaining({ message: 'db password is hunter2' }),
    )
  })

  it('keeps server error messages in development, and client errors always', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const broken = defineAction('x', {
      handler: () => {
        throw new Error('boom')
      },
    })
    expect((await broken().catch((e) => e)).message).toBe('boom')
    vi.stubEnv('NODE_ENV', 'production')
    const conflict = defineAction('y', {
      handler: () => {
        throw new KitrError('CONFLICT', 'Already archived')
      },
    })
    expect((await conflict().catch((e) => e)).message).toBe('Already archived')
  })

  it('does not log client errors', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const create = defineAction('projects.create', { input: titleSchema, handler: () => 1 })
    await create({ title: '' }).catch(() => {})
    expect(log).not.toHaveBeenCalled()
  })

  it('passes the abort signal through to the handler', async () => {
    let seen: AbortSignal | undefined
    const slow = defineAction('slow', {
      handler: ({ signal }) => {
        seen = signal
        return true
      },
    })
    const controller = new AbortController()
    await slow(undefined, { signal: controller.signal })
    expect(seen).toBe(controller.signal)
  })

  it('has a name, stable keys and the GET method when asked', () => {
    const list = defineAction('projects.list', { method: 'GET', handler: () => [] })
    expect(list.name).toBe('projects.list')
    expect(list.key(undefined)).toEqual(['action', 'projects.list'])
    const search = defineAction('projects.search', {
      method: 'GET',
      input: titleSchema,
      handler: () => [],
    })
    expect(search.key({ title: 'a' })).toEqual(['action', 'projects.search', { title: 'a' }])
    expect(built.map((b) => b.method)).toEqual(['GET', 'GET'])
  })

  it('exposes a query contract that fetches through the action', async () => {
    const get = defineAction('projects.get', {
      method: 'GET',
      input: titleSchema,
      handler: ({ input }) => ({ found: input.title }),
    })
    const contract = get.query()
    expect(contract.source).toBe('action')
    expect(contract.key({ title: 'x' })).toEqual(get.key({ title: 'x' }))
    await expect(contract.fetch({ title: 'x' }, {})).resolves.toEqual({ found: 'x' })
  })

  it('exposes a mutation contract with its cache effects', async () => {
    const effects = (project: { id: number }) => ({
      invalidate: [['projects', 'list']],
      id: project.id,
    })
    const update = defineAction('projects.update', {
      input: titleSchema,
      effects: effects as any,
      handler: ({ input }) => ({ id: 3, ...input }),
    })
    const contract = update.mutation()
    expect(contract.source).toBe('action')
    expect(contract.effects).toBe(effects)
    await expect(contract.mutate({ title: 'New' })).resolves.toEqual({ id: 3, title: 'New' })
  })

  it('registers middleware only when given', () => {
    const mw = [{ fn: () => {} }]
    defineAction('a', { handler: () => 1 })
    defineAction('b', { middleware: mw, handler: () => 1 })
    expect(built[0]!.middleware).toBeUndefined()
    expect(built[1]!.middleware).toBe(mw)
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
