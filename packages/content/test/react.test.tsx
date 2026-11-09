import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@kitr/router'
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Page } from '../src'
import { DocBody, Toc, useActiveHeading } from '../src/react'

const page: Page = {
  url: '/docs/getting-started',
  title: 'Getting started',
  section: 'Start here',
  data: {},
  steps: true,
  toc: [
    { depth: 2, id: 'install', text: 'Install' },
    { depth: 3, id: 'with-pnpm', text: 'With pnpm' },
  ],
  blocks: [
    {
      type: 'html',
      html: '<h2 id="install">Install</h2><div class="code"><pre class="shiki"><code>const a = 1</code></pre></div><p><a href="/docs/cli">CLI</a> <a href="/docs/cli.md">raw</a></p>',
    },
    { type: 'cmd', cmd: 'kitr add content' },
    { type: 'html', html: '<h3 id="with-pnpm">With pnpm</h3><pre><code>pnpm i</code></pre>' },
  ],
  editUrl: 'https://github.com/acme/docs/edit/main/content/docs/getting-started.md',
}

describe('DocBody', () => {
  it('renders the html blocks and each command through renderCommand', () => {
    const view = render(
      <DocBody page={page} renderCommand={(cmd) => <output data-testid="cmd">{cmd}</output>} />,
    )
    expect(view.container.firstElementChild!.className).toBe('prose steps')
    expect(view.getByRole('heading', { level: 2 }).textContent).toBe('Install')
    expect(view.getByTestId('cmd').textContent).toBe('kitr add content')
  })

  it('renders a command as a plain code block by default', () => {
    const view = render(
      <DocBody page={{ blocks: [{ type: 'cmd', cmd: 'kitr dev' }], steps: false }} />,
    )
    expect(view.container.querySelector('pre.cmd')!.textContent).toBe('kitr dev')
  })

  it('adds one Copy button per code block, wrapping bare pre elements', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const view = render(<DocBody page={page} />)
    const buttons = view.getAllByRole('button', { name: 'Copy code' })
    // Two code blocks in the HTML, one default command block.
    expect(buttons).toHaveLength(3)
    fireEvent.click(buttons[0]!)
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('const a = 1'))
    await vi.waitFor(() => expect(buttons[0]!.textContent).toBe('Copied'))
    view.rerender(<DocBody page={page} />)
    expect(view.getAllByRole('button', { name: 'Copy code' })).toHaveLength(3)
  })

  it('keeps internal links in the router and lets .md links load', async () => {
    const rootRoute = createRootRoute({ component: () => <DocBody page={page} /> })
    const router = createRouter({
      routeTree: rootRoute.addChildren([
        createRoute({ getParentRoute: () => rootRoute, path: '/docs/$slug' }),
      ]),
      history: createMemoryHistory({ initialEntries: ['/docs/getting-started'] }),
    })
    const view = render(<RouterProvider router={router} />)
    const link = await view.findByRole('link', { name: 'CLI' })
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    link.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/docs/cli'))
    const raw = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    view.getByRole('link', { name: 'raw' }).dispatchEvent(raw)
    expect(raw.defaultPrevented).toBe(false)
    const modified = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true })
    view.getByRole('link', { name: 'CLI' }).dispatchEvent(modified)
    expect(modified.defaultPrevented).toBe(false)
  })

  it('leaves links alone without a router', () => {
    const view = render(<DocBody page={page} />)
    const link = view.getByRole('link', { name: 'CLI' })
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    link.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })
})

describe('Toc', () => {
  it('lists the headings by depth with the edit link', () => {
    const view = render(<Toc page={page} active="with-pnpm" />)
    const nav = view.getByRole('navigation', { name: 'On this page' })
    const items = nav.querySelectorAll('li')
    expect([...items].map((li) => [li.dataset.depth, li.textContent])).toEqual([
      ['2', 'Install'],
      ['3', 'With pnpm'],
    ])
    expect(view.getByRole('link', { name: 'With pnpm' }).getAttribute('aria-current')).toBe(
      'location',
    )
    expect(view.getByRole('link', { name: 'Edit this page' }).getAttribute('href')).toBe(
      page.editUrl,
    )
  })

  it('renders nothing for a page without headings or edit link', () => {
    const view = render(<Toc page={{ toc: [] }} />)
    expect(view.container.innerHTML).toBe('')
  })
})

describe('useActiveHeading', () => {
  function Probe() {
    return <span data-testid="active">{useActiveHeading(page.toc) ?? 'none'}</span>
  }

  it('marks the last heading whose top scrolled past the offset', () => {
    const tops: Record<string, number> = { install: 40, 'with-pnpm': 600 }
    const rect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        return { top: tops[this.id] ?? 0 } as DOMRect
      })
    const view = render(
      <>
        <h2 id="install">Install</h2>
        <h3 id="with-pnpm">With pnpm</h3>
        <Probe />
      </>,
    )
    expect(view.getByTestId('active').textContent).toBe('install')
    rect.mockRestore()
  })
})
