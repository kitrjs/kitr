import { useApp } from '@kitr/react'
import { useCallback, useSyncExternalStore } from 'react'
import type { Consent, ConsentCategory, ConsentRecord } from './index'

/**
 * The consent record and the actions a banner needs; re-renders when the choice changes. The
 * server always sees "undecided" while the browser reads the cookie on its first render, so in
 * server-rendered apps render the banner only after mount.
 */
export function useConsent(): {
  record: ConsentRecord
  decided: boolean
  has: (category: ConsentCategory) => boolean
  categories: ConsentCategory[]
  grant: Consent['grant']
  acceptAll: () => void
  rejectAll: () => void
  reset: () => void
} {
  const consent = useApp().container.use('consent')
  const record = useSyncExternalStore(
    useCallback((notify) => consent.subscribe(() => notify()), [consent]),
    () => consent.get(),
    () => consent.get(),
  )
  return {
    record,
    decided: record.decidedAt !== undefined,
    has: (category) => category === 'necessary' || record.granted.includes(category),
    categories: consent.categories,
    grant: consent.grant,
    acceptAll: consent.acceptAll,
    rejectAll: consent.rejectAll,
    reset: consent.reset,
  }
}
