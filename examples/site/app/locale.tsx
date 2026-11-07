import { I18nextProvider, useTranslation } from 'kitr/i18n'
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { type Locale, localeCookie } from '#app/storage'

interface LocaleState {
  locale: Locale
  setLocale: (next: Locale) => void
}

const LocaleContext = createContext<LocaleState | null>(null)

/**
 * Renders the tree in one language per request.
 *
 * The root loader reads the cookie on the server, so streamed pages arrive in the right language
 * and hydrate without mismatches. Prerendered pages are built in the default language and catch up
 * in an effect after hydration, which is safe because the update lands after React has matched the markup.
 */
export function LocaleProvider({ initial, children }: { initial: Locale; children: ReactNode }) {
  const { i18n } = useTranslation()
  const [locale, setLocaleState] = useState<Locale>(initial)
  const instance = useMemo(() => i18n.cloneInstance({ lng: locale }), [i18n, locale])

  useEffect(() => {
    setLocaleState(localeCookie.get())
  }, [])

  const value = useMemo<LocaleState>(
    () => ({
      locale,
      setLocale(next) {
        localeCookie.set(next)
        setLocaleState(next)
      },
    }),
    [locale],
  )

  return (
    <LocaleContext.Provider value={value}>
      <I18nextProvider i18n={instance}>{children}</I18nextProvider>
    </LocaleContext.Provider>
  )
}

export function useLocale(): LocaleState {
  const state = useContext(LocaleContext)
  if (!state) throw new Error('useLocale() needs <LocaleProvider> above it')
  return state
}
