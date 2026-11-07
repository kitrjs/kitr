import { KitrError, schemaFrom } from '@kitr/core'
import { createServer } from '@kitr/server'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  defineMiddleware,
  defineRoutes,
  type HttpContext,
  mountRoutes,
  rateLimit,
  toOpenApi,
} from '../src'
import { createApiClient, registerRoutes } from '../src/client'

interface Project {
  id: string
  name: string
}
const db = new Map<string, Project>([['1', { id: '1', name: 'Alpha' }]])

const createProject = schemaFrom((v: { name: string }) => {
  if (!v || typeof v.name !== 'string' || v.name.length < 2)
    return { issues: [{ message: 'Name too short', path: ['name'] }] }
  return { name: v.name }
})

class ProjectsController {
  static validation = { store: { body: createProject } }
  async index(): Promise<Project[]> {
    return [...db.values()]
  }
  async count() {
    return { count: db.size }
  }
  async show({ params }: HttpContext<{ id: string }>): Promise<Project> {
    const p = db.get(params.id)
    if (!p) throw KitrError.notFound('Project')
    return p
  }
  async store({ body, response }: HttpContext<{}, {}, { name: string }>): Promise<Project> {
    const project = { id: String(db.size + 1), name: body.name }
    db.set(project.id, project)
    response.status(201)
    return project
  }
  async destroy({ params }: HttpContext<{ id: string }>): Promise<void> {
    db.delete(params.id)
  }
}

const seen: string[] = []
const audit = defineMiddleware(async (ctx, next) => {
  seen.push(`${ctx.request.method} ${ctx.request.url.pathname}`)
  return next()
})

const routes = defineRoutes((r) =>
  r
    .group({ prefix: '/api', middleware: [audit] }, (api) =>
      api
        .resource('projects', ProjectsController)
        .get('/me', () => ({ id: 'u1' }), { name: 'me' })
        .get('/projects-count', [ProjectsController, 'count'], { name: 'projects.count' }),
    )
    .post('/echo', async ({ body }) => ({ echoed: body }), { name: 'echo' })
    .get('/limited', () => 'ok', {
      middleware: [rateLimit({ max: 2, windowMs: 60_000 })],
      name: 'limited',
    }),
)
type AppRoutes = typeof routes.$types

describe('api', () => {
  const server = createServer({ server: { healthPath: '/healthz' }, logger: silent() })
  mountRoutes(server, routes)
  const api = createApiClient<AppRoutes>({
    baseUrl: 'http://test',
    fetch: (req) => server.fetch(req),
  })
  registerRoutes(api, routes.toJSON())

  it('routes resources through controllers', async () => {
    const res = await server.fetch(new Request('http://test/api/projects'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: '1', name: 'Alpha' }])
    expect(seen).toContain('GET /api/projects')
  })

  it('returns kitr error shape for not found', async () => {
    const res = await server.fetch(new Request('http://test/api/projects/404'))
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'NOT_FOUND', status: 404 })
  })

  it('validates with the controller static validation', async () => {
    const res = await server.fetch(
      new Request('http://test/api/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'x' }),
      }),
    )
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({
      code: 'VALIDATION',
      fieldErrors: { name: ['Name too short'] },
    })
  })

  it('typed client calls, keys and errors', async () => {
    const created = await api.projects.store({ body: { name: 'Beta' } })
    expect(created).toEqual({ id: '2', name: 'Beta' })
    expectTypeOf(created).toEqualTypeOf<Project>()
    const one = await api.projects.show({ params: { id: '2' } })
    expect(one.name).toBe('Beta')
    expect(api.projects.show.key({ params: { id: '2' } })).toEqual([
      'api',
      'projects.show',
      { id: '2' },
      {},
    ])
    expect(api.projects.show.url({ params: { id: '2' } })).toBe('http://test/api/projects/2')
    await expect(api.projects.show({ params: { id: 'nope' } })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    const me = await api.me()
    expectTypeOf(me).toEqualTypeOf<{ id: string }>()
    expect(me).toEqual({ id: 'u1' })
    const count = await api.projects.count()
    expectTypeOf(count).toEqualTypeOf<{ count: number }>()
    expect(count.count).toBeGreaterThan(0)
    expect(await api.echo({ body: { a: 1 } })).toEqual({ echoed: { a: 1 } })
    await api.projects.destroy({ params: { id: '2' } })
    expect(db.has('2')).toBe(false)
  })

  it('rate limits', async () => {
    await api.limited()
    await api.limited()
    await expect(api.limited()).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429 })
  })

  it('health and request id', async () => {
    const res = await server.fetch(new Request('http://test/healthz'))
    expect(await res.json()).toEqual({ ok: true })
    expect(res.headers.get('x-request-id')).toBeTruthy()
  })

  it('emits openapi', async () => {
    const doc = await toOpenApi(routes, { title: 'Test' })
    expect(Object.keys(doc.paths)).toContain('/api/projects/{id}')
    expect((doc.paths['/api/projects/{id}'] as any).get.operationId).toBe('projects.show')
  })
})

function silent() {
  const noop = () => {}
  const l: any = {
    level: 'silent',
    trace: noop,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    fatal: noop,
    time: async (_: string, fn: () => any) => fn(),
  }
  l.child = () => l
  return l
}
