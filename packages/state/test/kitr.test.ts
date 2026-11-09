import { describe, expect, it } from 'vitest'
import state from '../src/kitr'

const store = state.generators.store

function fakeCtx(files: string[]) {
  const present = new Set(files)
  return {
    rc: { directories: { app: 'app' } },
    exists: (file: string) => present.has(file),
    unlink: (file: string) => present.delete(file),
    present,
  }
}

describe('make:store', () => {
  it('removes the app/stores/.gitkeep placeholder once the first store is written', async () => {
    const ctx = fakeCtx(['app/stores/.gitkeep'])
    await store.after!(ctx as any, { file: 'app/stores/filters.ts', vars: { name: 'filters' } })
    expect(ctx.present.has('app/stores/.gitkeep')).toBe(false)
  })

  it('does nothing when the placeholder is already gone', async () => {
    const ctx = fakeCtx([])
    await store.after!(ctx as any, { file: 'app/stores/drafts.ts', vars: { name: 'drafts' } })
    expect(ctx.present.size).toBe(0)
  })
})
