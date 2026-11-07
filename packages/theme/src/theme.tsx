import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

export type Theme = 'light' | 'dark' | 'system'
export { themeFromCookie } from './cookie'

export type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  resolved: ResolvedTheme
  setTheme: (theme: Theme) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export interface ThemeProviderProps {
  children: ReactNode
  defaultTheme?: Theme
  storageKey?: string
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
    (next: Theme) => {
      setThemeState(next)
      try {
        window.localStorage.setItem(storageKey, next)
        // biome-ignore lint/suspicious/noDocumentCookie: a single first-party cookie so the server renders the right theme; no cookie library needed
        document.cookie = `${storageKey}=${next}; path=/; max-age=31536000; samesite=lax`
      } catch {}
    },
    [storageKey],
  )
  const toggle = useCallback(
    () => setTheme(resolved === 'dark' ? 'light' : 'dark'),
    [resolved, setTheme],
  )
  const value = useMemo(
    () => ({ theme, resolved, setTheme, toggle }),
    [theme, resolved, setTheme, toggle],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('[kitr/theme] useTheme() must be used inside <ThemeProvider>.')
  return ctx
}

/** Inline script for the document head; applies the stored theme before first paint. */
export function ThemeScript({
  storageKey = 'kitr-theme',
  attribute = 'data-theme',
}: {
  storageKey?: string
  attribute?: string
}) {
  const code = `(function(){try{var k=${inlineJson(storageKey)};var t=localStorage.getItem(k)||'system';var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var r=t==='system'?(d?'dark':'light'):t;document.documentElement.setAttribute(${inlineJson(attribute)},r);document.documentElement.style.colorScheme=r}catch(e){}})()`
  // biome-ignore lint/security/noDangerouslySetInnerHtml: static, no user input
  return <script dangerouslySetInnerHTML={{ __html: code }} />
}

/** JSON that is safe inside an inline <script>: `<` can never close the tag. */
function inlineJson(value: string): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}
