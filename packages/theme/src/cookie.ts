import type { ResolvedTheme } from './theme'

/** Read the theme cookie on the server to pass as `initialResolved`. */
export function themeFromCookie(
  cookieHeader: string | null | undefined,
  storageKey = 'kitr-theme',
): ResolvedTheme | undefined {
  const name = storageKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = cookieHeader?.match(new RegExp(`(?:^|;\\s*)${name}=(light|dark)`))
  return match?.[1] as ResolvedTheme | undefined
}
