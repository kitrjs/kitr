import { createApp, defineRoutes } from '@kitr/core'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createKitrRouter, createMemoryHistory, createRouter, Outlet, RouterProvider } from '../src'
import { definePage, pages } from '../src/routes'

function Shell() {
  return (
    <div>
      <h1>shell</h1>
      <Outlet />
    </div>
  )
}

const routes = defineRoutes([pages], (r) =>
  r
    .root({ component: Shell })
    .page('/', { component: () => <p>home</p> })
    .page('/about', { lazy: () => import('./fixtures/page') })
    .group('/projects', (g) =>
      g.page('/', { component: () => <p>projects index</p> }).page('/$id', {
        loader: ({ params }) => ({ id: params.id }),
        component: function Project() {
          const data = route.useLoaderData()
          return <p>project {data.id}</p>
        },
      }),
    )
    .layout('_app', { beforeLoad: () => ({ user: 'u1' }) }, (app) =>
      app.page('/dashboard', {
        loader: ({ context }) => ({ user: context.user }),
        lazy: () =>
          Promise.resolve(
            definePage({
              component: function Dashboard() {
                const data = route.useLoaderData()
                return <p>dashboard of {data.user}</p>
              },
            }),
          ),
        presentation: 'cover',
        keepAlive: true,
        platforms: ['web'],
      }),
    )
    .group('/admin', () => {}),
)
// `getRouteApi` would do here; the route object keeps the test close to what a page file sees.
const route = { useLoaderData: () => (globalThis as any).__kitrLoaderData() }

async function mount(path: string, extra: Record<string, unknown> = {}) {
  const app = createApp()
  await app.boot()
  const router = createKitrRouter({
    routes,
    app,
    history: createMemoryHistory({ initialEntries: [path] }),
    ...extra,
  })
  ;(globalThis as any).__kitrLoaderData = () => {
    const match = router.state.matches.at(-1)!
    return match.loaderData
  }
  await act(async () => {
    render(<RouterProvider router={router} />)
    await router.load()
  })
  return router
}

describe('pages extension', () => {
  it('records pages, groups and layouts as entries with full paths', () => {
    expect(routes.toJSON()).toMatchObject([
      { kind: 'page-root', path: '/', name: '~root' },
      { kind: 'page', path: '/', name: 'page /' },
      { kind: 'page', path: '/about', name: 'page /about' },
      { kind: 'page-group', path: '/projects', name: 'group /projects' },
      { kind: 'page', path: '/projects', name: 'page /projects' },
      { kind: 'page', path: '/projects/$id', name: 'page /projects/$id' },
      { kind: 'page-layout', path: '/', name: 'layout /_app' },
      { kind: 'page', path: '/dashboard', name: 'page /dashboard' },
      { kind: 'page-group', path: '/admin', name: 'group /admin' },
    ])
  })

  it('compiles to a TanStack tree with the same ids file routes would get', () => {
    const ids = collectIds(routes.compile('tanstack', {}).pages as any)
    expect(ids.sort()).toEqual(
      [
        '__root__',
        '/',
        '/about',
        '/projects',
        '/projects/',
        '/projects/$id',
        '/_app',
        '/_app/dashboard',
      ].sort(),
    )
  })

  it('renders pages inside the root, with params and loader data through groups', async () => {
    await mount('/projects/42')
    expect(screen.getByText('shell')).toBeTruthy()
    expect(screen.getByText('project 42')).toBeTruthy()
  })

  it('loads a lazy page module on first visit', async () => {
    await mount('/about')
    expect(await screen.findByText('fixture page')).toBeTruthy()
  })

  it('gives pages under a layout its beforeLoad context and keeps kitr options in staticData', async () => {
    const router = await mount('/dashboard')
    expect(await screen.findByText('dashboard of u1')).toBeTruthy()
    const match = router.state.matches.at(-1)!
    expect(match.staticData).toMatchObject({ presentation: 'cover', keepAlive: true })
  })

  it('drops pages that do not ship on the platform', () => {
    const web = routes.compile('tanstack', { platform: 'web' }).pages as any
    const ios = routes.compile('tanstack', { platform: 'ios' }).pages as any
    expect(collectIds(web)).toContain('/_app/dashboard')
    expect(collectIds(ios)).not.toContain('/_app/dashboard')
    // The layout had nothing left to render on ios, so it is gone too.
    expect(collectIds(ios)).not.toContain('/_app')
  })

  it('refuses a second root', () => {
    expect(() => defineRoutes([pages], (r) => r.root({}).root({}))).toThrow(
      /root\(\) may only be called once/,
    )
  })
})

/** Route ids as TanStack assigns them once a router processes the tree. */
function collectIds(tree: any): string[] {
  return Object.keys(createRouter({ routeTree: tree }).routesById)
}
