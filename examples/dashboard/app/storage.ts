import { defineCookie } from '@kitr/storage'

/**
 * Every persisted value, in one file, typed. Components read them with
 * `useStorage(item)` / `useCookie(item)` from @kitr/storage/react; plain code with `item.get()`.
 * A local or session storage value is declared the same way:
 *
 *   import { defineStorage } from '@kitr/storage'
 *
 *   export const sidebar = defineStorage('sidebar', { default: { collapsed: false } })
 *   export const recentSearches = defineStorage<string[]>('recent-searches', {
 *     default: [],
 *     area: 'session',
 *   })
 */

/** Readable on the server too (`localeCookie.get(request.headers)`), so SSR picks the right locale. */
export const localeCookie = defineCookie('locale', { default: 'en', maxAge: 60 * 60 * 24 * 365 })
