import { createApp } from '@kitr/core'
import { KitrProvider } from '@kitr/react'
import { act, render, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider, ThemeScript, themeFromCookie, useTheme } from '../src'
import themeProvider from '../src/provider'

function mockMatchMedia(dark: boolean) {
  const listeners = new Set<() => void>()
  const media = {
    matches: dark,
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  }
  window.matchMedia = vi.fn(() => media) as any
  return {
    set(next: boolean) {
      media.matches = next
      for (const l of listeners) l()
    },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  document.documentElement.removeAttribute('data-theme')
})

describe('ThemeProvider', () => {
  const wrapper = (props: Partial<Parameters<typeof ThemeProvider>[0]> = {}) =>
    function W({ children }: { children: ReactNode }) {
      return <ThemeProvider {...props}>{children}</ThemeProvider>
    }

  it('follows the system preference and reacts to changes', () => {
    const media = mockMatchMedia(true)
    const { result } = renderHook(() => useTheme(), { wrapper: wrapper() })
    expect(result.current.theme).toBe('system')
    expect(result.current.resolved).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    act(() => media.set(false))
    expect(result.current.resolved).toBe('light')
  })

  it('setTheme persists to storage and a cookie; toggle flips', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme(), {
      wrapper: wrapper({ storageKey: 't', attribute: 'data-mode' }),
    })
    act(() => result.current.setTheme('dark'))
    expect(localStorage.getItem('t')).toBe('dark')
    expect(document.cookie).toContain('t=dark')
    expect(document.documentElement.getAttribute('data-mode')).toBe('dark')
    act(() => result.current.toggle())
    expect(result.current.theme).toBe('light')
  })

  function mockViewTransition() {
    let finish = () => {}
    let ready = () => {}
    const skip = vi.fn()
    const start = vi.fn((update: () => void) => {
      update()
      return {
        finished: new Promise<void>((r) => (finish = r)),
        ready: new Promise<void>((r) => (ready = r)),
        skipTransition: skip,
      }
    })
    ;(document as any).startViewTransition = start
    return { start, skip, finish: () => finish(), ready: () => ready() }
  }
  afterEach(() => {
    delete (document as any).startViewTransition
  })

  function button() {
    const el = document.createElement('button')
    el.getBoundingClientRect = () => ({ left: 10, top: 20, width: 40, height: 20 }) as DOMRect
    return el
  }

  it('changes instantly by default, even with a from and view transitions', () => {
    mockMatchMedia(false)
    const vt = mockViewTransition()
    const { result } = renderHook(() => useTheme(), { wrapper: wrapper() })
    act(() => result.current.toggle({ from: button() }))
    expect(vt.start).not.toHaveBeenCalled()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.hasAttribute('data-kitr-theme-transition')).toBe(false)
  })

  it('runs the configured transition from an element, then cleans up', async () => {
    mockMatchMedia(false)
    const vt = mockViewTransition()
    const { result } = renderHook(() => useTheme(), {
      wrapper: wrapper({ transition: 'circle' }),
    })
    act(() => result.current.toggle({ from: button() }))
    const root = document.documentElement
    expect(vt.start).toHaveBeenCalledOnce()
    expect(root.getAttribute('data-theme')).toBe('dark')
    expect(root.getAttribute('data-kitr-theme-transition')).toBe('circle')
    expect(root.getAttribute('data-kitr-theme-to')).toBe('dark')
    expect(root.style.getPropertyValue('--kitr-theme-transition-x')).toBe('30px')
    expect(root.style.getPropertyValue('--kitr-theme-transition-y')).toBe('30px')
    expect(root.style.getPropertyValue('--kitr-theme-transition-duration')).toBe('600ms')
    // The farthest corner of jsdom's 1024x768 viewport from (30, 30) is (1024, 768).
    expect(root.style.getPropertyValue('--kitr-theme-transition-radius')).toBe('1239px')
    expect(root.style.getPropertyValue('--kitr-theme-transition-reach')).toBe('1732px')
    await act(async () => vt.finish())
    expect(root.hasAttribute('data-kitr-theme-transition')).toBe(false)
    expect(root.hasAttribute('data-kitr-theme-to')).toBe(false)
    expect(root.style.getPropertyValue('--kitr-theme-transition-x')).toBe('')
    expect(root.style.getPropertyValue('--kitr-theme-transition-radius')).toBe('')
  })

  it('keeps the old theme on the page until the browser has taken the first picture', () => {
    mockMatchMedia(false)
    // A real view transition runs the update a frame later, after it has captured the old page.
    let update = () => {}
    ;(document as any).startViewTransition = vi.fn((u: () => void) => {
      update = u
      return { finished: new Promise(() => {}), ready: new Promise(() => {}), skipTransition() {} }
    })
    const { result } = renderHook(() => useTheme(), {
      wrapper: wrapper({ transition: 'circle' }),
    })
    const root = document.documentElement
    act(() => result.current.toggle({ from: button() }))
    expect(root.getAttribute('data-theme')).toBe('light')
    expect(result.current.theme).toBe('system')
    act(() => update())
    expect(root.getAttribute('data-theme')).toBe('dark')
    expect(result.current.theme).toBe('dark')
    expect(result.current.resolved).toBe('dark')
  })

  it('takes timing and direction, and a per-call transition wins over the provider', () => {
    mockMatchMedia(false)
    const vt = mockViewTransition()
    const { result } = renderHook(() => useTheme(), { wrapper: wrapper({ transition: 'fade' }) })
    act(() =>
      result.current.setTheme('dark', {
        transition: { name: 'wipe', duration: 600, easing: 'linear', direction: 'left' },
      }),
    )
    const root = document.documentElement
    expect(root.getAttribute('data-kitr-theme-transition')).toBe('wipe')
    expect(root.getAttribute('data-kitr-theme-direction')).toBe('left')
    expect(root.style.getPropertyValue('--kitr-theme-transition-duration')).toBe('600ms')
    expect(root.style.getPropertyValue('--kitr-theme-transition-easing')).toBe('linear')
    act(() => result.current.setTheme('light', { transition: false }))
    expect(vt.start).toHaveBeenCalledOnce()
    expect(root.getAttribute('data-theme')).toBe('light')
  })

  it('hands a custom animate the transition, themes, origin and timing', async () => {
    mockMatchMedia(false)
    const vt = mockViewTransition()
    const animate = vi.fn()
    const { result } = renderHook(() => useTheme(), {
      wrapper: wrapper({ transition: { animate, duration: 250 } }),
    })
    act(() => result.current.toggle({ from: { x: 5, y: 6 } }))
    expect(document.documentElement.getAttribute('data-kitr-theme-transition')).toBe('custom')
    await act(async () => vt.ready())
    expect(animate).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'light',
        to: 'dark',
        origin: { x: 5, y: 6 },
        duration: 250,
        easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
      }),
    )
  })

  it('skips the running transition when the theme changes again', () => {
    mockMatchMedia(false)
    const vt = mockViewTransition()
    const { result } = renderHook(() => useTheme(), { wrapper: wrapper({ transition: 'fade' }) })
    act(() => result.current.setTheme('dark'))
    act(() => result.current.setTheme('light'))
    expect(vt.start).toHaveBeenCalledTimes(2)
    expect(vt.skip).toHaveBeenCalledOnce()
  })

  it('changes instantly for less motion, without view transitions, or when nothing changes', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme(), { wrapper: wrapper({ transition: 'fade' }) })
    act(() => result.current.setTheme('dark'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    const vt = mockViewTransition()
    act(() => result.current.setTheme('dark'))
    expect(vt.start).not.toHaveBeenCalled()
    const media = window.matchMedia
    window.matchMedia = vi.fn((query: string) =>
      query.includes('reduce') ? ({ matches: true } as MediaQueryList) : media(query),
    ) as any
    act(() => result.current.setTheme('light'))
    expect(vt.start).not.toHaveBeenCalled()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('restores a stored choice and ignores junk', () => {
    mockMatchMedia(false)
    localStorage.setItem('kitr-theme', 'dark')
    const { result } = renderHook(() => useTheme(), { wrapper: wrapper() })
    expect(result.current.theme).toBe('dark')
    localStorage.setItem('kitr-theme', 'purple')
    const { result: second } = renderHook(() => useTheme(), { wrapper: wrapper() })
    expect(second.current.theme).toBe('system')
  })

  it('useTheme outside the provider explains itself', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useTheme())).toThrow(/inside <ThemeProvider>/)
  })
})

describe('ThemeScript', () => {
  it('applies the stored theme before paint', () => {
    mockMatchMedia(false)
    localStorage.setItem('kitr-theme', 'dark')
    const { container } = render(<ThemeScript />)
    const code = container.querySelector('script')!.innerHTML
    new Function(code)()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('cannot be broken out of with a hostile storage key', () => {
    const html = renderToString(<ThemeScript storageKey={'</script><script>alert(1)</script>'} />)
    expect(html.match(/<script/g)).toHaveLength(1)
    expect(html).not.toContain('</script><script>')
  })

  // The head script and the provider read the same config, so they agree on the theme.
  it('takes storageKey, attribute and tokens from config/theme.ts', async () => {
    const app = createApp({
      environment: 'test',
      config: {
        theme: {
          storageKey: 'my-theme',
          attribute: 'data-mode',
          tokens: {
            light: { color: { primary: 'oklch(60% 0.2 150)' } },
            dark: { color: { primary: 'oklch(70% 0.1 150)' } },
          },
        },
      },
    })
    const html = renderToString(themeProvider.wrap!(<ThemeScript />, app) as any)
    expect(html).toContain('my-theme')
    expect(html).toContain('data-mode')
    expect(html).toContain(':root:root {\n  --kitr-color-primary: oklch(60% 0.2 150);')
    expect(html).toContain(
      ':root:root[data-mode="dark"] {\n  --kitr-color-primary: oklch(70% 0.1 150);',
    )
  })

  it('writes no style without tokens, and escapes values that try to close the tag', () => {
    expect(renderToString(<ThemeScript />)).not.toContain('<style')
    const html = renderToString(
      <ThemeScript tokens={{ light: { color: { x: 'red</style><script>alert(1)</script>' } } }} />,
    )
    expect(html.match(/<script/g)).toHaveLength(1)
    expect(html).not.toContain('</style><script>')
  })
})

describe('themeFromCookie', () => {
  it('reads light/dark from the cookie header only', () => {
    expect(themeFromCookie('a=1; kitr-theme=dark; b=2')).toBe('dark')
    expect(themeFromCookie('kitr-theme=light')).toBe('light')
    expect(themeFromCookie('kitr-theme=system')).toBeUndefined()
    expect(themeFromCookie('my-kitr-theme=dark')).toBeUndefined()
    expect(themeFromCookie('t=dark', 't')).toBe('dark')
    expect(themeFromCookie(null)).toBeUndefined()
  })
})

describe('themeProvider', () => {
  it('wraps the app in a ThemeProvider configured from config/theme.ts', async () => {
    mockMatchMedia(false)
    const app = createApp({
      providers: [themeProvider],
      config: { theme: { default: 'dark', attribute: 'data-ui' } },
    })
    await app.boot()
    function Show() {
      return <p>{useTheme().resolved}</p>
    }
    render(
      <KitrProvider app={app}>
        <Show />
      </KitrProvider>,
    )
    expect(screen.getByText('dark')).toBeTruthy()
    expect(document.documentElement.getAttribute('data-ui')).toBe('dark')
  })
})
