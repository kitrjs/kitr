import { createApp } from '@kitr/core'
import { KitrProvider } from '@kitr/react'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  betterAuthAdapter,
  createAuth,
  customAdapter,
  defineAbilities,
  localStorageTokens,
  tokenAdapter,
} from '../src'
import { useAuth, useCan, useSession, useUser } from '../src/hooks'
import authProvider from '../src/provider'
import { createSession } from '../src/session'

interface User {
  id: string
  role: 'admin' | 'member'
}
const abilities = defineAbilities<User>({
  'projects.delete': (user) => user.role === 'admin',
})

function adapterWith(user: User | null) {
  let current = user
  return customAdapter<User, { id: string }>({
    getSession: async () => (current ? createSession(current, abilities) : null),
    signIn: async ({ id }) => {
      current = { id, role: 'admin' }
      return createSession(current, abilities)
    },
    signOut: async () => {
      current = null
    },
  })
}

async function bootWith(adapter: ReturnType<typeof adapterWith>, eager?: boolean) {
  const app = createApp({ providers: [authProvider], config: { auth: { adapter, eager } } })
  await app.boot()
  return app
}

function Who() {
  const user = useUser<User>()
  const can = useCan()
  const session = useSession()
  const auth = useAuth()
  return (
    <div>
      <p>{user ? `user ${user.id}` : 'anonymous'}</p>
      <p>{can('projects.delete') ? 'can delete' : 'cannot delete'}</p>
      <p>{session === auth.session ? 'same session' : 'stale session'}</p>
    </div>
  )
}

describe('auth provider', () => {
  it('restores the session during boot when eager (default)', async () => {
    const app = await bootWith(adapterWith({ id: 'u1', role: 'member' }))
    expect(app.container.use('auth').user).toEqual({ id: 'u1', role: 'member' })
  })

  it('defers loading when eager is false', async () => {
    const app = await bootWith(adapterWith({ id: 'u1', role: 'member' }), false)
    expect(app.container.use('auth').user).toBeNull()
    await app.container.use('auth').load()
    expect(app.container.use('auth').user?.id).toBe('u1')
  })

  it('boot survives an adapter whose getSession rejects', async () => {
    const adapter = customAdapter({ getSession: () => Promise.reject(new Error('network down')) })
    const app = createApp({ providers: [authProvider], config: { auth: { adapter } } })
    await expect(app.boot()).resolves.toBeDefined()
    expect(app.container.use('auth').session.can('anything')).toBe(false)
  })
})

describe('auth hooks', () => {
  it('re-render on sign-in and sign-out, and useCan follows the session', async () => {
    const app = await bootWith(adapterWith(null))
    render(
      <KitrProvider app={app}>
        <Who />
      </KitrProvider>,
    )
    expect(await screen.findByText('anonymous')).toBeTruthy()
    expect(screen.getByText('cannot delete')).toBeTruthy()
    await act(() => app.container.use('auth').signIn({ id: 'u9' }))
    expect(screen.getByText('user u9')).toBeTruthy()
    expect(screen.getByText('can delete')).toBeTruthy()
    expect(screen.getByText('same session')).toBeTruthy()
    await act(() => app.container.use('auth').signOut())
    expect(screen.getByText('anonymous')).toBeTruthy()
  })
})

describe('createAuth', () => {
  it('notifies listeners once per change even when the adapter also emits', async () => {
    const adapter = tokenAdapter<User>({
      fetchUser: async () => ({ id: 'u1', role: 'member' }),
      signIn: async () => ({ token: 't' }),
    })
    const auth = createAuth(adapter)
    const listener = vi.fn()
    auth.subscribe(listener)
    await auth.signIn({ email: 'a', password: 'b' })
    expect(listener).toHaveBeenCalledTimes(1)
    await auth.signOut()
    expect(listener).toHaveBeenCalledTimes(2)
    await auth.signOut()
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('unsubscribe stops notifications', async () => {
    const auth = createAuth(adapterWith(null))
    const listener = vi.fn()
    const off = auth.subscribe(listener)
    off()
    await auth.signIn({ id: 'x' })
    expect(listener).not.toHaveBeenCalled()
  })

  it('signIn without adapter support throws; refresh without support signs out', async () => {
    const auth = createAuth(customAdapter({ getSession: async () => null }))
    await expect(auth.signIn({})).rejects.toThrow(/no signIn/)
    expect(await auth.refresh()).toBe(false)
    expect(await auth.getToken()).toBeNull()
  })

  it('adapter onChange (other tab) updates the session', async () => {
    let emit: (s: any) => void = () => {}
    const auth = createAuth(
      customAdapter<User>({
        getSession: async () => null,
        onChange: (l) => {
          emit = l
          return () => {}
        },
      }),
    )
    emit(createSession({ id: 'tab2', role: 'member' }))
    expect(auth.user?.id).toBe('tab2')
    emit(null)
    expect(auth.user).toBeNull()
  })
})

describe('tokenAdapter', () => {
  it('does not keep a token when sign-in returns no user', async () => {
    const storage = localStorageTokens('test:token')
    const adapter = tokenAdapter<User>({
      storage,
      fetchUser: async () => null,
      signIn: async () => ({ token: 'orphan', refreshToken: 'r' }),
    })
    await expect(adapter.signIn?.({ email: 'a', password: 'b' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
    expect(storage.get()).toBeNull()
  })

  it('localStorageTokens persists and clears', () => {
    const storage = localStorageTokens('test:token')
    storage.set('abc')
    expect(localStorage.getItem('test:token')).toBe('abc')
    expect(storage.get()).toBe('abc')
    storage.set(null)
    expect(localStorage.getItem('test:token')).toBeNull()
  })

  it('failed refresh clears tokens and emits sign-out', async () => {
    const onChange = vi.fn()
    const adapter = tokenAdapter<User>({
      fetchUser: async () => ({ id: 'u1', role: 'member' }),
      signIn: async () => ({ token: 't', refreshToken: 'r' }),
      refresh: async () => {
        throw new Error('revoked')
      },
    })
    adapter.onChange?.(onChange)
    await adapter.signIn?.({ email: 'a', password: 'b' })
    expect(await adapter.refresh?.()).toBe(false)
    expect(await adapter.getToken?.()).toBeNull()
    expect(onChange).toHaveBeenLastCalledWith(null)
    expect(await adapter.getSession()).toBeNull()
  })

  it('signOut calls the backend but never fails on its error', async () => {
    const signOut = vi.fn(async () => {
      throw new Error('offline')
    })
    const adapter = tokenAdapter<User>({
      fetchUser: async () => ({ id: 'u1', role: 'member' }),
      signIn: async () => ({ token: 't' }),
      signOut,
    })
    await adapter.signIn?.({ email: 'a', password: 'b' })
    await expect(adapter.signOut?.()).resolves.toBeUndefined()
    expect(signOut).toHaveBeenCalledWith('t')
  })
})

describe('betterAuthAdapter', () => {
  it('maps the client session, expiry, sign-in and sign-out', async () => {
    let data: any = null
    const client = {
      getSession: async () => ({ data }),
      signOut: vi.fn(async () => {
        data = null
      }),
      signIn: {
        email: vi.fn(async (c: { email: string }) => {
          data = {
            user: { id: c.email, role: 'member' },
            session: { expiresAt: '2030-01-01T00:00:00Z' },
          }
        }),
      },
    }
    const adapter = betterAuthAdapter<User>(client, { abilities })
    expect(await adapter.getSession()).toBeNull()
    const session = await adapter.signIn?.({ email: 'e@x', password: 'p' })
    expect(session?.user?.id).toBe('e@x')
    expect((await adapter.getSession())?.expiresAt).toBe(Date.parse('2030-01-01T00:00:00Z'))
    await adapter.signOut?.()
    expect(client.signOut).toHaveBeenCalled()
  })

  it('throws when sign-in is not configured or yields no user', async () => {
    const none = betterAuthAdapter<User>({
      getSession: async () => ({ data: null }),
      signOut: async () => {},
    })
    await expect(none.signIn?.({ email: '', password: '' })).rejects.toMatchObject({
      code: 'INTERNAL',
    })
    const failing = betterAuthAdapter<User>(
      { getSession: async () => ({ data: null }), signOut: async () => {} },
      { signIn: async () => {} },
    )
    await expect(failing.signIn?.({ email: '', password: '' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })
})
