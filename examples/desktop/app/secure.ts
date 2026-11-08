import { defineSecureItem } from 'kitr/secure-storage'

/** Secrets, typed once: `useSecureItem(sessionItem)` in components, `sessionItem(storage).get()` elsewhere. */
export const sessionItem = defineSecureItem<{ token: string; expiresAt: number }>('session')
