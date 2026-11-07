import { createApp, defineProvider } from '@kitr/core'
import { KitrProvider } from '@kitr/react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { definePanel } from '../src'
import devtoolsProvider from '../src/provider'

const action = vi.fn()
const feature = defineProvider({
  name: 'feature',
  devtools: async () => [
    definePanel({
      id: 'feature',
      label: 'Feature',
      badge: () => 3,
      render: () => <p>feature panel body</p>,
      actions: [{ id: 'do-it', label: 'Do the thing', run: action }],
    }),
    definePanel({
      id: 'broken',
      label: 'Broken',
      badge: () => {
        throw new Error('badge blew up')
      },
      render: () => {
        throw new Error('panel blew up')
      },
    }),
  ],
})
const failing = defineProvider({
  name: 'failing',
  devtools: () => {
    throw new Error('cannot build panels')
  },
})

async function mount(mode: 'development' | 'production' = 'development', config = {}) {
  const app = createApp({
    environment: 'client',
    mode,
    providers: [devtoolsProvider, feature, failing],
    config: { devtools: config },
  })
  await app.boot()
  await act(async () => {
    render(
      <KitrProvider app={app}>
        <main>app content</main>
      </KitrProvider>,
    )
  })
  return app
}

const shortcut = (key: string) =>
  act(() => {
    fireEvent.keyDown(window, { key, ctrlKey: true, shiftKey: true })
  })

describe('devtools overlay', () => {
  it('is absent in production and on the server', async () => {
    const app = await mount('production')
    expect(app.container.has('devtools')).toBe(false)
    expect(document.querySelector('[data-kitr-devtools]')).toBeNull()
    expect(screen.getByText('app content')).toBeTruthy()
  })

  it('collects built-in and provider panels and logs providers that fail', async () => {
    const app = await mount()
    const hub = app.container.use('devtools')
    expect(hub.panels.map((p) => p.id)).toEqual(
      expect.arrayContaining(['app', 'log', 'feature', 'broken']),
    )
    expect(hub.entries('devtools')).toEqual([
      expect.objectContaining({ label: 'failing: devtools() failed', level: 'error' }),
    ])
  })

  it('opens from the trigger, switches tabs, runs actions and survives broken panels', async () => {
    const app = await mount()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const trigger = await screen.findByTitle(/kitr devtools/)
    expect(trigger.textContent).toContain('1')
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: /^Feature/ }))
    expect(screen.getByText('feature panel body')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Feature/ }).textContent).toBe('Feature3')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Do the thing' }))
    })
    expect(action).toHaveBeenCalledWith(app)
    fireEvent.click(screen.getByRole('button', { name: 'Broken' }))
    expect(document.querySelector('.kitr-dt-body')!.textContent).toMatch(/panel blew up/)
    fireEvent.click(screen.getByTitle(/^Close/))
    expect(screen.getByTitle(/kitr devtools/)).toBeTruthy()
    expect(JSON.parse(localStorage.getItem('kitr:devtools') ?? '{}')).toMatchObject({
      open: false,
      tab: 'broken',
    })
  })

  it('toggles with ctrl/cmd+shift+K and opens the palette with ctrl/cmd+shift+P', async () => {
    await mount()
    shortcut('K')
    expect(document.querySelector('.kitr-dt-panel')).toBeTruthy()
    shortcut('k')
    expect(document.querySelector('.kitr-dt-panel')).toBeNull()
    shortcut('P')
    const palette = document.querySelector('[data-kitr-devtools]') as HTMLElement
    const input = within(palette).getByRole('textbox')
    fireEvent.change(input, { target: { value: 'thing' } })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    expect(action).toHaveBeenCalled()
  })

  it('respects openByDefault and a custom shortcut', async () => {
    await mount('development', { openByDefault: true, shortcutKey: 'j' })
    expect(document.querySelector('.kitr-dt-panel')).toBeTruthy()
    shortcut('J')
    expect(document.querySelector('.kitr-dt-panel')).toBeNull()
  })
})
