import { defineAbilities } from '@kitr/auth'

export interface User {
  id: string
  email: string
  role: 'admin' | 'member'
}

export const abilities = defineAbilities({
  'projects.update': (user: User, project: { ownerId: string }) => user.role === 'admin' || project.ownerId === user.id,
})
