import { createApp } from '@kitr/core'
import { KitrProvider } from '@kitr/react'
import { act, render, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  setToastImplementation,
  ThemeProvider,
  ThemeScript,
  themeFromCookie,
  toast,
  toastError,
  useTheme,
} from '../src'
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
  setToastImplementation(null)
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

describe('toast', () => {
  it('falls back to the console without sonner', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    toast('hi')
    toast.success('yay')
    toast.info('fyi')
    toast.warning('hmm')
    toast.error('oh no')
    expect(info.mock.calls.map((c) => c[0])).toEqual([
      '[toast] hi',
      '[toast:success] yay',
      '[toast:info] fyi',
    ])
    expect(warn).toHaveBeenCalledWith('[toast:warning] hmm')
    expect(error).toHaveBeenCalledWith('[toast:error] oh no')
  })

  it('delegates to the installed implementation', async () => {
    const impl: any = Object.assign(vi.fn(), {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
      promise: vi.fn((p: Promise<unknown>) => p),
    })
    setToastImplementation(impl)
    toast('a', { id: 1 })
    toast.success('b')
    await toast.promise(Promise.resolve(1), { loading: 'l', success: 's', error: 'e' })
    expect(impl).toHaveBeenCalledWith('a', { id: 1 })
    expect(impl.success).toHaveBeenCalledWith('b', undefined)
    expect(impl.promise).toHaveBeenCalled()
  })

  it('toastError shows the message or a fallback', () => {
    const impl: any = Object.assign(vi.fn(), { error: vi.fn() })
    setToastImplementation(impl)
    toastError(new Error('Nope'))
    toastError('weird', 'Fallback')
    expect(impl.error.mock.calls).toEqual([
      ['Nope', undefined],
      ['Fallback', undefined],
    ])
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
