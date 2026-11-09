import { defineStorage } from '@kitr/storage'

/** Whether the sidebar is collapsed. A new `version` with `migrate` reshapes old saved values. */
export const sidebar = defineStorage('sidebar', { default: { collapsed: false }, version: 1 })

/** The last few searches, forgotten a minute after they were saved. */
export const recent = defineStorage<string[]>('recent-searches', { default: [], ttl: 60_000 })
