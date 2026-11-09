import { describe, expect, it } from 'vitest'
import testing from '../src/kitr'

/** Run `kitr add testing` against a recording context; `files` are what the project already has. */
async function add(files: Record<string, string>, deps: string[] = ['react']) {
  const writes: Record<string, string> = {}
  const ctx = {
    pm: 'pnpm',
    rc: { directories: { app: 'app' } },
    has: (name: string) => deps.includes(name),
    hasPackage: (name: string) => deps.includes(name),
    exists: (file: string) => file in files,
    read: (file: string) => files[file]!,
    write: (file: string, src: string) => {
      writes[file] = src
    },
    deps: { add() {} },
    scripts: { add() {} },
    agents: { add() {} },
  }
  await testing.add!(ctx as any)
  return writes
}

const starter = {
  'app/app.ts': 'export const app = createApp()',
  'app/pages/home.tsx': '<h1 className="text-3xl">acme is running</h1>',
}

describe('kitr add testing', () => {
  it('renders the starter home page with renderWithKitr instead of a 1 + 1 test', async () => {
    const writes = await add(starter)
    const test = writes['test/home.test.tsx']!
    expect(test).toContain("import { renderWithKitr } from '@kitr/testing/react'")
    expect(test).toContain('renderWithKitr(<HomePage />, { app })')
    expect(test).toContain("getByRole('heading', { level: 1 })")
    expect(writes['test/example.test.ts']).toBeUndefined()
  })

  it('boots the app when the home page is not the starter', async () => {
    const writes = await add({ ...starter, 'app/pages/home.tsx': '<Link to="/pricing" />' })
    expect(writes['test/home.test.tsx']).toBeUndefined()
    expect(writes['test/example.test.ts']).toContain('await createTestApp()')
    expect(writes['test/example.test.ts']).not.toContain('1 + 1')
  })

  it('tests the API in a server-only project', async () => {
    const writes = await add({}, ['@kitr/server'])
    expect(writes['test/example.test.ts']).toContain("client.get<{ ok: boolean }>('/api/health')")
  })
})
