import { describe, expectTypeOf, it } from 'vitest'
import { type AbilityName, defineAbilities } from '../src'

interface User {
  id: string
}
interface Project {
  ownerId: string
}

describe('ability types', () => {
  const abilities = defineAbilities({
    'projects.update': (user: User, project: Project) => project.ownerId === user.id,
    'admin.view': (user: User) => !!user.id,
  })

  it('keeps ability names and the user type when checks annotate the user', () => {
    expectTypeOf<AbilityName<typeof abilities>>().toEqualTypeOf<'projects.update' | 'admin.view'>()
    abilities.can({ id: '1' }, 'projects.update', { ownerId: '1' })
    // @ts-expect-error unknown ability
    abilities.can({ id: '1' }, 'projects.delete')
    // @ts-expect-error wrong subject
    abilities.can({ id: '1' }, 'projects.update', { owner: '1' })
    // @ts-expect-error wrong user
    abilities.can({ name: 'x' }, 'admin.view')
    abilities.can(null, 'admin.view')
    const can = abilities.for(null)
    can('admin.view')
  })

  it('still accepts the explicit user form', () => {
    const loose = defineAbilities<User>({
      'projects.update': (user, project: Project) => project.ownerId === user.id,
    })
    expectTypeOf(loose.can).toBeFunction()
    loose.can({ id: '1' }, 'projects.update', { ownerId: '1' })
  })
})
