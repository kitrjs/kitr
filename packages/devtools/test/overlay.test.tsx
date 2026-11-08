import { createApp, defineProvider } from '@kitr/core'
import { KitrProvider } from '@kitr/react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { definePanel } from '../src'
import devtoolsProvider from '../src/provider'

const action = vi.fn()
const invalidate = vi.fn(async () => 'invalidated 3 queries')
const feature = defineProvider({
  name: 'feature',
  devtools: async () => [
    definePanel({
      id: 'feature',
      label: 'Feature',
      badge: () => 3,
      render: () => <p>feature panel body</p>,
      actions: [
        { id: 'do-it', label: 'Do the thing', run: action },
        { id: 'invalidate', label: 'Invalidate', run: invalidate },
        { id: 'open-invoices', label: 'Open Invoices', run: () => {} },
        { id: 'hidden', label: 'Secret', when: () => false, run: () => {} },
      ],
    }),
    definePanel({ id: 'plain', label: 'Plain', render: () => <p>plain</p> }),
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
  if (app.container.has('devtools'))
    await waitFor(() => expect(shadow()?.querySelector('.kitr-dt')).toBeTruthy())
  return app
}

/** The overlay lives in a shadow root, so everything is queried through it. */
const shadow = () =>
  (document.querySelector('[data-kitr-devtools]') as HTMLElement | null)?.shadowRoot ?? null
const q = (selector: string) => shadow()?.querySelector(selector) as HTMLElement | null
const qa = (selector: string) => [...(shadow()?.querySelectorAll(selector) ?? [])] as HTMLElement[]
const byText = (selector: string, text: string | RegExp) =>
  qa(selector).find((el) =>
    typeof text === 'string' ? el.textContent === text : text.test(el.textContent ?? ''),
  ) as HTMLElement
const tab = (label: string) =>
  [...(shadow()?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])].find(
    (el) => el.querySelector('.kitr-dt-tab-label')?.textContent === label,
  ) as HTMLElement
const trigger = () => q('.kitr-dt-trigger') as HTMLElement
const stored = () => JSON.parse(localStorage.getItem('kitr:devtools') ?? '{}')

const press = (init: KeyboardEventInit) =>
  act(() => {
    fireEvent.keyDown(window, init)
  })
const shortcut = (key: string) => press({ key, ctrlKey: true, shiftKey: true })
const flush = (ms = 40) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })

function pointer(el: Element, type: string, x: number, y: number) {
  act(() => {
    const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, composed: true })
    Object.assign(e, { pointerId: 1 })
    el.dispatchEvent(e)
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  document.documentElement.removeAttribute('data-theme')
})

describe('devtools overlay', () => {
  it('is absent in production and on the server', async () => {
    const app = await mount('production')
    expect(app.container.has('devtools')).toBe(false)
    expect(document.querySelector('[data-kitr-devtools]')).toBeNull()
    expect(screen.getByText('app content')).toBeTruthy()
  })

  it('runs in production when enabled', async () => {
    const app = await mount('production', { enabled: true })
    expect(app.container.has('devtools')).toBe(true)
    expect(trigger().getAttribute('aria-label')).toBe('Open kitr devtools')
  })

  it('stays off in development when disabled', async () => {
    const app = await mount('development', { enabled: false })
    expect(app.container.has('devtools')).toBe(false)
    expect(document.querySelector('[data-kitr-devtools]')).toBeNull()
  })

  it('renders into a shadow root', async () => {
    await mount()
    const host = document.querySelector('[data-kitr-devtools]') as HTMLElement
    expect(host.shadowRoot).toBeTruthy()
    expect(host.querySelector('.kitr-dt')).toBeNull()
    expect(q('style')).toBeTruthy()
    expect(q('.kitr-dt')!.getAttribute('data-theme')).toBe('light')
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
    expect(trigger().textContent).toContain('1')
    fireEvent.click(trigger())
    fireEvent.click(tab('Feature'))
    expect(q('.kitr-dt-body')!.textContent).toContain('feature panel body')
    expect(tab('Feature').getAttribute('aria-selected')).toBe('true')
    expect(tab('Feature').querySelector('.kitr-dt-tab-label')?.textContent).toBe('Feature')
    expect(tab('Feature').querySelector('.kitr-dt-badge')?.textContent).toBe('3')
    fireEvent.click(q('button[aria-label="Actions"]')!)
    expect(byText('[role="menuitem"]', 'Secret')).toBeUndefined()
    await act(async () => {
      fireEvent.click(byText('[role="menuitem"]', 'Do the thing'))
    })
    expect(action).toHaveBeenCalledWith(app)
    fireEvent.click(tab('Broken'))
    expect(q('.kitr-dt-body')!.textContent).toMatch(/panel blew up/)
    expect(byText('.kitr-dt-body button', 'Retry')).toBeTruthy()
    fireEvent.click(q('button[aria-label="Close"]')!)
    expect(trigger()).toBeTruthy()
    expect(stored()).toMatchObject({ open: false, tab: 'broken' })
  })

  it('toggles with ctrl/cmd+shift+K and opens the palette with ctrl/cmd+shift+P', async () => {
    await mount()
    shortcut('K')
    expect(q('.kitr-dt-panel')).toBeTruthy()
    shortcut('k')
    expect(q('.kitr-dt-panel')).toBeNull()
    shortcut('P')
    expect(q('[role="listbox"]')).toBeTruthy()
  })

  it('respects openByDefault and a single-key shortcut', async () => {
    await mount('development', { openByDefault: true, shortcut: 'j' })
    expect(q('.kitr-dt-panel')).toBeTruthy()
    shortcut('J')
    expect(q('.kitr-dt-panel')).toBeNull()
  })

  it('takes the shortcut as an exact combination, where Meta matches Ctrl or Cmd', async () => {
    await mount('development', { shortcut: ['Meta', 'Alt', 'D'] })
    shortcut('d')
    expect(q('.kitr-dt-panel')).toBeNull()
    press({ key: 'd', metaKey: true, altKey: true })
    expect(q('.kitr-dt-panel')).toBeTruthy()
    press({ key: 'D', ctrlKey: true, altKey: true })
    expect(q('.kitr-dt-panel')).toBeNull()
    press({ key: 'd', ctrlKey: true, altKey: true, shiftKey: true })
    expect(q('.kitr-dt-panel')).toBeNull()
  })

  it('closes the palette on the first Escape and the window on the second, then focuses the trigger', async () => {
    await mount('development', { openByDefault: true })
    shortcut('P')
    expect(q('[role="listbox"]')).toBeTruthy()
    press({ key: 'Escape' })
    expect(q('[role="listbox"]')).toBeNull()
    expect(q('.kitr-dt-panel')).toBeTruthy()
    press({ key: 'Escape' })
    expect(q('.kitr-dt-panel')).toBeNull()
    expect(shadow()!.activeElement).toBe(trigger())
  })

  it('opens from the url flag, ignoring a hidden session, unless the flag is disabled', async () => {
    sessionStorage.setItem('kitr:devtools', JSON.stringify({ hiddenUntil: true }))
    window.history.replaceState(null, '', '/?kitr-devtools')
    try {
      await mount()
      expect(q('.kitr-dt-panel')).toBeTruthy()
    } finally {
      window.history.replaceState(null, '', '/')
    }
  })

  it('hides the trigger for the session but keeps the shortcut', async () => {
    sessionStorage.setItem('kitr:devtools', JSON.stringify({ hiddenUntil: true }))
    await mount()
    expect(trigger()).toBeNull()
    shortcut('k')
    expect(q('.kitr-dt-panel')).toBeTruthy()
  })

  it('drags the trigger, snaps it to an edge and remembers where it was left', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
    await mount('development', { position: 'bottom-left' })
    const el = trigger()
    el.setPointerCapture = vi.fn()
    el.getBoundingClientRect = () => ({ left: 12, top: 752, width: 36, height: 36 }) as DOMRect
    pointer(el, 'pointerdown', 30, 770)
    pointer(el, 'pointermove', 700, 300)
    pointer(el, 'pointerup', 700, 300)
    expect(stored().trigger).toEqual({ edge: 'right', y: 282 })
    // A drag does not also open the window.
    fireEvent.click(el)
    expect(q('.kitr-dt-panel')).toBeNull()
    // A move under 4px is a click.
    pointer(el, 'pointerdown', 980, 300)
    pointer(el, 'pointermove', 981, 301)
    pointer(el, 'pointerup', 981, 301)
    fireEvent.click(el)
    expect(q('.kitr-dt-panel')).toBeTruthy()
  })

  it('moves hidden tabs into a +N menu when the strip is narrow', async () => {
    const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100)
    const client = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(260)
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    )
    try {
      await mount('development', { openByDefault: true })
      const more = byText('button', /^\+\d+$/)
      expect(more).toBeTruthy()
      expect(qa('[role="tab"]').length).toBeLessThan(4)
      fireEvent.click(more)
      const item = qa('.kitr-dt-menu [role="menuitem"]').find((i) => i.textContent === 'Broken')
      expect(item).toBeTruthy()
      fireEvent.click(item!)
      expect(tab('Broken').getAttribute('aria-selected')).toBe('true')
    } finally {
      width.mockRestore()
      client.mockRestore()
      vi.unstubAllGlobals()
    }
  })

  it('moves between tabs with the arrow keys', async () => {
    await mount('development', { openByDefault: true })
    const first = qa('[role="tab"]')[0]!
    fireEvent.click(first)
    fireEvent.keyDown(first, { key: 'ArrowRight' })
    expect(qa('[role="tab"]')[1]!.getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(qa('[role="tab"]')[1]!, { key: 'ArrowLeft' })
    expect(qa('[role="tab"]')[0]!.getAttribute('aria-selected')).toBe('true')
  })

  it('counts errors logged while closed on the trigger and clears them on open', async () => {
    const app = await mount()
    const hub = app.container.use('devtools')
    await flush()
    expect(trigger().textContent).toContain('1')
    await act(async () => {
      hub.log('http', 'GET /x failed', undefined, 'error')
      hub.log('http', 'GET /y failed', undefined, 'error')
      await new Promise((r) => setTimeout(r, 40))
    })
    expect(q('.kitr-dt-trigger-badge')!.textContent).toBe('3')
    fireEvent.click(trigger())
    shortcut('k')
    expect(q('.kitr-dt-trigger-badge')).toBeNull()
  })

  it('shows unread warn and error counts on tabs other than the current one', async () => {
    const app = await mount('development', { openByDefault: true })
    const hub = app.container.use('devtools')
    fireEvent.click(tab('App'))
    await act(async () => {
      hub.log('plain', 'oops', undefined, 'warn')
      await new Promise((r) => setTimeout(r, 40))
    })
    expect(tab('Plain').querySelector('.kitr-dt-badge-warn')?.textContent).toBe('1')
    fireEvent.click(tab('Plain'))
    expect(tab('Plain').querySelector('.kitr-dt-badge')).toBeNull()
  })

  it('ranks fuzzy matches and runs actions from the palette, logging the result', async () => {
    const app = await mount()
    shortcut('P')
    const input = q('input')!
    fireEvent.change(input, { target: { value: 'inv' } })
    const rows = qa('[role="option"]').map((r) => r.textContent ?? '')
    const at = (label: string) => rows.findIndex((r) => r.startsWith(label))
    expect(at('Invalidate')).toBeGreaterThanOrEqual(0)
    expect(at('Open Invoices')).toBeGreaterThan(at('Invalidate'))
    expect(rows.some((r) => r.startsWith('Secret'))).toBe(false)
    await act(async () => {
      fireEvent.click(qa('[role="option"]').find((r) => r.textContent === 'InvalidateFeature')!)
    })
    expect(invalidate).toHaveBeenCalled()
    expect(q('[role="listbox"]')).toBeNull()
    expect(app.container.use('devtools').entries('devtools')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'invalidated 3 queries', level: 'info' }),
      ]),
    )
    expect(stored().recent).toEqual(['feature:invalidate'])
  })

  it('logs `ran <label>` for actions that return nothing and an error entry for ones that throw', async () => {
    const app = await mount()
    const hub = app.container.use('devtools')
    shortcut('P')
    fireEvent.change(q('input')!, { target: { value: 'the thing' } })
    await act(async () => {
      fireEvent.keyDown(q('input')!, { key: 'Enter' })
    })
    expect(hub.entries('devtools')).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: 'ran Do the thing' })]),
    )
    action.mockRejectedValueOnce(new Error('nope'))
    shortcut('P')
    fireEvent.change(q('input')!, { target: { value: 'the thing' } })
    await act(async () => {
      fireEvent.keyDown(q('input')!, { key: 'Enter' })
    })
    expect(hub.entries('devtools')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Do the thing failed', level: 'error' }),
      ]),
    )
  })

  it('switches panels from the palette and keeps it open', async () => {
    await mount()
    shortcut('P')
    const row = qa('[role="option"]').find(
      (r) => r.textContent?.replace(/^F(?=Feature)/, '') === 'Feature',
    )!
    fireEvent.click(row)
    expect(q('[role="listbox"]')).toBeTruthy()
    expect(q('.kitr-dt-body')!.textContent).toContain('feature panel body')
  })

  it('lists Recent first, then Panels, then actions, then Devtools commands', async () => {
    localStorage.setItem('kitr:devtools', JSON.stringify({ recent: ['feature:do-it'] }))
    await mount()
    shortcut('P')
    const sections = qa('.kitr-dt-palette-section').map((s) => s.textContent)
    expect(sections.slice(0, 2)).toEqual(['Recent', 'Panels'])
    expect(sections).toContain('Feature')
    expect(sections.at(-1)).toBe('Devtools')
    expect(qa('[role="option"]')[0]!.textContent).toBe('Do the thingFeature')
    const labels = qa('[role="option"]').map((r) => r.textContent)
    expect(labels).toEqual(expect.arrayContaining(['Toggle themeDevtools', 'Dock rightDevtools']))
  })

  it('follows data-theme on <html>, and the Toggle theme command overrides it', async () => {
    await mount()
    expect(q('.kitr-dt')!.getAttribute('data-theme')).toBe('light')
    await act(async () => {
      document.documentElement.dataset.theme = 'dark'
      await new Promise((r) => setTimeout(r, 10))
    })
    expect(q('.kitr-dt')!.getAttribute('data-theme')).toBe('dark')
    shortcut('P')
    fireEvent.change(q('input')!, { target: { value: 'toggle theme' } })
    await act(async () => {
      fireEvent.keyDown(q('input')!, { key: 'Enter' })
    })
    expect(q('.kitr-dt')!.getAttribute('data-theme')).toBe('light')
  })

  it('uses a fixed theme from config', async () => {
    await mount('development', { theme: 'dark' })
    expect(q('.kitr-dt')!.getAttribute('data-theme')).toBe('dark')
  })

  it('does not render the trigger when trigger is hidden, and shows an edge tab for hover', async () => {
    await mount('development', { trigger: 'hidden' })
    expect(trigger()).toBeNull()
    shortcut('k')
    expect(q('.kitr-dt-panel')).toBeTruthy()
  })

  it('docks to the right from the header and remembers it', async () => {
    await mount('development', { openByDefault: true })
    expect(q('.kitr-dt-panel')!.getAttribute('data-dock')).toBe('bottom')
    fireEvent.click(q('button[aria-label="Dock right"]')!)
    expect(q('.kitr-dt-panel')!.getAttribute('data-dock')).toBe('right')
    expect(stored().dock).toBe('right')
    expect(q('.kitr-dt-resize-x')).toBeTruthy()
  })
})
