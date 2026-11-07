import { isRedirect } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'
import { can, guards, requireAuth } from '../src/guards'

const caught = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    return e as any
  }
  throw new Error('expected a throw')
}

describe('requireAuth', () => {
  const location = { href: '/projects/1?tab=a' }

  it('lets signed-in users through and returns the session for context', () => {
    const session = { user: { id: 1 } }
    expect(requireAuth()({ context: { session }, location })).toEqual({ session })
  })

  it('redirects anonymous users to sign-in, remembering where they were going', () => {
    const r = caught(() => requireAuth()({ context: { session: null }, location }))
    expect(isRedirect(r)).toBe(true)
    expect(r.options.to).toBe('/sign-in')
    expect(r.options.search).toEqual({ redirect: '/projects/1?tab=a' })
  })

  it('supports a custom target and param, or no param', () => {
    const custom = caught(() =>
      requireAuth({ to: '/login', redirectParam: 'next' })({ context: {}, location }),
    )
    expect(custom.options).toMatchObject({ to: '/login', search: { next: '/projects/1?tab=a' } })
    const none = caught(() =>
      requireAuth({ redirectParam: false })({ context: { session: { user: null } }, location }),
    )
    expect(none.options.search).toBeUndefined()
  })
})

describe('can', () => {
  const session = { user: { id: 1 }, can: (p: string, s?: unknown) => p === 'read' || s === 'mine' }

  it('passes when the session allows it', () => {
    expect(() => can('read')({ context: { session } })).not.toThrow()
    expect(() => can('edit', { subject: 'mine' })({ context: { session } })).not.toThrow()
  })

  it('throws FORBIDDEN, or redirects when asked', () => {
    expect(caught(() => can('edit')({ context: { session } }))).toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    })
    expect(caught(() => can('edit')({ context: {} })).code).toBe('FORBIDDEN')
    const r = caught(() => can('edit', { to: '/upgrade' })({ context: { session } }))
    expect(isRedirect(r)).toBe(true)
    expect(r.options.to).toBe('/upgrade')
  })
})

describe('guards', () => {
  it('runs in order, merges returned context and stops at the first throw', async () => {
    const order: string[] = []
    const all = guards<{ n: number }>(
      async () => {
        order.push('a')
        return { a: 1 }
      },
      () => {
        order.push('b')
        return undefined
      },
      () => {
        order.push('c')
        return { c: 3, a: 2 }
      },
    )
    expect(await all({ n: 1 })).toEqual({ a: 2, c: 3 })
    expect(order).toEqual(['a', 'b', 'c'])
    const failing = guards(
      () => {
        throw new Error('stop')
      },
      () => order.push('never'),
    )
    await expect(failing({})).rejects.toThrow('stop')
    expect(order).not.toContain('never')
  })
})
