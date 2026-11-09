import { describe, expect, it, vi } from 'vitest'

// TypeScript 7's `typescript` package is the native compiler: its JS entry exports only the version.
vi.mock('typescript', () => {
  const ts7 = { version: '7.0.2', versionMajorMinor: '7.0' }
  return { ...ts7, default: ts7 }
})

const { scanActions } = await import('../src/types')

describe('scanActions on TypeScript 7', () => {
  it('falls back to the @typescript/typescript6 compiler API', async () => {
    const source = `
import { defineQuery } from '@kitr/actions'
export const listProjects = defineQuery('projects.list', { handler: () => [] })
`
    expect(
      await scanActions([{ file: 'app/actions/projects.ts', source }], { root: '/p' }),
    ).toEqual([
      {
        file: 'app/actions/projects.ts',
        exportName: 'listProjects',
        name: 'projects.list',
        kind: 'query',
      },
    ])
  })
})
