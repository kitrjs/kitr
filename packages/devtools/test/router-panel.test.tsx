import { createApp } from '@kitr/core'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createDevtoolsHub } from '../src/index'
import { routerPanel } from '../src/panels/router'

const root = { id: '__root__', fullPath: '/', children: [] as unknown[] }
const about = { id: '/about', fullPath: '/about', children: [] }
root.children = [about]

function setup(status = 'idle', withRouter = true) {
  const app = createApp()
  app.container.value('devtools', createDevtoolsHub())
  const router = {
    state: {
      status,
      location: { pathname: '/about', search: { q: 'x' }, hash: '' },
      matches: [
        { routeId: '__root__', params: {}, status: 'success', pathname: '/' },
        { routeId: '/about', params: {}, status: 'success', pathname: '/about' },
      ],
    },
    routeTree: root,
    navigate: vi.fn(),
    invalidate: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  }
  if (withRouter) app.container.value('router', router as never)
  return { app, router }
}

describe('routerPanel', () => {
  it('renders stats, match rows and the route tree', () => {
    const { app } = setup()
    render(routerPanel().render(app) as ReactElement)
    expect(screen.getAllByText('/about').length).toBeGreaterThan(0)
    expect(screen.getByText('__root__')).toBeTruthy()
    expect(screen.getByText('Routes')).toBeTruthy()
    expect(screen.getByText('Search')).toBeTruthy()
  })

  it('renders Empty without a router', () => {
    const { app } = setup('idle', false)
    render(routerPanel().render(app) as ReactElement)
    expect(screen.getByText('No router')).toBeTruthy()
  })

  it('badges only while pending', () => {
    expect(routerPanel().badge?.(setup('idle').app)).toBeNull()
    expect(routerPanel().badge?.(setup('pending').app)).toEqual({ value: '…', tone: 'info' })
    expect(routerPanel().badge?.(setup('idle', false).app)).toBeNull()
  })
})
