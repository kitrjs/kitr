import { defineSecureItem } from '@kitr/secure-storage'

/** The note from the home page, typed once. Stored in the OS vault on every shell that has one. */
export const noteItem = defineSecureItem<string>('note')
