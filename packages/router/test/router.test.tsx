import { createApp, defineProvider, KitrError } from '@kitr/core'
import { QueryClient } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  createKitrRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  type KitrRouterContext,
  Outlet,
  RouterProvider,
} from '../src'

function build(throwOn?: string) {
  const root = createRootRouteWithContext<KitrRouterContext>()({ component: () => <Outlet /> })
  const home = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: function Home() {
      const ctx = home.useRouteContext()
      return (
        <p>
          home {ctx.app ? 'with app' : 'no app'} {ctx.queryClient ? 'with client' : ''}
        </p>
      )
    },
  })
  const boom = createRoute({
    getParentRoute: () => root,
    path: '/boom',
    loader: () => {
      throw throwOn === 'forbidden'
        ? KitrError.forbidden()
        : new KitrError('CONFLICT', 'Already archived')
    },
    component: () => <p>never</p>,
  })
  return root.addChildren([home, boom])
}

async function mount(path: string, throwOn?: string) {
  const app = createApp()
  const queryClient = new QueryClient()
  app.container.value('queryClient', queryClient)
  await app.boot()
  const router = createKitrRouter({
    routeTree: build(throwOn),
    app,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { extra: true },
  })
  await act(async () => {
    render(<RouterProvider router={router} />)
    await router.load()
  })
  return { app, router, queryClient }
}

describe('createKitrRouter', () => {
  it('puts app and the container queryClient in context and binds itself', async () => {
    const { app, router, queryClient } = await mount('/')
    expect(await screen.findByText('home with app with client')).toBeTruthy()
    expect(app.container.use('router')).toBe(router)
    expect((router.options.context as any).queryClient).toBe(queryClient)
    expect((router.options.context as any).extra).toBe(true)
    expect(router.options.defaultPreload).toBe('intent')
  })

  // Regression: `ssr` in config/seo.ts was read by nothing.
  it('applies ssr from config/seo.ts to routes that set none', () => {
    const root = createRootRouteWithContext<KitrRouterContext>()({ component: () => <Outlet /> })
    const plain = createRoute({ getParentRoute: () => root, path: '/', component: () => null })
    const own = createRoute({
      getParentRoute: () => root,
      path: '/own',
      ssr: true,
      component: () => null,
    })
    const app = createApp({ config: { seo: { ssr: 'data-only' } } })
    createKitrRouter({ routeTree: root.addChildren([plain, own]), app })
    expect(plain.options.ssr).toBe('data-only')
    expect(own.options.ssr).toBe(true)
    const untouched = createRoute({ getParentRoute: () => root, path: '/x', component: () => null })
    createKitrRouter({ routeTree: root.addChildren([untouched]), app: createApp() })
    expect(untouched.options.ssr).toBeUndefined()
  })

  it('renders the default not-found page', async () => {
    await mount('/nowhere')
    expect(await screen.findByText('Page not found')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go home' })).toBeTruthy()
  })

  it('renders kitr errors with their message and code', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await mount('/boom')
    const alert = await screen.findByRole('alert')
    expect(alert.getAttribute('data-code')).toBe('CONFLICT')
    expect(alert.textContent).toContain('Already archived')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })

  it('explains FORBIDDEN in plain words', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await mount('/boom', 'forbidden')
    expect(await screen.findByText("You don't have access to this page.")).toBeTruthy()
  })

  it('works when created before the app boots: queryClient resolves lazily and load boots', async () => {
    const queryClient = new QueryClient()
    const app = createApp({
      providers: [
        defineProvider({
          name: 'query',
          register: (a) => a.container.value('queryClient', queryClient),
        }),
      ],
    })
    const router = createKitrRouter({
      routeTree: build(),
      app,
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })
    expect(app.status).toBe('created')
    expect((router.options.context as any).queryClient).toBeUndefined()
    await act(async () => {
      render(<RouterProvider router={router} />)
      await router.load()
    })
    expect(app.status).toBe('booted')
    expect((router.options.context as any).queryClient).toBe(queryClient)
    expect(await screen.findByText('home with app with client')).toBeTruthy()
  })

  it('logs navigations to devtools', async () => {
    const app = createApp()
    const hub = { log: vi.fn() }
    app.container.value('devtools', hub as any)
    await app.boot()
    const router = createKitrRouter({
      routeTree: build(),
      app,
      queryClient: new QueryClient(),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })
    await act(async () => {
      render(<RouterProvider router={router} />)
      await router.load()
    })
    expect(hub.log).toHaveBeenCalledWith('router', expect.stringMatching(/\/$/), expect.any(Object))
  })
})
