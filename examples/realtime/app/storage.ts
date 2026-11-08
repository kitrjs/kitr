import { defineStorage } from '@kitr/storage'

/** The display name, remembered between visits. */
export const displayName = defineStorage('chat:name', { default: '' })
