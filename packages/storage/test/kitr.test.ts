import { describe, expect, it } from 'vitest'
import storage from '../src/kitr'

async function storageFile(isServerOnly: boolean) {
  const writes: Record<string, string> = {}
  const ctx = {
    isServerOnly,
    pkg: { name: '@acme/app' },
    write: (file: string, src: string) => {
      writes[file] = src
    },
    config() {},
    provider: { add() {} },
    agents: { add() {} },
  }
  await storage.add!(ctx as any)
  return writes['app/storage.ts']!
}

describe('kitr add storage', () => {
  it('declares only the locale cookie; defineStorage is a commented example', async () => {
    const file = await storageFile(false)
    expect(file).toContain('export const localeCookie = defineCookie(')
    expect(file).not.toMatch(/^export const (sidebar|recentSearches)/m)
    expect(file).toContain(" *   export const sidebar = defineStorage('sidebar'")
  })

  it('writes the cookie alone in a server-only project', async () => {
    const file = await storageFile(true)
    expect(file).toContain('export const localeCookie')
    expect(file).not.toContain('defineStorage')
  })
})
