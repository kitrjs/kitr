import { describe, expect, it } from 'vitest'
import { createAuth, defineAbilities, tokenAdapter } from '../src'
import { authMiddleware, can, requireUser } from '../src/server'

interface User {
  id: string
  role: 'admin' | 'member'
}
const abilities = defineAbilities<User>({
  'projects.update': (user, project: { ownerId: string }) =>
    user.role === 'admin' || project.ownerId === user.id,
})

describe('auth client', () => {
  it('token adapter signs in, exposes session, refreshes and signs out', async () => {
    let currentToken = 't1'
    const adapter = tokenAdapter<User>({
      abilities,
      fetchUser: async (token) => (token === currentToken ? { id: 'u1', role: 'member' } : null),
      signIn: async () => ({ token: 't1', refreshToken: 'r1' }),
      refresh: async (rt) => {
        if (rt !== 'r1') return null
        currentToken = 't2'
        return { token: currentToken }
      },
    })
    const auth = createAuth(adapter)
    expect((await auth.load()).user).toBeNull()
    const session = await auth.signIn({ email: 'a', password: 'b' })
    expect(session.user?.id).toBe('u1')
    expect(session.can('projects.update', { ownerId: 'u1' })).toBe(true)
    expect(session.can('projects.update', { ownerId: 'u2' })).toBe(false)
    expect(await auth.getToken()).toBe('t1')
    expect(await auth.refresh()).toBe(true)
    expect(await auth.getToken()).toBe('t2')
    const seen: unknown[] = []
    auth.subscribe((s) => seen.push(s.user))
    await auth.signOut()
    expect(seen).toEqual([null])
    expect(auth.toContext().session.user).toBeNull()
  })
})

describe('auth server middleware', () => {
  const mw = authMiddleware<User>({
    verify: (token) => (token === 'ok' ? { id: 'u1', role: 'member' } : null),
    abilities,
  })
  const ctx = (header: string | null) => ({
    request: { header: () => header },
    locals: {} as Record<string, unknown>,
  })

  it('rejects anonymous, accepts bearer', async () => {
    await expect(mw(ctx(null), async () => 'next')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    const c = ctx('Bearer ok')
    expect(await mw(c, async () => 'next')).toBe('next')
    expect(requireUser<User>(c).id).toBe('u1')
    await expect(
      can('projects.update', () => ({ ownerId: 'other' }))(c, async () => 1),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(await can('projects.update', () => ({ ownerId: 'u1' }))(c, async () => 1)).toBe(1)
  })
})
