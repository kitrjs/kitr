import { KitrError } from '@kitr/core'
import { describe, expect, it, vi } from 'vitest'
import { createApiClient, registerRoutes } from '../src/client'

function fakeFetch(handler: (req: Request) => Response | Promise<Response>) {
  const calls: Request[] = []
  const fetch = vi.fn(async (req: Request) => {
    calls.push(req)
    return handler(req)
  })
  return { fetch, calls }
}

const table = [
  { name: 'projects.index', method: 'GET', path: '/projects' },
  { name: 'projects.show', method: 'GET', path: '/projects/:id' },
  { name: 'projects.store', method: 'POST', path: '/projects' },
  { name: 'projects.destroy', method: 'DELETE', path: '/projects/:id' },
  { name: 'admin.users.index', method: 'GET', path: '/admin/users' },
  { name: 'health', method: 'GET', path: '/health' },
]

function client(handler: (req: Request) => Response | Promise<Response>, extra = {}) {
  const f = fakeFetch(handler)
  const api: any = createApiClient({ baseUrl: 'https://api.dev/', fetch: f.fetch, ...extra })
  registerRoutes(api, table)
  return { api, ...f }
}

describe('createApiClient', () => {
  it('treats a name as a group once routes registered after first access add its children', async () => {
    const { fetch, calls } = fakeFetch(() => Response.json({}))
    const api: any = createApiClient({ baseUrl: 'https://api.dev', fetch })
    registerRoutes(api, [{ name: 'a.b', method: 'GET', path: '/a/b' }])
    expect(typeof api.a.b).toBe('function')
    registerRoutes(api, [
      { name: 'a.b.c', method: 'GET', path: '/a/b/c' },
      { name: 'x.y.z', method: 'GET', path: '/x/y/z' },
    ])
    await api.a.b.c()
    await api.x.y.z()
    expect(calls.map((c) => new URL(c.url).pathname)).toEqual(['/a/b/c', '/x/y/z'])
  })

  it('resolves nested names from the route table', async () => {
    const { api, calls } = client(() => Response.json({ ok: true }))
    await api.admin.users.index()
    await api.health()
    expect(calls.map((c) => c.url)).toEqual([
      'https://api.dev/admin/users',
      'https://api.dev/health',
    ])
  })

  it('sends JSON bodies, bearer tokens, custom headers and accepts JSON', async () => {
    const { api, calls } = client(() => Response.json({ id: 1 }), {
      getToken: async () => 'tok',
      headers: () => ({ 'x-tenant': 't1' }),
    })
    await api.projects.store({ body: { name: 'A' } })
    const sent = calls[0]!
    expect(sent.method).toBe('POST')
    expect(sent.headers.get('authorization')).toBe('Bearer tok')
    expect(sent.headers.get('x-tenant')).toBe('t1')
    expect(sent.headers.get('content-type')).toBe('application/json')
    expect(sent.headers.get('accept')).toBe('application/json')
    expect(await sent.json()).toEqual({ name: 'A' })
  })

  it('never sends a body on GET and skips the auth header without a token', async () => {
    const { api, calls } = client(() => Response.json([]), { getToken: () => null })
    await api.projects.index({ body: { ignored: true } } as any)
    expect(calls[0]!.body).toBeNull()
    expect(calls[0]!.headers.get('authorization')).toBeNull()
  })

  it('encodes params and drops undefined query values', async () => {
    const { api, calls } = client(() => Response.json({}))
    await api.projects.show({
      params: { id: 'a/b c' },
      query: { q: 'x y', skip: undefined, n: 0, f: false },
    })
    expect(calls[0]!.url).toBe('https://api.dev/projects/a%2Fb%20c?q=x+y&n=0&f=false')
  })

  it('throws BAD_REQUEST when a path param is missing', () => {
    const { api } = client(() => Response.json({}))
    expect(() => api.projects.show.url({ params: {} })).toThrow(/Missing param "id"/)
  })

  it('returns undefined for 204 and plain text for non-JSON bodies', async () => {
    const { api } = client((r) =>
      r.method === 'DELETE' ? new Response(null, { status: 204 }) : new Response('hi'),
    )
    expect(await api.projects.destroy({ params: { id: 1 } })).toBeUndefined()
    expect(await api.health()).toBe('hi')
  })

  it('revives kitr error bodies with field errors', async () => {
    const { api } = client(() =>
      Response.json(KitrError.validation({ name: ['required'] }).toJSON(), { status: 422 }),
    )
    const error = await api.projects.store({ body: {} }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(KitrError)
    expect(error).toMatchObject({
      code: 'VALIDATION',
      status: 422,
      fieldErrors: { name: ['required'] },
    })
  })

  it('maps foreign error bodies by status and keeps their message', async () => {
    const { api } = client(() => Response.json({ message: 'Nope' }, { status: 403 }))
    await expect(api.health()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Nope',
      status: 403,
    })
    const { api: api2 } = client(() => new Response('<html>bad gateway</html>', { status: 502 }))
    await expect(api2.health()).rejects.toMatchObject({ code: 'INTERNAL', status: 502 })
  })

  it('maps fetch failures to NETWORK', async () => {
    const { api } = client(() => {
      throw new TypeError('fetch failed')
    })
    await expect(api.health()).rejects.toMatchObject({ code: 'NETWORK' })
  })

  it('exposes keys, urls, method/path and query/mutation contracts', async () => {
    const { api, calls } = client(() => Response.json({ id: 7 }))
    const show = api.projects.show
    expect(show.method).toBe('GET')
    expect(show.path).toBe('/projects/:id')
    expect(show.key({ params: { id: 7 }, query: { a: 1 } })).toEqual([
      'api',
      'projects.show',
      { id: 7 },
      { a: 1 },
    ])
    expect(show.key()).toEqual(['api', 'projects.show', {}, {}])
    const q = show.query()
    expect(q.source).toBe('api')
    const controller = new AbortController()
    expect(await q.fetch({ params: { id: 7 } }, { signal: controller.signal })).toEqual({ id: 7 })
    expect(calls[0]!.signal).toBeDefined()
    const effects = { invalidate: [['projects']] }
    const m = api.projects.store.mutation({ effects })
    expect(m.effects).toBe(effects)
    await m.mutate({ body: { name: 'x' } })
    expect(calls[1]!.method).toBe('POST')
  })

  it('caches endpoints so identity is stable', () => {
    const { api } = client(() => Response.json({}))
    expect(api.projects.show).toBe(api.projects.show)
  })

  it('works with "METHOD /path" names without a route table', async () => {
    const f = fakeFetch(() => Response.json({ ok: 1 }))
    const api: any = createApiClient({ baseUrl: 'http://x', fetch: f.fetch })
    expect(await api['GET /ping']()).toEqual({ ok: 1 })
    expect(f.calls[0]!.url).toBe('http://x/ping')
  })

  it('explains unknown route names', () => {
    const f = fakeFetch(() => Response.json({}))
    const api: any = createApiClient({ baseUrl: 'http://x', fetch: f.fetch })
    registerRoutes(api, table)
    expect(() => api.nope()).toThrow(/Unknown route "nope"/)
  })

  it('is not a thenable, so it can be returned from async functions', async () => {
    const { api } = client(() => Response.json({}))
    expect(api.then).toBeUndefined()
    const resolved = await (async () => api)()
    expect(resolved).toBe(api)
  })
})

describe('CSRF echo', () => {
  const withCookie = (cookie: string, run: () => Promise<void>) => async () => {
    vi.stubGlobal('document', { cookie })
    try {
      await run()
    } finally {
      vi.unstubAllGlobals()
    }
  }

  it(
    'copies the csrf cookie into x-csrf-token on writes only',
    withCookie('theme=dark; kitr-csrf=abc%2B123', async () => {
      const { api, calls } = client(() => Response.json({}))
      await api.projects.store({ body: { name: 'A' } })
      await api.projects.destroy({ params: { id: '1' } })
      await api.projects.index()
      expect(calls.map((c) => c.headers.get('x-csrf-token'))).toEqual(['abc+123', 'abc+123', null])
    }),
  )

  it(
    'uses the names it is given and can be turned off',
    withCookie('xsrf=t0', async () => {
      const custom = client(() => Response.json({}), { csrf: { cookie: 'xsrf', header: 'x-xsrf' } })
      await custom.api.projects.store({ body: {} })
      expect(custom.calls[0]!.headers.get('x-xsrf')).toBe('t0')
      const off = client(() => Response.json({}), { csrf: false })
      await off.api.projects.store({ body: {} })
      expect(off.calls[0]!.headers.get('x-csrf-token')).toBeNull()
    }),
  )

  it(
    'sends nothing before the cookie exists, or when it is malformed',
    withCookie('kitr-csrf=%E0%A4%A', async () => {
      const { api, calls } = client(() => Response.json({}))
      await api.projects.store({ body: {} })
      expect(calls[0]!.headers.get('x-csrf-token')).toBeNull()
      vi.stubGlobal('document', { cookie: 'other=1' })
      await api.projects.store({ body: {} })
      expect(calls[1]!.headers.get('x-csrf-token')).toBeNull()
    }),
  )

  it('does nothing on the server, where there is no document', async () => {
    const { api, calls } = client(() => Response.json({}))
    await api.projects.store({ body: {} })
    expect(calls[0]!.headers.get('x-csrf-token')).toBeNull()
  })
})
