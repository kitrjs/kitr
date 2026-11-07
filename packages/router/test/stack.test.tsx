import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
  useParams,
} from '../src'
import {
  SplitStack,
  StackOutlet,
  StackTabs,
  useBackHandler,
  useSplitPane,
  useStack,
} from '../src/stack'

function Counter({ label }: { label: string }) {
  const [n, setN] = useState(0)
  return (
    <button type="button" onClick={() => setN(n + 1)}>
      {label} {n}
    </button>
  )
}

function buildTree(shell: () => React.ReactNode) {
  const root = createRootRoute({ component: () => <Outlet /> })
  const layout = createRoute({ getParentRoute: () => root, id: 'shell', component: shell })
  const home = createRoute({
    getParentRoute: () => layout,
    path: '/',
    component: () => {
      const stack = useStack()
      return (
        <div>
          <Counter label="home" />
          <Link to="/chats/$id" params={{ id: '1' }}>
            open chat 1
          </Link>
          <span>depth {stack.depth}</span>
        </div>
      )
    },
  })
  const chats = createRoute({ getParentRoute: () => layout, path: 'chats' })
  const chat = createRoute({
    getParentRoute: () => chats,
    path: '$id',
    component: () => {
      const { id } = useParams({ strict: false }) as { id: string }
      const stack = useStack()
      return (
        <div>
          <Counter label={`chat ${id}`} />
          <span>depth {stack.depth}</span>
          <button type="button" onClick={() => stack.pop()}>
            pop
          </button>
        </div>
      )
    },
  })
  const compose = createRoute({
    getParentRoute: () => layout,
    path: 'compose',
    staticData: { presentation: 'sheet' },
    component: () => <p>compose sheet</p>,
  })
  const search = createRoute({
    getParentRoute: () => layout,
    path: 'search',
    component: () => <Counter label="search" />,
  })
  return root.addChildren([layout.addChildren([home, chats.addChildren([chat]), compose, search])])
}

async function mount(tree: ReturnType<typeof buildTree>, path = '/') {
  const history = createMemoryHistory({ initialEntries: [path] })
  const router = createRouter({ routeTree: tree, history })
  await act(async () => {
    render(<RouterProvider router={router} />)
    await router.load()
  })
  const go = (to: string) => act(async () => void (await router.navigate({ href: to })))
  const back = () => act(async () => history.back())
  return { router, history, go, back }
}

const pages = () => Array.from(document.querySelectorAll('[data-kitr-stack-page]'))
const visiblePages = () =>
  pages().filter((el) => !(el.closest('[hidden]') || (el as HTMLElement).style.display === 'none'))

describe('StackOutlet', () => {
  it('keeps the page beneath mounted with its state, and pops back to it', async () => {
    const { go, back } = await mount(buildTree(() => <StackOutlet motion="none" />))
    fireEvent.click(await screen.findByText('home 0'))
    fireEvent.click(screen.getByText('home 1'))
    expect(screen.getByText('depth 1')).toBeTruthy()

    await go('/chats/1')
    expect(await screen.findByText('chat 1 0')).toBeTruthy()
    expect(pages()).toHaveLength(2)
    // The home page is still in the tree, hidden, with its counter at 2.
    expect(screen.getByText('home 2')).toBeTruthy()
    // Both pages read the same stack: depth is 2 on each.
    expect(screen.getAllByText('depth 2')).toHaveLength(2)
    fireEvent.click(screen.getByText('chat 1 0'))

    await back()
    expect(await screen.findByText('home 2')).toBeTruthy()
    expect(pages()).toHaveLength(1)
    expect(screen.queryByText(/^chat 1/)).toBeNull()
  })

  it('stacks the same route twice and each page keeps its own params', async () => {
    const { go } = await mount(buildTree(() => <StackOutlet motion="none" />))
    await go('/chats/1')
    fireEvent.click(await screen.findByText('chat 1 0'))
    await go('/chats/2')
    expect(await screen.findByText('chat 2 0')).toBeTruthy()
    expect(screen.getByText('chat 1 1')).toBeTruthy()
    expect(pages().map((p) => p.getAttribute('data-presentation'))).toEqual([
      'push',
      'push',
      'push',
    ])
    expect(visiblePages()).toHaveLength(1)
  })

  it('shows the page beneath a sheet and marks the sheet a dialog', async () => {
    const { go } = await mount(buildTree(() => <StackOutlet motion="none" />))
    await go('/compose')
    expect(await screen.findByText('compose sheet')).toBeTruthy()
    const sheet = document.querySelector('[data-presentation="sheet"]')!
    expect(sheet.getAttribute('role')).toBe('dialog')
    expect(visiblePages()).toHaveLength(2)
    expect(screen.getByText('home 0')).toBeTruthy()
  })

  it('pops through useStack() and registers back handlers newest first', async () => {
    const order: string[] = []
    function Shell() {
      useBackHandler(() => {
        order.push('shell')
        return false
      })
      return <StackOutlet motion="none" />
    }
    const { go, router } = await mount(buildTree(() => <Shell />))
    expect(screen.getByText('depth 1')).toBeTruthy()
    await go('/chats/1')
    expect(await screen.findByText('chat 1 0')).toBeTruthy()
    await act(async () => fireEvent.click(screen.getByText('pop')))
    expect(await screen.findByText('depth 1')).toBeTruthy()
    expect(router.state.location.pathname).toBe('/')
    // The shell's handler sits in the default registry (outside any stack) and is callable.
    const { defaultBackRegistry } = await import('../src/stack')
    expect(defaultBackRegistry.run()).toBe(false)
    expect(order).toEqual(['shell'])
  })

  it('renders a plain Outlet on the server', async () => {
    const { renderToString } = await import('react-dom/server')
    const { createMemoryHistory: mem, createRouter: make } = await import('../src')
    const tree = buildTree(() => <StackOutlet />)
    const router = make({
      routeTree: tree,
      history: mem({ initialEntries: ['/'] }),
      isServer: true,
    })
    await router.load()
    const html = renderToString(<RouterProvider router={router} />)
    expect(html).toContain('home')
    expect(html).not.toContain('data-kitr-stack-page')
  })
})

describe('StackTabs', () => {
  it('switches tabs, keeping each tab where it was', async () => {
    const tree = buildTree(() => (
      <StackTabs
        motion="none"
        tabs={[
          { id: 'home', to: '/', match: ['/', '/chats'] },
          { id: 'search', to: '/search' },
        ]}
      >
        {({ tabs, current, select }) => (
          <nav>
            {tabs.map((t) => (
              <button
                type="button"
                key={t.id}
                aria-current={current?.id === t.id}
                onClick={() => select(t)}
              >
                tab {t.id}
              </button>
            ))}
          </nav>
        )}
      </StackTabs>
    ))
    const { go } = await mount(tree)
    await go('/chats/1')
    fireEvent.click(await screen.findByText('chat 1 0'))
    await act(async () => fireEvent.click(screen.getByText('tab search')))
    expect(await screen.findByText('search 0')).toBeTruthy()
    expect(screen.getByText('tab search').getAttribute('aria-current')).toBe('true')
    // Back to home: lands on chat 1 as it was left, not on the tab root.
    await act(async () => fireEvent.click(screen.getByText('tab home')))
    expect(await screen.findByText('chat 1 1')).toBeTruthy()
    expect(visiblePages()).toHaveLength(1)
    // Tap the current tab again: pop to its root.
    await act(async () => fireEvent.click(screen.getByText('tab home')))
    expect(await screen.findByText('home 0')).toBeTruthy()
    expect(screen.queryByText(/^chat 1/)).toBeNull()
  })
})

describe('SplitStack', () => {
  it('shows one pane below the breakpoint and both above it', async () => {
    const original = window.matchMedia
    let wide = false
    window.matchMedia = ((q: string) => ({
      matches: wide,
      media: q,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia
    function Pane() {
      const { split } = useSplitPane()
      return <p>split {String(split)}</p>
    }
    const { unmount } = render(
      <SplitStack master={<p>list</p>}>
        <Pane />
      </SplitStack>,
    )
    expect(screen.getByText('split false')).toBeTruthy()
    expect(screen.queryByText('list')).toBeNull()
    unmount()
    wide = true
    render(
      <SplitStack master={<p>list</p>}>
        <Pane />
      </SplitStack>,
    )
    expect(await screen.findByText('split true')).toBeTruthy()
    expect(screen.getByText('list')).toBeTruthy()
    window.matchMedia = original
  })
})
