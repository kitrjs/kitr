import { KitrError, schemaFrom } from '@kitr/core'
import { silentLogger } from '@kitr/logger'
import { createServer } from '@kitr/server'
import { describe, expect, it } from 'vitest'
import {
  compose,
  cors,
  createRouter,
  defineRoutes,
  type HttpContext,
  joinPath,
  mountRoutes,
  requireJson,
  toOpenApi,
} from '../src'

const req = (path: string, init?: RequestInit) => new Request(`http://test${path}`, init)
const json = (method: string, body: unknown, headers: Record<string, string> = {}) => ({
  method,
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
})

function serve(router: ReturnType<typeof createRouter>) {
  const server = createServer({ logger: silentLogger, server: { healthPath: false } })
  mountRoutes(server, router)
  return server
}

describe('joinPath', () => {
  it.each([
    ['', '', '/'],
    ['/', '/', '/'],
    ['/api', '/', '/api'],
    ['/api/', '/users/', '/api/users'],
    ['api', 'users', '/api/users'],
    ['/api', '//x//y', '/api/x/y'],
  ])('joinPath(%j, %j) = %j', (a, b, out) => {
    expect(joinPath(a, b)).toBe(out)
  })
})

describe('Router', () => {
  class Users {
    static validation = { update: { body: schemaFrom((v: any) => v) } }
    index() {
      return []
    }
    show({ params }: HttpContext<{ user: string }>) {
      return { id: params.user }
    }
    update() {
      return { ok: true }
    }
  }

  it('names routes, nests groups with prefixes and `as`', () => {
    const r = defineRoutes((r) =>
      r
        .get('/a', () => 1)
        .group({ prefix: '/admin', as: 'admin' }, (g) =>
          g
            .get('/stats', () => 2, { name: 'stats' })
            .group('/deep', (d) => d.get('/x', () => 3, { name: 'x' })),
        ),
    )
    expect(r.routes.map((x) => [x.method, x.path, x.name])).toEqual([
      ['GET', '/a', 'GET /a'],
      ['GET', '/admin/stats', 'admin.stats'],
      ['GET', '/admin/deep/x', 'admin.x'],
    ])
  })

  it('resource registers only the actions the controller has, honouring only/except/param', () => {
    const all = createRouter().resource('users', Users, { param: 'user' })
    expect(all.routes.map((r) => `${r.method} ${r.path} ${r.name}`)).toEqual([
      'GET /users users.index',
      'GET /users/:user users.show',
      'PATCH /users/:user users.update',
    ])
    expect(createRouter().resource('users', Users, { only: ['index'] }).routes).toHaveLength(1)
    expect(
      createRouter()
        .resource('users', Users, { except: ['index', 'show'] })
        .routes.map((r) => r.name),
    ).toEqual(['users.update'])
  })

  it('lazy controllers register every action and 404 the missing ones at runtime', async () => {
    const router = createRouter().resource('users', async () => ({ default: Users }))
    expect(router.routes).toHaveLength(5)
    const server = serve(router)
    expect((await server.fetch(req('/users'))).status).toBe(200)
    const missing = await server.fetch(req('/users', json('POST', {})))
    expect(missing.status).toBe(404)
    expect((await missing.json()).message).toMatch(/Users\.store/)
  })

  it('use() applies middleware to routes registered afterwards only', async () => {
    const hits: string[] = []
    const router = createRouter()
      .get('/before', () => 'b')
      .use(async (ctx, next) => {
        hits.push(ctx.request.url.pathname)
        return next()
      })
      .get('/after', () => 'a')
    const server = serve(router)
    await server.fetch(req('/before'))
    await server.fetch(req('/after'))
    expect(hits).toEqual(['/after'])
  })

  it('any() answers every method', async () => {
    const server = serve(createRouter().any('/hook', (ctx) => ({ m: ctx.request.method })))
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
      expect(await (await server.fetch(req('/hook', { method }))).json()).toEqual({ m: method })
  })

  it('url() builds paths, encodes params and appends query', () => {
    const router = createRouter().get('/files/:dir/:name', () => null, { name: 'file' })
    expect(router.url('file' as never, { dir: 'a b', name: 'x/y' }, { v: 2, raw: true })).toBe(
      '/files/a%20b/x%2Fy?v=2&raw=true',
    )
    expect(() => router.url('file' as never, { dir: 'a' })).toThrow(/Missing param "name"/)
    expect(() => router.url('nope' as never)).toThrow(/No route named/)
  })

  it('toJSON describes routes and their validators', () => {
    const router = createRouter().post('/x', () => null, {
      name: 'x',
      validate: { body: schemaFrom((v) => v) },
      meta: { summary: 'Make x' },
    })
    expect(router.toJSON()).toEqual([
      {
        kind: 'http',
        method: 'POST',
        path: '/x',
        name: 'x',
        validates: { params: false, query: false, body: true },
        meta: { summary: 'Make x' },
      },
    ])
  })
})

describe('dispatch', () => {
  const int = schemaFrom((v: unknown) => {
    const n = Number(v)
    if (!Number.isInteger(n)) return { issues: [{ message: 'not an int' }] }
    return n
  })
  const pageQuery = schemaFrom((q: any) => {
    const page = Number(q?.page ?? 1)
    if (!Number.isInteger(page) || page < 1)
      return { issues: [{ message: 'bad page', path: ['page'] }] }
    return { page }
  })
  const idParams = schemaFrom((p: any) => {
    const id = Number(p.id)
    if (!Number.isInteger(id)) return { issues: [{ message: 'bad id', path: ['id'] }] }
    return { id }
  })
  const router = createRouter()
    .get('/items/:id', ({ params, query }) => ({ params, query }), {
      validate: { params: idParams, query: pageQuery },
    })
    .post('/items/:id', ({ body, params }) => ({ body, params }), {
      validate: {
        params: idParams,
        body: schemaFrom((b: any) =>
          b?.n ? { n: b.n } : { issues: [{ message: 'n required', path: ['n'] }] },
        ),
      },
    })
    .post('/raw', ({ body }) => ({ body }))
    .post('/text', async (ctx) => ({ raw: await ctx.request.raw() }))
    .get('/nothing', () => undefined)
    .get('/created', ({ response }) => {
      response.status(201).header('x-extra', '1')
      return { made: true }
    })
    .get('/redirect', ({ response }) => response.redirect('/elsewhere', 301))
    .get('/json', ({ response }) =>
      response.json({ a: 1 }, { status: 202, headers: { 'x-y': 'z' } }),
    )
    .get('/validate-on-demand', async (ctx) => ({ n: await ctx.validate(int, 'query') }))
    .get('/ip', (ctx) => ({ ip: ctx.request.ip() ?? null, qs: ctx.request.qs() }))
    .get('/locals', (ctx) => ({ hasRequestId: ctx.requestId.length > 0, locals: ctx.locals }))
  const server = serve(router)

  it('validates params and query and coerces them', async () => {
    const res = await server.fetch(req('/items/5?page=2'))
    expect(await res.json()).toEqual({ params: { id: 5 }, query: { page: 2 } })
  })

  it('collects every validation problem into one 422', async () => {
    const res = await server.fetch(req('/items/abc?page=0'))
    expect(res.status).toBe(422)
    expect((await res.json()).fieldErrors).toEqual({ id: ['bad id'], page: ['bad page'] })
  })

  it('validates bodies and passes parsed values', async () => {
    const ok = await server.fetch(req('/items/1', json('POST', { n: 3, extra: true })))
    expect(await ok.json()).toEqual({ body: { n: 3 }, params: { id: 1 } })
    const bad = await server.fetch(req('/items/1', json('POST', {})))
    expect((await bad.json()).fieldErrors).toEqual({ n: ['n required'] })
  })

  it('gives unvalidated POST handlers the raw body', async () => {
    const res = await server.fetch(req('/raw', json('POST', { a: [1, 2] })))
    expect(await res.json()).toEqual({ body: { a: [1, 2] } })
  })

  it('turns malformed JSON into a 400, not a 500', async () => {
    const res = await server.fetch(
      req('/raw', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{oops',
      }),
    )
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('BAD_REQUEST')
  })

  it('returns 204 for empty results and keeps status and headers set by handlers', async () => {
    expect((await server.fetch(req('/nothing'))).status).toBe(204)
    const created = await server.fetch(req('/created'))
    expect(created.status).toBe(201)
    expect(created.headers.get('x-extra')).toBe('1')
  })

  it('response helpers redirect and send JSON', async () => {
    const r = await server.fetch(req('/redirect'))
    expect(r.status).toBe(301)
    expect(r.headers.get('location')).toBe('/elsewhere')
    const j = await server.fetch(req('/json'))
    expect(j.status).toBe(202)
    expect(j.headers.get('x-y')).toBe('z')
    expect(await j.json()).toEqual({ a: 1 })
  })

  it('ctx.validate checks any source on demand', async () => {
    const bad = await server.fetch(req('/validate-on-demand?x=1'))
    expect(bad.status).toBe(422)
  })

  it('exposes raw query and request context', async () => {
    expect(await (await server.fetch(req('/ip?tag=a&tag=b'))).json()).toEqual({
      ip: null,
      qs: { tag: ['a', 'b'] },
    })
    expect(await (await server.fetch(req('/locals'))).json()).toEqual({
      hasRequestId: true,
      locals: {},
    })
  })

  it('answers unknown routes with a kitr 404', async () => {
    const res = await server.fetch(req('/does-not-exist'))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('NOT_FOUND')
  })
})

describe('middleware', () => {
  it('compose runs in order and rejects double next()', async () => {
    const order: number[] = []
    const run = compose([
      async (_c, next) => {
        order.push(1)
        await next()
        order.push(4)
      },
      async (_c, next) => {
        order.push(2)
        await next()
        order.push(3)
      },
    ])
    await run({} as any, async () => order.push(99))
    expect(order).toEqual([1, 2, 99, 3, 4])
    const twice = compose([
      async (_c, next) => {
        await next()
        await next()
      },
    ])
    await expect(twice({} as any, async () => {})).rejects.toThrow(/more than once/)
  })

  it('compose lets middleware short-circuit', async () => {
    const run = compose([async () => 'stopped'])
    let reached = false
    expect(await run({} as any, async () => (reached = true))).toBe('stopped')
    expect(reached).toBe(false)
  })

  it('cors handles wildcard, allow-lists, credentials and preflight', async () => {
    const server = serve(
      createRouter()
        .group({ middleware: [cors({ origin: '*' })] }, (g) => g.any('/open', () => 'ok'))
        .group({ middleware: [cors()] }, (g) => g.any('/closed', () => 'ok'))
        .group(
          { middleware: [cors({ origin: ['https://a.dev'], credentials: true, maxAge: 5 })] },
          (g) => g.any('/list', () => 'ok'),
        )
        .group({ middleware: [cors({ origin: (o) => o.endsWith('.trusted.dev') })] }, (g) =>
          g.any('/fn', () => 'ok'),
        ),
    )
    const open = await server.fetch(req('/open', { headers: { origin: 'https://x.dev' } }))
    expect(open.headers.get('access-control-allow-origin')).toBe('*')
    expect(open.headers.get('access-control-allow-credentials')).toBeNull()

    // Regression: the default used to be '*', and with credentials it reflected any origin.
    const closed = await server.fetch(req('/closed', { headers: { origin: 'https://evil.dev' } }))
    expect(closed.headers.get('access-control-allow-origin')).toBeNull()
    expect(() => cors({ origin: '*', credentials: true })).toThrow(/list the origins instead/)

    const allowed = await server.fetch(req('/list', { headers: { origin: 'https://a.dev' } }))
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://a.dev')
    expect(allowed.headers.get('access-control-allow-credentials')).toBe('true')
    expect(allowed.headers.get('vary')).toBe('Origin')
    const denied = await server.fetch(req('/list', { headers: { origin: 'https://evil.dev' } }))
    expect(denied.headers.get('access-control-allow-origin')).toBeNull()

    const preflight = await server.fetch(
      req('/list', { method: 'OPTIONS', headers: { origin: 'https://a.dev' } }),
    )
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-max-age')).toBe('5')
    expect(preflight.headers.get('access-control-allow-methods')).toContain('PATCH')

    const fn = await server.fetch(req('/fn', { headers: { origin: 'https://app.trusted.dev' } }))
    expect(fn.headers.get('access-control-allow-origin')).toBe('https://app.trusted.dev')
  })

  it('requireJson rejects non-JSON bodies on writes only', async () => {
    const server = serve(
      createRouter().group({ middleware: [requireJson()] }, (g) => g.any('/j', () => 'ok')),
    )
    expect((await server.fetch(req('/j'))).status).toBe(200)
    expect((await server.fetch(req('/j', json('POST', {})))).status).toBe(200)
    const bad = await server.fetch(
      req('/j', { method: 'POST', body: 'x', headers: { 'content-type': 'text/plain' } }),
    )
    expect(bad.status).toBe(400)
  })

  it('errors from middleware become kitr errors', async () => {
    const server = serve(
      createRouter().get('/guarded', () => 'never', {
        middleware: [
          () => {
            throw KitrError.forbidden('nope')
          },
        ],
      }),
    )
    const res = await server.fetch(req('/guarded'))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ code: 'FORBIDDEN', message: 'nope', status: 403 })
  })
})

describe('toOpenApi', () => {
  it('emits path params, query params, bodies, tags and the error component', async () => {
    const body = schemaFrom((v) => v)
    const query = schemaFrom((v) => v)
    const router = defineRoutes((r) =>
      r
        .get('/projects/:id/tasks/:taskId', () => null, {
          name: 'tasks.show',
          meta: { deprecated: true },
        })
        .post('/projects', () => null, {
          name: 'projects.store',
          validate: { body, query },
          meta: { summary: 'Create', tags: ['custom'] },
        }),
    )
    const doc = await toOpenApi(router, {
      title: 'T',
      version: '1.0.0',
      servers: [{ url: 'https://api' }],
      schemaToJson: (s) =>
        s === query
          ? { type: 'object', properties: { draft: { type: 'boolean' } }, required: ['draft'] }
          : { type: 'object' },
    })
    expect(doc.openapi).toBe('3.1.0')
    expect(doc.info).toMatchObject({ title: 'T', version: '1.0.0' })
    const show = (doc.paths['/projects/{id}/tasks/{taskId}'] as any).get
    expect(show.parameters.map((p: any) => p.name)).toEqual(['id', 'taskId'])
    expect(show.tags).toEqual(['tasks'])
    expect(show.deprecated).toBe(true)
    const store = (doc.paths['/projects'] as any).post
    expect(store.tags).toEqual(['custom'])
    expect(store.requestBody.content['application/json'].schema).toEqual({ type: 'object' })
    expect(store.parameters).toEqual([
      { name: 'draft', in: 'query', required: true, schema: { type: 'boolean' } },
    ])
    expect(doc.components.schemas.KitrError.required).toEqual(['code', 'message', 'status'])
  })

  it('reads validators from controllers and skips schemas it cannot convert', async () => {
    class C {
      static validation = { store: { body: schemaFrom((v) => v) } }
      store() {}
    }
    const doc = await toOpenApi(createRouter().resource('c', C))
    expect((doc.paths['/c'] as any).post.requestBody).toBeUndefined()
    expect((doc.paths['/c'] as any).post.tags).toEqual(['c'])
  })
})

describe('group runtime matches the types', () => {
  it('prefixes names and paths through nested groups', async () => {
    const { defineRoutes } = await import('../src')
    const r = defineRoutes((r) =>
      r.group('/api/', (api) =>
        api.group({ prefix: '/v1', as: 'v1' }, (v1) => v1.get('/me', () => 1, { name: 'me' })),
      ),
    )
    expect(r.routes.map((x) => [x.name, x.path])).toEqual([['v1.me', '/api/v1/me']])
  })
})

describe('cors preflight', () => {
  it('answers OPTIONS for routes behind cors() without an explicit OPTIONS route', async () => {
    const { defineRoutes, cors, mountRoutes } = await import('../src')
    const routes = defineRoutes((r) =>
      r
        .group({ prefix: '/api', middleware: [cors({ origin: 'https://app.dev' })] }, (api) =>
          api.post('/items', () => ({ ok: true }), { name: 'items.store' }),
        )
        .get('/open', () => 'x', { name: 'open' }),
    )
    const server = createServer({ logger: silentLogger })
    mountRoutes(server, routes)
    const pre = await server.fetch(
      new Request('http://x/api/items', {
        method: 'OPTIONS',
        headers: { origin: 'https://app.dev', 'access-control-request-method': 'POST' },
      }),
    )
    expect(pre.status).toBe(204)
    expect(pre.headers.get('access-control-allow-origin')).toBe('https://app.dev')
    expect(pre.headers.get('access-control-allow-methods')).toContain('POST')
    const real = await server.fetch(
      new Request('http://x/api/items', { method: 'POST', headers: { origin: 'https://app.dev' } }),
    )
    expect(real.status).toBe(200)
    expect(real.headers.get('access-control-allow-origin')).toBe('https://app.dev')
    // Routes without cors() still 404 on OPTIONS.
    expect((await server.fetch(new Request('http://x/open', { method: 'OPTIONS' }))).status).toBe(
      404,
    )
  })
})
