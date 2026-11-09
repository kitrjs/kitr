import { createApp } from '@kitr/core'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { act, render, screen } from '@testing-library/react'
import { type ReactNode, useContext } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AnimatePresence,
  defineConfig,
  MotionConfigContext,
  motion,
  pageTransitions,
  presets,
  presetVariants,
  Reveal,
  RevealItem,
  transitions,
  useReducedMotionConfig,
} from '../src'
import animation, { animationConfig } from '../src/kitr'
import { animationProvider } from '../src/provider'

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('presets', () => {
  it('spread as initial, animate, exit and transition', () => {
    expect(presets.fadeUp).toEqual({
      initial: { opacity: 0, y: 12 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 12, transition: transitions.exit },
      transition: transitions.base,
    })
    expect(presets.scale.transition).toBe(transitions.snappy)
    expect(presetVariants('fade')).toEqual({
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: transitions.base },
    })
  })

  it('collapse opens to the content height', () => {
    expect(presets.collapse.animate).toMatchObject({ height: 'auto' })
    expect(presets.collapse.initial).toMatchObject({ height: 0, overflow: 'hidden' })
  })
})

describe('pageTransitions', () => {
  const at = (index: number) => ({ state: { __TSR_index: index } })
  const change = (from: number, to: number, pathChanged = true) => ({
    fromLocation: at(from),
    toLocation: at(to),
    pathChanged,
    hrefChanged: true,
  })

  it('slides forward on a new entry and back on the back button', () => {
    mockReducedMotion(false)
    const { types } = pageTransitions()
    expect(types(change(3, 4))).toEqual(['kitr-slide', 'kitr-forward'])
    expect(types(change(4, 3))).toEqual(['kitr-slide', 'kitr-back'])
    expect(pageTransitions({ style: 'fade' }).types(change(1, 2))).toEqual([
      'kitr-fade',
      'kitr-forward',
    ])
    expect(pageTransitions({ style: 'rise' }).types(change(2, 1))).toEqual([
      'kitr-rise',
      'kitr-back',
    ])
  })

  it('leaves the first render of the app alone', () => {
    mockReducedMotion(false)
    expect(
      pageTransitions().types({ toLocation: at(0), pathChanged: true, hrefChanged: true }),
    ).toBe(false)
  })

  it('skips search-only changes unless asked', () => {
    mockReducedMotion(false)
    expect(pageTransitions().types(change(1, 2, false))).toBe(false)
    expect(pageTransitions({ onSearchChange: true }).types(change(1, 2, false))).toEqual([
      'kitr-slide',
      'kitr-forward',
    ])
  })

  it('does nothing for visitors who ask for less motion', () => {
    mockReducedMotion(true)
    expect(pageTransitions().types(change(1, 2))).toBe(false)
    expect(pageTransitions({ reducedMotion: 'never' }).types(change(1, 2))).toEqual([
      'kitr-slide',
      'kitr-forward',
    ])
    mockReducedMotion(false)
    expect(pageTransitions({ reducedMotion: 'always' }).types(change(1, 2))).toBe(false)
  })

  it('is what TanStack Router passes to document.startViewTransition', async () => {
    mockReducedMotion(false)
    const calls: Array<{ types?: string[] }> = []
    const start = vi.fn((arg: { update: () => unknown; types?: string[] }) => {
      calls.push({ types: arg.types })
      const done = Promise.resolve(arg.update())
      return { updateCallbackDone: done, finished: done, ready: done }
    })
    Object.assign(document, { startViewTransition: start })
    vi.stubGlobal('CSS', { supports: () => true })
    const root = createRootRoute({ component: () => <Outlet /> })
    const projects = createRoute({
      getParentRoute: () => root,
      path: '/',
      component: () => <h1>Projects</h1>,
    })
    const invoices = createRoute({
      getParentRoute: () => root,
      path: '/invoices',
      component: () => <h1>Invoices</h1>,
    })
    const router = createRouter({
      routeTree: root.addChildren([projects, invoices]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
      defaultViewTransition: pageTransitions(),
    })
    render(<RouterProvider router={router} />)
    await screen.findByText('Projects')
    await act(() => router.navigate({ to: '/invoices' }))
    await screen.findByText('Invoices')
    expect(calls.at(-1)?.types).toEqual(['kitr-slide', 'kitr-forward'])
    await act(async () => router.history.back())
    await screen.findByText('Projects')
    expect(calls.at(-1)?.types).toEqual(['kitr-slide', 'kitr-back'])
    delete (document as { startViewTransition?: unknown }).startViewTransition
  })
})

async function bootApp(config?: object, environment: 'test' | 'client' = 'test') {
  const app = createApp({
    environment,
    providers: [animationProvider],
    config: config ? { animation: config } : {},
  })
  await app.boot()
  return (children: ReactNode) => app.wrap(children) as ReactNode
}

describe('animationProvider', () => {
  function Settings() {
    const { reducedMotion, skipAnimations, transition } = useContext(MotionConfigContext)
    return <output>{JSON.stringify({ reducedMotion, skipAnimations, transition })}</output>
  }
  const settings = () => JSON.parse(screen.getByRole('status').textContent!)

  it('follows the visitor setting, uses the base transition and skips animations under Vitest', async () => {
    const withApp = await bootApp()
    render(
      withApp(
        <>
          <Settings />
          <motion.div data-testid="card" {...presets.fadeUp} />
        </>,
      ),
    )
    expect(settings()).toEqual({
      reducedMotion: 'user',
      skipAnimations: true,
      transition: JSON.parse(JSON.stringify(transitions.base)),
    })
    const card = screen.getByTestId('card')
    await vi.waitFor(() => expect(card.style.opacity).toBe('1'))
  })

  it('reads config/animation.ts', async () => {
    const withApp = await bootApp(
      defineConfig({
        reducedMotion: 'always',
        transition: transitions.snappy,
        skipAnimations: false,
      }),
    )
    render(withApp(<Settings />))
    expect(settings()).toEqual({
      reducedMotion: 'always',
      skipAnimations: false,
      transition: transitions.snappy,
    })
  })

  it('applies reducedMotion to every motion element', async () => {
    function Policy() {
      return <output>{String(useReducedMotionConfig())}</output>
    }
    const withApp = await bootApp({ reducedMotion: 'always' })
    render(withApp(<Policy />))
    expect(screen.getByRole('status').textContent).toBe('true')
  })

  it('animates normally outside tests', async () => {
    const withApp = await bootApp(undefined, 'client')
    render(withApp(<Settings />))
    expect(settings().skipAnimations).toBe(false)
  })

  it('runs exit animations to the end inside AnimatePresence', async () => {
    const withApp = await bootApp()
    function List({ show }: { show: boolean }) {
      return withApp(
        <AnimatePresence>
          {show && (
            <motion.p key="toast" {...presets.fadeDown}>
              Invoice sent
            </motion.p>
          )}
        </AnimatePresence>,
      )
    }
    const { rerender } = render(<List show />)
    expect(screen.getByText('Invoice sent')).toBeTruthy()
    rerender(<List show={false} />)
    await vi.waitFor(() => expect(screen.queryByText('Invoice sent')).toBeNull())
  })
})

describe('Reveal', () => {
  it('starts hidden and animates in when it scrolls into view', async () => {
    mockReducedMotion(false)
    const observed: Array<(entries: unknown[]) => void> = []
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(private cb: (entries: unknown[]) => void) {
          observed.push(cb)
        }
        observe(target: Element) {
          queueMicrotask(() => this.cb([{ target, isIntersecting: true, intersectionRatio: 1 }]))
        }
        unobserve() {}
        disconnect() {}
      },
    )
    const withApp = await bootApp()
    render(
      withApp(
        <Reveal as="ul" stagger={0.05} data-testid="list">
          <RevealItem as="li">Ada</RevealItem>
          <RevealItem as="li">Grace</RevealItem>
        </Reveal>,
      ),
    )
    const list = screen.getByTestId('list')
    expect(list.tagName).toBe('UL')
    const ada = screen.getByText('Ada')
    expect(ada.tagName).toBe('LI')
    await vi.waitFor(() => expect(ada.style.opacity).toBe('1'))
    expect(observed.length).toBeGreaterThan(0)
  })

  it('renders a RevealItem outside a staggered Reveal without animating', () => {
    render(<RevealItem as="span">Linus</RevealItem>)
    expect(screen.getByText('Linus').style.opacity).toBe('')
  })
})

describe('setup module', () => {
  it('adds motion, the provider, config/animation.ts and AGENTS.md lines', () => {
    const calls: string[] = []
    const ctx = {
      deps: { add: (...d: string[]) => calls.push(`dep ${d}`), remove: () => {} },
      provider: { add: (p: string) => calls.push(`provider ${p}`), remove: () => {} },
      config: (name: string, src: string) => calls.push(`config ${name} ${src.length > 0}`),
      agents: { add: (name: string) => calls.push(`agents ${name}`), remove: () => {} },
    }
    animation.add!(ctx as never)
    expect(calls).toEqual([
      'dep motion',
      'provider @kitr/animation/provider',
      'config animation true',
      'agents animation',
    ])
    expect(animationConfig).toContain("import { defineConfig, transitions } from '@kitr/animation'")
    expect(animation.requires).toEqual(['react'])
    expect(animation.wraps).toEqual({
      'motion/react': '@kitr/animation',
      'framer-motion': '@kitr/animation',
    })
  })
})
