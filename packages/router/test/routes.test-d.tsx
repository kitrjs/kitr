import { createApp, defineRoutes } from '@kitr/core'
import { describe, expectTypeOf, it } from 'vitest'
import { createKitrRouter, type RouteIds, type RouteTreeOf } from '../src'
import { pages } from '../src/routes'

declare const Page: () => null

const routes = defineRoutes([pages], (r) =>
  r
    .root({ component: Page })
    .page('/', { component: Page })
    .page('/about', { lazy: () => import('./fixtures/page') })
    .group('/projects', (g) =>
      g.page('/', { loader: () => ({ count: 1 }), component: Page }).page('/$id', {
        loader: ({ params }) => ({ id: params.id, name: 'x' }),
        component: Page,
      }),
    )
    .layout('_app', { beforeLoad: () => ({ user: { id: 'u1' } }) }, (app) =>
      app.page('/dashboard', {
        loader: ({ context }) => ({ user: context.user.id }),
        component: Page,
        presentation: 'cover',
        platforms: ['web'],
      }),
    ),
)

type R = typeof routes.$types

describe('pages extension types', () => {
  it('names every page by its full path', () => {
    expectTypeOf<keyof R>().toEqualTypeOf<
      | '~root'
      | 'page /'
      | 'page /about'
      | 'group /projects'
      | 'page /projects'
      | 'page /projects/$id'
      | 'layout /_app'
      | 'page /dashboard'
    >()
  })

  it('types params and loader data from the path and loader, through groups', () => {
    type Project = R['page /projects/$id']['route']['types']
    expectTypeOf<Project['params']>().toMatchObjectType<{ id: string }>()
    expectTypeOf<keyof Project['params']>().toEqualTypeOf<'id'>()
    expectTypeOf<Project['loaderData']>().toEqualTypeOf<{ id: string; name: string }>()
    expectTypeOf<Project['fullPath']>().toEqualTypeOf<'/projects/$id'>()
    expectTypeOf<R['page /projects']['route']['types']['fullPath']>().toEqualTypeOf<'/projects/'>()
  })

  it('passes the layout beforeLoad context to pages inside it', () => {
    type Dashboard = R['page /dashboard']['route']['types']
    expectTypeOf<Dashboard['loaderData']>().toEqualTypeOf<{ user: string }>()
    expectTypeOf<Dashboard['fullPath']>().toEqualTypeOf<'/dashboard'>()
  })

  it('takes a component or { lazy } for the root fallbacks', () => {
    defineRoutes([pages], (r) =>
      r.root({
        component: Page,
        notFoundComponent: { lazy: () => import('./fixtures/not-found') },
        errorComponent: Page,
        pendingComponent: { lazy: () => import('./fixtures/page') },
      }),
    )
    defineRoutes([pages], (r) =>
      // @ts-expect-error lazy must load a module with a default export
      r.root({ notFoundComponent: { lazy: () => Promise.resolve({ NotFound: Page }) } }),
    )
  })

  it('rejects kitr options that are not known', () => {
    defineRoutes([pages], (r) =>
      // @ts-expect-error presentation is one of the four modes
      r.page('/x', { component: Page, presentation: 'sideways' }),
    )
  })

  it('compiles to a TanStack tree whose route ids are the page paths', () => {
    type Tree = RouteTreeOf<R>
    expectTypeOf<RouteIds<Tree>>().toEqualTypeOf<
      | '__root__'
      | '/'
      | '/about'
      | '/projects'
      | '/projects/'
      | '/projects/$id'
      | '/_app'
      | '/_app/dashboard'
    >()
  })

  it('builds the router from the table with that tree', () => {
    const router = createKitrRouter({ routes, app: createApp() })
    expectTypeOf(router.routeTree).toEqualTypeOf<RouteTreeOf<R>>()
    expectTypeOf<RouteIds<typeof router.routeTree>>().toEqualTypeOf<RouteIds<RouteTreeOf<R>>>()
    // Register it as TanStack asks (`interface Register { router: typeof router }`) and every
    // `<Link to>` and `navigate` is checked against these ids.
  })

  it('is absent from a table that did not install it', () => {
    const bare = defineRoutes([], (r) => r)
    expectTypeOf(bare).not.toHaveProperty('page')
    expectTypeOf(bare).not.toHaveProperty('layout')
    expectTypeOf(bare).toHaveProperty('group')
  })
})
