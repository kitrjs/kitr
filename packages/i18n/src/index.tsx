import { createDefineConfig } from '@kitr/core'
import i18next, { type InitOptions, type i18n } from 'i18next'
import { initReactI18next } from 'react-i18next'

export * from 'react-i18next'
export { i18next }

/**
 * The options in `config/i18n.ts`: your strings per locale, the fallback locale and detection.
 * Any other i18next init option passes straight through.
 */
export interface I18nConfig extends Omit<InitOptions, 'resources' | 'lng'> {
  /** Every locale's strings, keyed by locale then namespace: `{ en: { common: { hello: 'Hello' } } }`. */
  resources: Record<string, Record<string, Record<string, unknown>>>
  /** The locale used when nothing better matches, and the fallback for missing keys. */
  defaultLocale: string
  /** The locales the app supports. Default: the keys of `resources`. */
  locales?: string[]
  /** Detect from `navigator.language` (client) or `Accept-Language` (server). Default true. */
  detect?: boolean
  /** Query/cookie/storage key for an explicit choice. Default `locale`. */
  storageKey?: string
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    i18n: I18nConfig
  }
  interface ContainerBindings {
    i18n: i18n
  }
}

/** Types `config/i18n.ts`. Returns the object you pass, unchanged. */
export const defineConfig = createDefineConfig<I18nConfig>()

/** Keys of a resource bundle as `namespace:key.path` strings, for typed `t()`. */
export type TranslationKeys<R, Prefix extends string = ''> = {
  [K in keyof R & string]: R[K] extends string
    ? `${Prefix}${K}`
    : TranslationKeys<R[K], `${Prefix}${K}.`>
}[keyof R & string]

/**
 * Creates an isolated i18next instance from your config, already initialised with react-i18next.
 * The locale is `initialLocale`, else the detected one when `detect` is on, else `defaultLocale`.
 */
export function createI18n(config: I18nConfig, initialLocale?: string): i18n {
  const {
    resources,
    defaultLocale,
    locales,
    detect = true,
    storageKey = 'locale',
    ...rest
  } = config
  const supported = locales ?? Object.keys(resources)
  const instance = i18next.createInstance()
  const locale =
    initialLocale ?? (detect ? detectLocale(supported, storageKey) : undefined) ?? defaultLocale
  instance.use(initReactI18next).init({
    resources,
    lng: locale,
    fallbackLng: defaultLocale,
    supportedLngs: supported,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    ...rest,
  })
  return instance
}

/**
 * In the browser, the saved choice under `storageKey` in localStorage, else the best match for
 * `navigator.languages`. Returns `undefined` on the server or when nothing matches.
 */
export function detectLocale(supported: string[], storageKey = 'locale'): string | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (stored && supported.includes(stored)) return stored
  } catch {}
  return matchLocale(navigator.languages ?? [navigator.language], supported)
}

/** Pick the best supported locale from an `Accept-Language` header (server) or a language list. */
export function matchLocale(
  candidates: string | readonly string[],
  supported: string[],
): string | undefined {
  const list =
    typeof candidates === 'string'
      ? candidates
          .split(',')
          .map((p) => p.trim().split(';')[0]!)
          .filter(Boolean)
      : candidates
  for (const lang of list) {
    if (supported.includes(lang)) return lang
    const short = lang.split('-')[0]!
    const hit = supported.find((s) => s === short || s.startsWith(`${short}-`))
    if (hit) return hit
  }
  return undefined
}
