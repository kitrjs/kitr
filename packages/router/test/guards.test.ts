import { isNotFound, isRedirect } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'
import { can, guards, onlyPlatform, requireAuth } from '../src/guards'

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

  // Regression: `signInPath` in config/auth.ts was read by nothing, so a guard still sent
  // anonymous visitors to /sign-in, a page the app did not have.
  it('defaults to signInPath from config/auth.ts', async () => {
    const { createApp } = await import('@kitr/core')
    const app = createApp({ environment: 'test', config: { auth: { signInPath: '/login' } } })
    const r = caught(() => requireAuth()({ context: { session: null, app }, location }))
    expect(r.options.to).toBe('/login')
    const explicit = caught(() =>
      requireAuth({ to: '/elsewhere' })({ context: { session: null, app }, location }),
    )
    expect(explicit.options.to).toBe('/elsewhere')
    const noAuthConfig = createApp({ environment: 'test' })
    const fallback = caught(() =>
      requireAuth()({ context: { session: null, app: noAuthConfig }, location }),
    )
    expect(fallback.options.to).toBe('/sign-in')
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

describe('onlyPlatform', () => {
  it('passes on a matching name, type, OS or native, from the platform service in context', () => {
    const platform = { name: 'phone', type: 'mobile', os: 'ios', native: true }
    expect(onlyPlatform('phone')({ context: { platform } })).toBeUndefined()
    expect(onlyPlatform(['www', 'mobile'])({ context: { platform } })).toBeUndefined()
    expect(onlyPlatform('ios')({ context: { platform } })).toBeUndefined()
    expect(onlyPlatform('native')({ context: { platform } })).toBeUndefined()
  })

  it('renders not-found elsewhere, or redirects with `to`', () => {
    const platform = { name: 'www', type: 'web', os: 'macos', native: false }
    const nf = caught(() => onlyPlatform('phone')({ context: { platform } }))
    expect(isNotFound(nf)).toBe(true)
    const r = caught(() => onlyPlatform('native', { to: '/download' })({ context: { platform } }))
    expect(isRedirect(r)).toBe(true)
    expect(r.options.to).toBe('/download')
  })

  it('falls back to the build platform when no service is in context', () => {
    process.env.KITR_PLATFORM = 'admin'
    process.env.KITR_PLATFORM_TYPE = 'web'
    try {
      expect(onlyPlatform('admin')({ context: {} })).toBeUndefined()
      expect(onlyPlatform('web')({ context: {} })).toBeUndefined()
      expect(isNotFound(caught(() => onlyPlatform('phone')({ context: {} })))).toBe(true)
    } finally {
      delete process.env.KITR_PLATFORM
      delete process.env.KITR_PLATFORM_TYPE
    }
  })
})
