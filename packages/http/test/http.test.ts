import { createApp, KitrError, schemaFrom } from '@kitr/core'
import { describe, expect, it, vi } from 'vitest'
import { createHttpClient, httpMutation, httpProvider, httpQuery, normaliseHttpError } from '../src'

type Handler = (req: Request) => Response | Promise<Response>
function fake(handler: Handler) {
  const calls: Request[] = []
  const fetch = vi.fn(async (input: Request | string | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init)
    calls.push(req.clone())
    return handler(req)
  })
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls }
}

describe('createHttpClient', () => {
  it('prefixes the base URL and adds a bearer token', async () => {
    const f = fake(() => Response.json({ ok: true }))
    const http = createHttpClient({
      baseUrl: 'https://api.dev/v1',
      getToken: () => 't1',
      fetch: f.fetch,
    })
    expect(await http.get('users').json()).toEqual({ ok: true })
    expect(f.calls[0]!.url).toBe('https://api.dev/v1/users')
    expect(f.calls[0]!.headers.get('authorization')).toBe('Bearer t1')
  })

  it('supports a raw token header', async () => {
    const f = fake(() => Response.json({}))
    const http = createHttpClient({
      getToken: async () => 'raw',
      authHeader: 'x-api-key',
      fetch: f.fetch,
    })
    await http.get('https://x.dev/a')
    expect(f.calls[0]!.headers.get('x-api-key')).toBe('raw')
    expect(f.calls[0]!.headers.get('authorization')).toBeNull()
  })

  it('refreshes once on 401 and retries with the new token', async () => {
    let token = 'old'
    const refresh = vi.fn(async () => {
      token = 'new'
      return true
    })
    const f = fake((req) =>
      req.headers.get('authorization') === 'Bearer new'
        ? Response.json({ ok: 1 })
        : new Response(null, { status: 401 }),
    )
    const http = createHttpClient({ getToken: () => token, refresh, fetch: f.fetch, retry: 0 })
    expect(await http.get('https://x.dev/me').json()).toEqual({ ok: 1 })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('shares one refresh between concurrent 401s', async () => {
    let token = 'old'
    let resolveRefresh!: (v: boolean) => void
    const refresh = vi.fn(
      () =>
        new Promise<boolean>((r) => {
          resolveRefresh = (v) => {
            token = 'new'
            r(v)
          }
        }),
    )
    const f = fake((req) =>
      req.headers.get('authorization') === 'Bearer new'
        ? Response.json({ ok: 1 })
        : new Response(null, { status: 401 }),
    )
    const http = createHttpClient({ getToken: () => token, refresh, fetch: f.fetch, retry: 0 })
    const all = Promise.all([
      http.get('https://x.dev/a').json(),
      http.get('https://x.dev/b').json(),
    ])
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 10))
    resolveRefresh(true)
    expect(await all).toEqual([{ ok: 1 }, { ok: 1 }])
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('reports unrecoverable 401s as UNAUTHORIZED', async () => {
    const onUnauthorized = vi.fn()
    const f = fake(() => Response.json({ message: 'expired' }, { status: 401 }))
    const http = createHttpClient({
      refresh: async () => false,
      onUnauthorized,
      fetch: f.fetch,
      retry: 0,
    })
    const error = await http.get('https://x.dev/me').catch((e) => e)
    expect(error).toBeInstanceOf(KitrError)
    expect(error).toMatchObject({ code: 'UNAUTHORIZED', message: 'expired' })
    expect(onUnauthorized).toHaveBeenCalledWith(error)
  })

  it('normalises every failure to a KitrError', async () => {
    const f = fake(() =>
      Response.json(KitrError.validation({ email: ['taken'] }).toJSON(), { status: 422 }),
    )
    const http = createHttpClient({ fetch: f.fetch, retry: 0 })
    await expect(http.post('https://x.dev/u', { json: {} })).rejects.toMatchObject({
      code: 'VALIDATION',
      fieldErrors: { email: ['taken'] },
    })
  })

  it('retries idempotent requests but never POST', async () => {
    const f = fake(() => new Response('busy', { status: 503 }))
    const http = createHttpClient({ fetch: f.fetch, retry: { limit: 2, backoffLimit: 1 } })
    await expect(http.post('https://x.dev/a')).rejects.toMatchObject({ code: 'UNAVAILABLE' })
    expect(f.calls).toHaveLength(1)
  })
})

describe('normaliseHttpError', () => {
  const errorFor = async (
    body: BodyInit | null,
    status: number,
    contentType = 'application/json',
  ) => {
    const f = fake(() => new Response(body, { status, headers: { 'content-type': contentType } }))
    const http = createHttpClient({ fetch: f.fetch, retry: 0, hooks: { beforeError: [] } })
    return http.get('https://x.dev').catch((e) => e)
  }

  it('reads { error: { message } } and { error: "..." }', async () => {
    expect((await errorFor(JSON.stringify({ error: { message: 'nested' } }), 400)).message).toBe(
      'nested',
    )
    expect((await errorFor(JSON.stringify({ error: 'flat' }), 409)).message).toBe('flat')
  })

  it('maps Adonis/VineJS style errors arrays to fieldErrors', async () => {
    const e = await errorFor(
      JSON.stringify({
        errors: [
          { field: 'email', message: 'bad' },
          { path: 'a.b', message: 'x' },
          { message: 'root' },
        ],
      }),
      422,
    )
    expect(e.fieldErrors).toEqual({ email: ['bad'], 'a.b': ['x'], _root: ['root'] })
    expect(e.status).toBe(422)
  })

  it('survives non-JSON bodies', async () => {
    const e = await errorFor('<h1>Bad gateway</h1>', 502, 'text/html')
    expect(e).toMatchObject({ code: 'INTERNAL', status: 502 })
  })

  it('passes other errors through toKitrError', async () => {
    expect((await normaliseHttpError(new TypeError('fetch failed'))).code).toBe('NETWORK')
  })
})

describe('contracts', () => {
  it('httpQuery builds paths and search params and validates the response', async () => {
    const f = fake(() => Response.json([{ id: 1 }]))
    const http = createHttpClient({ baseUrl: 'https://api.dev', fetch: f.fetch })
    const list = httpQuery<{ team: string; q?: string }, { id: number }[]>(http, {
      path: (i) => `teams/${i.team}/members`,
      key: (i) => ['members', i],
      searchParams: (i) => ({ q: i.q, limit: 10 }),
      schema: schemaFrom((v: unknown) => v as { id: number }[]),
      staleTime: 5,
    })
    expect(list.source).toBe('http')
    expect(list.staleTime).toBe(5)
    expect(await list.fetch({ team: 'core' }, {})).toEqual([{ id: 1 }])
    expect(f.calls[0]!.url).toBe('https://api.dev/teams/core/members?limit=10')
  })

  it('httpQuery rejects responses that fail the schema', async () => {
    const f = fake(() => Response.json({ wrong: true }))
    const http = createHttpClient({ fetch: f.fetch })
    const q = httpQuery(http, {
      path: 'https://x.dev/a',
      key: () => ['a'],
      schema: schemaFrom(() => ({ issues: [{ message: 'shape changed' }] })),
    })
    await expect(q.fetch(undefined, {})).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('httpMutation sends the input as JSON by default and handles 204', async () => {
    const f = fake((r) =>
      r.method === 'DELETE' ? new Response(null, { status: 204 }) : Response.json({ id: 1 }),
    )
    const http = createHttpClient({ baseUrl: 'https://api.dev', fetch: f.fetch })
    const create = httpMutation<{ name: string }, { id: number }>(http, {
      path: 'projects',
      effects: { invalidate: [['projects']] },
    })
    expect(await create.mutate({ name: 'A' })).toEqual({ id: 1 })
    expect(await f.calls[0]!.json()).toEqual({ name: 'A' })
    expect(create.effects).toEqual({ invalidate: [['projects']] })

    const remove = httpMutation<{ id: number }, void>(http, {
      method: 'delete',
      path: (i) => `projects/${i.id}`,
    })
    expect(await remove.mutate({ id: 3 })).toBeUndefined()
    expect(f.calls[1]!.url).toBe('https://api.dev/projects/3')
    expect(f.calls[1]!.body).toBeNull()

    const patch = httpMutation<{ id: number; name: string }, unknown>(http, {
      method: 'patch',
      path: (i) => `projects/${i.id}`,
      body: (i) => ({ name: i.name }),
    })
    await patch.mutate({ id: 1, name: 'B' })
    expect(await f.calls[2]!.json()).toEqual({ name: 'B' })
  })
})

describe('httpProvider', () => {
  it('binds a client from config/http.ts', async () => {
    const f = fake(() => Response.json({ ok: true }))
    const app = createApp({
      providers: [httpProvider],
      config: { http: { baseUrl: 'https://api.dev', fetch: f.fetch } },
    })
    await app.boot()
    expect(await app.container.use('http').get('ping').json()).toEqual({ ok: true })
  })

  it('logs requests to devtools with a level from the status', async () => {
    const logs: unknown[][] = []
    const f = fake((r) =>
      r.url.endsWith('/bad') ? new Response('x', { status: 404 }) : Response.json({}),
    )
    const app = createApp({
      providers: [httpProvider],
      config: { http: { baseUrl: 'https://api.dev', fetch: f.fetch, retry: 0 } },
    })
    app.container.value('devtools', { log: (...a: unknown[]) => logs.push(a) } as any)
    await app.boot()
    const http = app.container.use('http')
    await http.get('ok')
    await http.get('bad').catch(() => {})
    expect(logs.map((l) => [l[0], (l[1] as string).replace(/\(\d+ms\)/, '(ms)'), l[3]])).toEqual([
      ['http', 'GET /ok → 200 (ms)', 'info'],
      ['http', 'GET /bad → 404 (ms)', 'warn'],
    ])
  })
})

describe('ky v2 failures', () => {
  // Regression: ky v2 throws TimeoutError and NetworkError, which became INTERNAL 500.
  it('maps timeouts and network failures to TIMEOUT and NETWORK', async () => {
    const hang = createHttpClient({
      retry: 0,
      timeout: 20,
      fetch: (_input, init) =>
        new Promise((_resolve, reject) =>
          (init as RequestInit | undefined)?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          ),
        ),
    })
    await expect(hang.get('http://api.test/x').json()).rejects.toMatchObject({ code: 'TIMEOUT' })
    const down = createHttpClient({
      retry: 0,
      fetch: () => Promise.reject(new TypeError('fetch failed')),
    })
    await expect(down.get('http://api.test/x').json()).rejects.toMatchObject({ code: 'NETWORK' })
  })
})

describe('http provider on the server', () => {
  // Regression: one client for the whole process, so getToken could not tell requests apart.
  it('builds a client per request and gives getToken that request', async () => {
    const seen: string[] = []
    const fetch = vi.fn(async (input: Request | URL | string, init?: RequestInit) => {
      const req = input instanceof Request ? input : new Request(input, init)
      seen.push(req.headers.get('authorization') ?? '')
      return Response.json({ ok: true })
    })
    const app = createApp({
      environment: 'server',
      providers: [httpProvider],
      config: {
        http: { fetch, retry: 0, getToken: (c) => (c.has('user') ? c.use('user' as never) : null) },
      },
    })
    await app.boot()
    const a = app.fork()
    a.container.value('user' as never, 'token-a' as never)
    const b = app.fork()
    b.container.value('user' as never, 'token-b' as never)
    expect(a.container.use('http')).not.toBe(b.container.use('http'))
    await a.container.use('http').get('http://api.test/me').json()
    await b.container.use('http').get('http://api.test/me').json()
    expect(seen).toEqual(['Bearer token-a', 'Bearer token-b'])
  })
})
