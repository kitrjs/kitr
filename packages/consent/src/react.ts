import { useApp } from '@kitr/react'
import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { Consent, ConsentCategory, ConsentRecord } from './index'

/**
 * The consent record and the actions a banner needs; re-renders when the choice changes. The
 * server cannot read the choice, so the server render and the hydrating render both see
 * "undecided", and the stored choice arrives right after: no hydration mismatch.
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
  const version = consent.get().version
  const undecided = useMemo<ConsentRecord>(() => ({ granted: ['necessary'], version }), [version])
  const record = useSyncExternalStore(
    useCallback((notify) => consent.subscribe(() => notify()), [consent]),
    () => consent.get(),
    () => undecided,
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
