import type { StandardSchemaV1 } from '@kitr/core'
import { describe, expectTypeOf, it } from 'vitest'
import { defineRoutes, type HttpContext, type PathParams } from '../src'
import { createApiClient } from '../src/client'

declare const CreateProject: StandardSchemaV1<unknown, { name: string; public?: boolean }>
declare const ListQuery: StandardSchemaV1<unknown, { page: number; q?: string }>

interface Project {
  id: string
  name: string
}

class ProjectsController {
  static validation = { store: { body: CreateProject } }
  async index(): Promise<Project[]> {
    return []
  }
  async show(ctx: HttpContext<{ id: string }>): Promise<Project> {
    return { id: ctx.params.id, name: '' }
  }
  async store(ctx: HttpContext<{}, {}, { name: string }>): Promise<Project> {
    return { id: '1', name: ctx.body.name }
  }
  async destroy(): Promise<void> {}
}

const routes = defineRoutes((r) =>
  r
    .get('/health', () => ({ ok: true as const }), { name: 'health' })
    .get('/search', (ctx) => ctx.query, { name: 'search', validate: { query: ListQuery } })
    .group({ prefix: '/api' }, (api) =>
      api
        .resource('projects', ProjectsController)
        .get(
          '/projects/:id/tasks/:taskId',
          (ctx) => ({ project: ctx.params.id, task: ctx.params.taskId }),
          { name: 'tasks.show' },
        ),
    ),
)
type Routes = typeof routes.$types
const api = createApiClient<Routes>({ baseUrl: '' })

describe('api route types', () => {
  it('extracts path params', () => {
    expectTypeOf<PathParams<'/a/:id/b/:slug'>>().toEqualTypeOf<{ id: string; slug: string }>()
    expectTypeOf<PathParams<'/plain'>>().toEqualTypeOf<{}>()
  })

  it('names routes from options and resources', () => {
    expectTypeOf<keyof Routes>().toEqualTypeOf<
      | 'health'
      | 'search'
      | 'projects.index'
      | 'projects.store'
      | 'projects.show'
      | 'projects.destroy'
      | 'tasks.show'
    >()
  })

  it('only registers resource actions the controller defines', () => {
    expectTypeOf<Routes>().not.toHaveProperty('projects.update')
  })

  it('carries handler and controller outputs to the client', () => {
    expectTypeOf(api.health).returns.resolves.toEqualTypeOf<{ ok: true }>()
    expectTypeOf(api.projects.index).returns.resolves.toEqualTypeOf<Project[]>()
    expectTypeOf(api.projects.show).returns.resolves.toEqualTypeOf<Project>()
    expectTypeOf(api.projects.destroy).returns.resolves.toEqualTypeOf<void>()
    expectTypeOf(api.tasks.show).returns.resolves.toEqualTypeOf<{ project: string; task: string }>()
  })

  it('requires params and validated bodies, optional input when nothing is needed', () => {
    api.health()
    api.projects.index()
    api.projects.show({ params: { id: '1' } })
    api.tasks.show({ params: { id: '1', taskId: '2' } })
    api.projects.store({ body: { name: 'x' } })
    // @ts-expect-error params are required
    api.projects.show()
    // @ts-expect-error a missing param
    api.tasks.show({ params: { id: '1' } })
    // @ts-expect-error the body is validated by the controller's schema
    api.projects.store({ body: { title: 'x' } })
  })

  it('types validated query input as partial', () => {
    api.search({ query: { page: 2 } })
    api.search()
    // @ts-expect-error page is a number
    api.search({ query: { page: 'two' } })
    expectTypeOf(api.search).returns.resolves.toEqualTypeOf<{ page: number; q?: string }>()
  })

  it('exposes method and path, and router.url only takes known names', () => {
    expectTypeOf(api.projects.show.method).toEqualTypeOf<'GET'>()
    routes.url('projects.show', { id: 1 })
    // @ts-expect-error unknown route name
    routes.url('projects.nope')
  })
})

describe('handler context', () => {
  it('types ctx.params from the path and ctx.query/body from validators', () => {
    defineRoutes((r) =>
      r
        .get('/teams/:team/members/:member', (ctx) => {
          expectTypeOf(ctx.params).toEqualTypeOf<{ team: string; member: string }>()
          return null
        })
        .post(
          '/projects',
          (ctx) => {
            expectTypeOf(ctx.body).toEqualTypeOf<{ name: string; public?: boolean }>()
            return null
          },
          { validate: { body: CreateProject } },
        )
        .get(
          '/list',
          (ctx) => {
            expectTypeOf(ctx.query).toEqualTypeOf<{ page: number; q?: string }>()
            return null
          },
          { validate: { query: ListQuery } },
        ),
    )
  })
})

describe('group names', () => {
  const admin = defineRoutes((r) =>
    r.group({ prefix: '/admin', as: 'admin' }, (g) =>
      g.get('/users', () => [] as string[], { name: 'users.index' }),
    ),
  )
  type AdminRoutes = typeof admin.$types

  it('prefixes route names with `as`, like the runtime', () => {
    expectTypeOf<keyof AdminRoutes>().toEqualTypeOf<'admin.users.index'>()
    expectTypeOf(admin.routes[0]!.name).toBeString()
  })

  it('nests three-level names in the client', () => {
    const client = createApiClient<AdminRoutes>({ baseUrl: '' })
    expectTypeOf(client.admin.users.index).returns.resolves.toEqualTypeOf<string[]>()
  })

  it('types the prefixed path, including nested and string-prefix groups', () => {
    expectTypeOf<AdminRoutes['admin.users.index']['path']>().toEqualTypeOf<'/admin/users'>()
    const nested = defineRoutes((r) =>
      r.group('/api/', (api) =>
        api.group({ prefix: '/v1', as: 'v1' }, (v1) => v1.get('/me', () => 1, { name: 'me' })),
      ),
    )
    type N = typeof nested.$types
    expectTypeOf<keyof N>().toEqualTypeOf<'v1.me'>()
    expectTypeOf<N['v1.me']['path']>().toEqualTypeOf<'/api/v1/me'>()
    expectTypeOf(nested.routes[0]!.path).toBeString()
  })
})
