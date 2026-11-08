import { describe, expect, it } from 'vitest'
import generator, { renderActions, scanActions } from '../src/types'

const ctx = {
  root: '/p',
  rc: { packages: [], providers: [], directories: { app: 'app' }, platforms: {} },
  importPath: (file: string) => `../${file.replace(/\.tsx?$/, '')}`,
  exists: () => true,
  read: () => '',
  glob: () => [],
}

const FILE = 'app/actions/projects.ts'
const scan = (source: string, extra: Record<string, string> = {}) =>
  scanActions([{ file: FILE, source }], { root: '/p', files: extra })

describe('scanActions', () => {
  it('finds exported defineQuery and defineMutation calls, ignoring comments and strings', async () => {
    const src = `
import { defineMutation, defineQuery } from 'kitr/actions'
// export const old = defineQuery('projects.old', { handler: () => 1 })
/* export const older = defineMutation('projects.older', { handler: () => 1 }) */
const note = "export const fake = defineQuery('nope'"
export const listProjects = defineQuery('projects.list', { handler: () => [] })
export const updateProject: ServerMutation<any, any> = defineMutation<typeof schema, Project>("projects.update", {
  input: schema,
  handler: ({ input }) => input,
})
const internal = defineQuery('projects.internal', { handler: () => 1 })
`
    expect(await scan(src)).toEqual([
      { file: FILE, exportName: 'listProjects', name: 'projects.list', kind: 'query' },
      { file: FILE, exportName: 'updateProject', name: 'projects.update', kind: 'mutation' },
    ])
  })

  it('follows import aliases, namespace imports, export lists and renamed exports', async () => {
    const src = `
import * as k from '@kitr/actions'
import { defineQuery as query, defineMutation } from 'kitr/actions'
const listProjects = query('projects.list', { handler: () => [] })
const rename = defineMutation(\`projects.rename\`, { handler: () => 1 })
export const archive = (k.defineMutation('projects.archive', { handler: () => 1 }) as const)
export { listProjects, rename as renameProject }
`
    expect(await scan(src)).toEqual([
      { file: FILE, exportName: 'archive', name: 'projects.archive', kind: 'mutation' },
      { file: FILE, exportName: 'listProjects', name: 'projects.list', kind: 'query' },
      { file: FILE, exportName: 'renameProject', name: 'projects.rename', kind: 'mutation' },
    ])
  })

  it('resolves the callee by symbol through re-exports, and ignores lookalikes', async () => {
    const extra = {
      'node_modules/@kitr/actions/index.d.ts':
        'export declare function defineQuery(name: string, options: object): { kind: "query" }',
      'node_modules/kitr/actions.d.ts': "export * from '@kitr/actions'",
      'app/lib/ops.ts':
        "import { defineQuery } from 'kitr/actions'\nexport const shared = defineQuery('shared.list', {})",
      'app/lib/define.ts':
        'export function defineQuery(name: string, o: object) { return { name, o } }',
    }
    const src = `
import { defineQuery } from '../lib/define'
export const listProjects = defineQuery('projects.list', {})
export { shared } from '../lib/ops'
export { shared as again } from '../lib/ops'
`
    const found = await scan(src, extra)
    // `defineQuery` from ../lib/define is not the kitr one; the re-exported one is.
    expect(found.map((op) => [op.exportName, op.name])).toEqual([
      ['shared', 'shared.list'],
      ['again', 'shared.list'],
    ])
  })

  it('names the file and line when an operation name is not a string literal', async () => {
    const src = `import { defineQuery } from 'kitr/actions'
const name = 'projects.list'
export const listProjects = defineQuery(name, { handler: () => [] })
`
    await expect(scan(src)).rejects.toThrow(
      /app\/actions\/projects\.ts:3: .*must be a string literal/,
    )
  })
})

describe('renderActions', () => {
  it('writes the operations map, the actions tree and the Operations augmentation', () => {
    const out = renderActions(
      [
        {
          file: 'app/actions/projects.ts',
          exportName: 'listProjects',
          name: 'projects.list',
          kind: 'query',
        },
        {
          file: 'app/actions/projects.ts',
          exportName: 'updateProject',
          name: 'projects.update',
          kind: 'mutation',
        },
        {
          file: 'app/actions/auth/sign-in.ts',
          exportName: 'signIn',
          name: 'signIn',
          kind: 'mutation',
        },
      ],
      ctx,
    )
    expect(out).toContain("import * as m0 from '../app/actions/auth/sign-in'")
    expect(out).toContain("import * as m1 from '../app/actions/projects'")
    expect(out).toContain("  'projects.list': m1.listProjects,")
    expect(out).toContain('  signIn: m0.signIn,')
    expect(out).toContain(
      '  projects: {\n    list: m1.listProjects,\n    update: m1.updateProject,\n  },',
    )
    expect(out).toContain("    'projects.update': typeof m1.updateProject")
    expect(out).toMatch(/declare module '@kitr\/core' \{\n {2}interface Operations \{/)
  })

  it('renders an empty registry without imports', () => {
    const out = renderActions([], ctx)
    expect(out).not.toContain('import')
    expect(out).toContain('export const operations = {} as const')
    expect(out).toContain('export const actions = {}')
  })

  it('rejects duplicate, invalid and nested names', () => {
    const op = (name: string, file = 'a.ts', exportName = 'x') =>
      ({ file, exportName, name, kind: 'query' }) as const
    expect(() => renderActions([op('a.b'), op('a.b', 'b.ts', 'y')], ctx)).toThrow(/defined twice/)
    expect(() => renderActions([op('projects/list')], ctx)).toThrow(/not a valid name/)
    expect(() => renderActions([op('projects'), op('projects.list', 'b.ts')], ctx)).toThrow(
      /both an operation and a group/,
    )
  })
})

describe('the generator', () => {
  it('reads app/actions (or directories.actions), skipping tests and declarations', async () => {
    const files: Record<string, string> = {
      'app/actions/projects.ts':
        "import { defineQuery } from 'kitr/actions'\nexport const listProjects = defineQuery('projects.list', { handler: () => [] })",
      'app/actions/projects.test.ts':
        "export const nope = defineQuery('projects.nope', { handler: () => [] })",
      'app/actions/env.d.ts':
        "export const nope2 = defineQuery('projects.nope2', { handler: () => [] })",
    }
    const seen: string[] = []
    const out = await generator.generate({
      ...ctx,
      glob: (dir) => {
        seen.push(dir)
        return Object.keys(files)
      },
      read: (file) => files[file]!,
    })
    expect(seen).toEqual(['app/actions'])
    expect(out[0]!.file).toBe('actions.ts')
    expect(out[0]!.content).toContain("'projects.list'")
    expect(out[0]!.content).not.toContain('nope')
    expect(
      (generator.watch as (rc: any) => string[])({ directories: { actions: 'src/ops' } }),
    ).toEqual(['src/ops/**/*.{ts,tsx}'])
  })
})
