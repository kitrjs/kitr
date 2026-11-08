import { defineCookie } from '@kitr/storage'

export type Locale = 'en' | 'de'

/** The visitor's language choice. A cookie, so the server can render the right language on the first byte. */
export const localeCookie = defineCookie<Locale>('locale', {
  default: 'en',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
})
