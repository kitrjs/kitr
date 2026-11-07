import { describe, expect, it } from 'vitest'
import actions from '../src/kitr'

const project = { rc: { directories: { app: 'app' } } } as any

describe('actions setup module', () => {
  it('writes queries and mutations under app/actions/<feature>, named after both', () => {
    const query = actions.generators!.query!
    expect(query.target('projects/list', project, {})).toEqual({
      file: 'app/actions/projects/list.ts',
      vars: { feature: 'projects', name: 'list' },
    })
    const src = query.stub({ feature: 'projects', name: 'list' })
    expect(src).toContain("import { defineQuery } from 'kitr/actions'")
    expect(src).toContain("defineQuery('projects.list', {")
    const mutation = actions.generators!.mutation!.stub({ feature: 'projects', name: 'archive' })
    expect(mutation).toContain("defineMutation('projects.archive', {")
    expect(mutation).toContain('effects:')
  })

  it('honours the actions directory and declares its types generator', () => {
    const custom = { rc: { directories: { app: 'src', actions: 'src/ops' } } } as any
    expect(actions.generators!.mutation!.target('archive', custom, {}).file).toBe(
      'src/ops/app/archive.ts',
    )
    expect(actions.types).toBeTypeOf('function')
    expect(actions.requires).toEqual(['server', 'query'])
  })
})
