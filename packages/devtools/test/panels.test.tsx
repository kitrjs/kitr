import { createApp, defineProvider } from '@kitr/core'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDevtoolsHub } from '../src'
import { appPanel } from '../src/panels/app'
import { logPanel } from '../src/panels/log'

const feature = defineProvider({ name: 'feature', register: () => {}, boot: () => {} })

async function setup(env: Record<string, unknown> = {}) {
  const app = createApp({
    environment: 'client',
    mode: 'development',
    providers: [feature],
    config: { feature: { retries: 3 } },
    env,
  } as never)
  const hub = createDevtoolsHub()
  app.container.value('devtools', hub)
  await app.boot()
  return { app, hub }
}

function mount(panel: ReturnType<typeof logPanel>, app: Awaited<ReturnType<typeof setup>>['app']) {
  return render(<div className="kitr-dt">{panel.render(app) as never}</div>)
}

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

describe('log panel', () => {
  it('shows the empty state', async () => {
    const { app } = await setup()
    mount(logPanel(), app)
    expect(screen.getByText('Nothing logged yet')).toBeTruthy()
  })

  it('filters by level, channel and search, then clears', async () => {
    const { app, hub } = await setup()
    hub.log('cart', 'added apple')
    hub.log('cart', 'broke', undefined, 'error')
    hub.log('http', 'GET /orders', { status: 200 })
    mount(logPanel(), app)
    expect(screen.getByText('added apple')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /^error/ }))
    expect(screen.queryByText('broke')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^error/ }))
    expect(screen.getByText('broke')).toBeTruthy()

    const chips = screen.getAllByRole('button', { name: 'http' })
    fireEvent.click(chips[0] as HTMLElement)
    expect(screen.queryByText('added apple')).toBeNull()
    expect(screen.getByText('GET /orders')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'http' })[0] as HTMLElement)

    fireEvent.change(screen.getByLabelText('Search log'), { target: { value: 'apple' } })
    expect(screen.queryByText('GET /orders')).toBeNull()
    expect(screen.getByText('added apple')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Search log'), { target: { value: '' } })

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(hub.entries()).toEqual([])
    await waitFor(() => expect(screen.getByText('Nothing logged yet')).toBeTruthy())
  })

  it('badges errors with the error tone', async () => {
    const { app, hub } = await setup()
    const panel = logPanel()
    expect(panel.badge?.(app)).toBeNull()
    hub.log('x', 'bad', undefined, 'error')
    expect(panel.badge?.(app)).toEqual({ value: 1, tone: 'error' })
  })
})

describe('app panel', () => {
  it('lists providers and masks secret env values', async () => {
    const { app } = await setup({ VITE_API_KEY: 'sk-123', VITE_NAME: 'acme' })
    vi.spyOn(app, 'env', 'get').mockReturnValue({ VITE_API_KEY: 'sk-123', VITE_NAME: 'acme' })
    const { container } = render(<div className="kitr-dt">{appPanel().render(app) as never}</div>)
    expect(screen.getAllByText('feature').length).toBeGreaterThan(0)
    expect(screen.getByText('boot')).toBeTruthy()
    const envRow = within(container).getByText('VITE_API_KEY').closest('tr') as HTMLElement
    expect(envRow.textContent).not.toContain('sk-123')
    fireEvent.click(within(envRow).getByRole('button', { name: 'Reveal value' }))
    expect(envRow.textContent).toContain('sk-123')
    expect(screen.getByText('acme')).toBeTruthy()
  })
})
