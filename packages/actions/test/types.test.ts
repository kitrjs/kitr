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

describe('scanActions', () => {
  it('finds exported defineQuery and defineMutation calls, ignoring comments and strings', () => {
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
    expect(scanActions('app/actions/projects.ts', src)).toEqual([
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
    ])
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
        "export const listProjects = defineQuery('projects.list', { handler: () => [] })",
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
