import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ThemeConfig } from './config'
import { defineTokens, type TokenGroup } from './tokens'

/** The user's choice: a fixed theme, or `'system'` to follow the operating system. */
export type Theme = 'light' | 'dark' | 'system'
export { themeFromCookie } from './cookie'

/** The theme on screen once `'system'` is resolved: always `'light'` or `'dark'`. */
export type ResolvedTheme = 'light' | 'dark'

/** How a theme change is shown. */
export interface ThemeChangeOptions {
  /**
   * Reveal the new theme as a circle growing from this element (or point), through a view
   * transition. Styled by `@kitr/theme/styles.css`. Visitors who ask for less motion, and browsers
   * without view transitions, get an instant change.
   */
  from?: Element | { x: number; y: number }
}

interface ThemeContextValue {
  theme: Theme
  resolved: ResolvedTheme
  setTheme: (theme: Theme, options?: ThemeChangeOptions) => void
  toggle: (options?: ThemeChangeOptions) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/** `config/theme.ts`, provided by the theme provider so `<ThemeScript />` uses the same settings. */
export const ThemeConfigContext = createContext<ThemeConfig | null>(null)

/** Props of `ThemeProvider`. The theme provider in `kitrrc.ts` fills them from `config/theme.ts`. */
export interface ThemeProviderProps {
  /** The tree that can call `useTheme()`. */
  children: ReactNode
  /** The theme before the user picks one. Default `'system'`. */
  defaultTheme?: Theme
  /** The `localStorage` key and cookie name holding the choice. Default `'kitr-theme'`. */
  storageKey?: string
  /** The attribute set on `<html>` to `light` or `dark`. Default `'data-theme'`. */
  attribute?: string
  /** Theme known on the server (e.g. from a cookie) to avoid a flash. */
  initialResolved?: ResolvedTheme
  /** `<meta name="theme-color">` per resolved theme, which native shells and PWAs show as window chrome. */
  colors?: { light?: string; dark?: string }
}

/**
 * Light/dark/system with no flash: pair with `<ThemeScript />` in the document head.
 * Sets `data-theme="light|dark"` on <html>, which the Tailwind preset and styles.css read.
 */
export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'kitr-theme',
  attribute = 'data-theme',
  initialResolved = 'light',
  colors,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme)
  const [resolved, setResolved] = useState<ResolvedTheme>(initialResolved)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey) as Theme | null
      if (stored === 'light' || stored === 'dark' || stored === 'system') setThemeState(stored)
    } catch {}
  }, [storageKey])

  const lightColor = colors?.light
  const darkColor = colors?.dark
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const next: ResolvedTheme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
      setResolved(next)
      document.documentElement.setAttribute(attribute, next)
      document.documentElement.style.colorScheme = next
      const color = next === 'dark' ? darkColor : lightColor
      if (color) {
        let meta = document.querySelector('meta[name="theme-color"]')
        if (!meta) {
          meta = document.createElement('meta')
          meta.setAttribute('name', 'theme-color')
          document.head.appendChild(meta)
        }
        meta.setAttribute('content', color)
      }
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme, attribute, lightColor, darkColor])

  const setTheme = useCallback(
    (next: Theme, options?: ThemeChangeOptions) => {
      const root = document.documentElement
      const reveal =
        options?.from &&
        typeof document.startViewTransition === 'function' &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reveal && options.from) {
        const point =
          options.from instanceof Element
            ? centre(options.from.getBoundingClientRect())
            : options.from
        root.style.setProperty('--kitr-reveal-x', `${point.x}px`)
        root.style.setProperty('--kitr-reveal-y', `${point.y}px`)
        root.setAttribute('data-kitr-theme-reveal', '')
        const shown: ResolvedTheme =
          next === 'system'
            ? window.matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light'
            : next
        // The attribute is what the CSS reads, so setting it here puts the new theme in the
        // transition's second picture; React's state catches up straight after.
        document
          .startViewTransition(() => {
            root.setAttribute(attribute, shown)
            root.style.colorScheme = shown
          })
          .finished.finally(() => root.removeAttribute('data-kitr-theme-reveal'))
      }
      setThemeState(next)
      try {
        window.localStorage.setItem(storageKey, next)
        // biome-ignore lint/suspicious/noDocumentCookie: a single first-party cookie so the server renders the right theme; no cookie library needed
        document.cookie = `${storageKey}=${next}; path=/; max-age=31536000; samesite=lax`
      } catch {}
    },
    [storageKey, attribute],
  )
  const toggle = useCallback(
    (options?: ThemeChangeOptions) => setTheme(resolved === 'dark' ? 'light' : 'dark', options),
    [resolved, setTheme],
  )
  const value = useMemo(
    () => ({ theme, resolved, setTheme, toggle }),
    [theme, resolved, setTheme, toggle],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

function centre(rect: DOMRect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

/**
 * The current theme and the functions that change it: `{ theme, resolved, setTheme, toggle }`.
 * Throws when no `ThemeProvider` (or the theme provider in `kitrrc.ts`) is above the component.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('[@kitr/theme] useTheme() must be used inside <ThemeProvider>.')
  return ctx
}

/**
 * Inline script for the document head; applies the stored theme before first paint. Its
 * `storageKey`, `attribute` and `tokens` default to `config/theme.ts` (through the theme
 * provider), so the head and the provider always agree. `tokens` are emitted as a `<style>` of
 * `--kitr-*` overrides: `light` on `:root`, `dark` under the dark attribute.
 */
export function ThemeScript(props: {
  storageKey?: string
  attribute?: string
  tokens?: ThemeConfig['tokens']
  /**
   * The Content-Security-Policy nonce for the inline script and style. Default: the nonce
   * `@kitr/shield` made for this request (server-side), so a page under the default policy works
   * as it is; pass one only when you made your own.
   */
  nonce?: string
}) {
  const config = useContext(ThemeConfigContext)
  const storageKey = props.storageKey ?? config?.storageKey ?? 'kitr-theme'
  const attribute = props.attribute ?? config?.attribute ?? 'data-theme'
  const tokens = props.tokens ?? config?.tokens
  const code = `(function(){try{var k=${inlineJson(storageKey)};var t=localStorage.getItem(k)||'system';var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var r=t==='system'?(d?'dark':'light'):t;document.documentElement.setAttribute(${inlineJson(attribute)},r);document.documentElement.style.colorScheme=r}catch(e){}})()`
  const css = tokens ? tokenCss(tokens, attribute) : ''
  // The browser hides a tag's nonce once it has accepted it, so the client's render has none to
  // compare with the server's: that mismatch is expected.
  const nonce = props.nonce ?? requestNonce()
  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, no user input */}
      <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: code }} />
      {css ? (
        <style
          data-kitr-tokens=""
          nonce={nonce}
          suppressHydrationWarning
          // biome-ignore lint/security/noDangerouslySetInnerHtml: config values, `<` escaped
          dangerouslySetInnerHTML={{ __html: css }}
        />
      ) : null}
    </>
  )
}

/**
 * The CSS for `config/theme.ts` tokens. `:root:root` outranks `@kitr/theme/styles.css` (`:root`,
 * `[data-theme="dark"]`) wherever the stylesheet loads. `<` is escaped so a value cannot close the tag.
 */
export function tokenCss(
  tokens: { light?: TokenGroup; dark?: TokenGroup },
  attribute = 'data-theme',
): string {
  let css = ''
  if (tokens.light && Object.keys(tokens.light).length)
    css += defineTokens(tokens.light).css(':root:root')
  if (tokens.dark && Object.keys(tokens.dark).length)
    css += defineTokens(tokens.dark).css(`:root:root[${attribute}="dark"]`)
  return css.replace(/</g, '\\3c ')
}

/** The nonce `@kitr/shield` made for the request being rendered; undefined in the browser and outside a request. `@kitr/server` leaves the reader on `globalThis`. */
function requestNonce(): string | undefined {
  if (typeof window !== 'undefined') return undefined
  const read = (globalThis as unknown as Record<symbol, unknown>)[
    Symbol.for('kitr.server.requestNonce')
  ]
  return typeof read === 'function'
    ? ((read as () => string | undefined)() ?? undefined)
    : undefined
}

/** JSON that is safe inside an inline <script>: `<` can never close the tag. */
function inlineJson(value: string): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}
