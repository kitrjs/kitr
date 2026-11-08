import { defineStorage } from '@kitr/storage'

/** The notes a visitor wrote, kept in localStorage: the dashboard has no server, so this is its record store. */
export const notes = defineStorage<string[]>('e2e:notes', { default: [] })
