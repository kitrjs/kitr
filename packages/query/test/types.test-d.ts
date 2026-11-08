import type { KitrApp, MutationName, OperationInput, OperationOf, QueryName } from '@kitr/core'
import { describe, expectTypeOf, it } from 'vitest'
import { call, mutationFrom, queryFrom, queryOptions, useMutation, useQuery } from '../src'

declare const app: KitrApp

/**
 * What `kitr types` writes into `.kitr/actions.ts`, by hand: two names augmenting `Operations`.
 */
const listProjects = queryFrom<{ owner?: string }, string[]>({
  key: (input) => ['projects', input?.owner ?? 'all'],
  fetch: async () => [],
  source: 'action',
})
const updateProject = mutationFrom<{ id: string; name: string }, { id: string }>({
  mutate: async ({ id }) => ({ id }),
})

declare module '@kitr/core' {
  interface Operations {
    'projects.list': typeof listProjects & { name: 'projects.list'; contract: unknown }
    'projects.update': typeof updateProject & { name: 'projects.update'; contract: unknown }
  }
}

describe('name-keyed operations', () => {
  it('splits names by kind and reads the input type', () => {
    expectTypeOf<QueryName>().toEqualTypeOf<'projects.list'>()
    expectTypeOf<MutationName>().toEqualTypeOf<'projects.update'>()
    expectTypeOf<OperationInput<OperationOf<'projects.update'>>>().toEqualTypeOf<{
      id: string
      name: string
    }>()
  })

  it('types useQuery, queryOptions and call by name', () => {
    expectTypeOf(useQuery('projects.list', { owner: 'ada' }).data).toEqualTypeOf<
      string[] | undefined
    >()
    // input is optional when every field is
    useQuery('projects.list')
    expectTypeOf(queryOptions(app, 'projects.list').queryKey).toMatchTypeOf<readonly unknown[]>()
    expectTypeOf(call(app, 'projects.list')).resolves.toEqualTypeOf<string[]>()
    expectTypeOf(call(app, 'projects.update', { id: '1', name: 'x' })).resolves.toEqualTypeOf<{
      id: string
    }>()
    // @ts-expect-error unknown name
    useQuery('projects.nope')
    // @ts-expect-error a mutation is not a query
    useQuery('projects.update')
    // @ts-expect-error input is required
    call(app, 'projects.update')
  })

  it('types useMutation by name and by definition', () => {
    const m = useMutation('projects.update')
    expectTypeOf(m.mutateAsync).parameter(0).toEqualTypeOf<{ id: string; name: string }>()
    expectTypeOf(useMutation(updateProject).data).toEqualTypeOf<{ id: string } | undefined>()
    // @ts-expect-error a query is not a mutation
    useMutation('projects.list')
  })
})
