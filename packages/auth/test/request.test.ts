import { createApp, KitrError } from '@kitr/core'
import { type RequestContext, runWithRequest } from '@kitr/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  type AuthUser,
  createAuth,
  defineAbilities,
  ensureSession,
  getServerSessionResolver,
  sessionAdapter,
  sessionQueryKey,
  setServerSessionResolver,
} from '../src'
import authProvider from '../src/provider'
import {
  createCookieSession,
  createMemorySessionStore,
  createMemoryUserProvider,
  getRequestSession,
  getRequestUser,
  resolveSession,
  runWithSession,
  SESSION_LOCALS_KEY,
  sessionMiddleware,
} from '../src/server'

interface User extends AuthUser {
  role: 'admin' | 'member'
}
const SECRET = 'a-secret-that-is-at-least-32-characters-long'

async function world() {
  const sessions = createCookieSession({ secret: SECRET, store: createMemorySessionStore() })
  const users = createMemoryUserProvider<User>({
    seed: [{ user: { id: 'ada', email: 'ada@acme.com', role: 'admin' }, passwordHash: 'x' }],
  })
  const headers = new Headers()
  await sessions.create('ada', headers)
  const cookie = headers.get('set-cookie')!.split(';')[0]!
  const signedIn = new Request('http://app/dashboard', { headers: { cookie } })
  const anonymous = new Request('http://app/dashboard')
  return { sessions, users, auth: { sessions, users }, signedIn, anonymous, cookie }
}

afterEach(() => setServerSessionResolver(undefined))

describe('resolveSession', () => {
  it('returns the user and the record, null for anonymous, and revokes sessions of deleted users', async () => {
    const { auth, signedIn, anonymous, users, sessions } = await world()
    expect((await resolveSession(auth, signedIn))?.user.email).toBe('ada@acme.com')
    expect(await resolveSession(auth, anonymous)).toBeNull()
    users.all as Map<string, unknown>
    ;(users.all as Map<string, unknown>).delete('ada')
    expect(await resolveSession(auth, signedIn)).toBeNull()
    expect(await sessions.list('ada')).toEqual([])
  })
})

describe('runWithSession', () => {
  it('has no session outside a scope', async () => {
    expect(await getRequestSession()).toBeUndefined()
    await expect(getRequestUser()).rejects.toThrow(/needs a request/)
  })

  it("gives anything running inside it the request's user, and resolves once per request", async () => {
    const { auth, signedIn, anonymous } = await world()
    const find = vi.spyOn(auth.users, 'findById')
    await runWithSession(auth, signedIn, async () => {
      expect((await getRequestUser<User>())?.email).toBe('ada@acme.com')
      expect((await getRequestSession())?.session.userId).toBe('ada')
      await getRequestUser()
    })
    expect(find).toHaveBeenCalledTimes(1)
    await runWithSession(auth, anonymous, async () => {
      expect(await getRequestUser()).toBeNull()
      expect(await getRequestSession()).toBeNull()
    })
  })

  it('keeps concurrent requests apart', async () => {
    const { auth, signedIn, anonymous } = await world()
    const seen = await Promise.all(
      [signedIn, anonymous, signedIn, anonymous].map((request) =>
        runWithSession(auth, request, async () => {
          await new Promise((r) => setTimeout(r, Math.random() * 10))
          return (await getRequestUser())?.id ?? 'nobody'
        }),
      ),
    )
    expect(seen).toEqual(['ada', 'nobody', 'ada', 'nobody'])
  })

  it('installs the server session reader the cookie-session adapter uses', async () => {
    const { auth, signedIn } = await world()
    expect(getServerSessionResolver()).toBeUndefined()
    await runWithSession(auth, signedIn, async () => {
      const found = await getServerSessionResolver()!()
      expect((found?.user as User | undefined)?.id).toBe('ada')
      expect(found?.expiresAt).toBeGreaterThan(Date.now())
    })
    // Outside the scope the reader says "no request", not "anonymous".
    expect(await getServerSessionResolver()!()).toBeUndefined()
  })

  it('passes a non-Response result through, and a Response through untouched when no cookie changed', async () => {
    const { auth, signedIn } = await world()
    expect(await runWithSession(auth, signedIn, () => 42)).toBe(42)
    const page = new Response('hi', { headers: { 'x-a': '1' } })
    expect(await runWithSession(auth, signedIn, () => page)).toBe(page)
  })

  it('adds the refreshed cookie to the page response when the session slid forward', async () => {
    vi.useFakeTimers()
    try {
      const store = createMemorySessionStore()
      const sessions = createCookieSession({
        secret: SECRET,
        store,
        maxAge: 1000,
        absoluteMaxAge: 100_000,
      })
      const users = createMemoryUserProvider<User>({
        seed: [{ user: { id: 'ada', email: 'a@b.co', role: 'member' }, passwordHash: 'x' }],
      })
      const h = new Headers()
      await sessions.create('ada', h)
      const request = new Request('http://app/', {
        headers: { cookie: h.get('set-cookie')!.split(';')[0]! },
      })
      vi.advanceTimersByTime(500_000)
      const response = await runWithSession({ sessions, users }, request, async () => {
        await getRequestUser()
        return new Response('page', { status: 201, headers: { 'x-page': 'yes' } })
      })
      expect(response.status).toBe(201)
      expect(response.headers.get('x-page')).toBe('yes')
      expect(response.headers.get('set-cookie')).toMatch(/^kitr-session=/)
      expect(await response.text()).toBe('page')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('sessionMiddleware', () => {
  const ctxFor = (request: Request) => ({
    request: { headers: request.headers },
    event: { res: { headers: new Headers() } },
    locals: {} as Record<string, unknown>,
  })

  it('puts user and can on locals, like authMiddleware, and in the server request context', async () => {
    const { auth, signedIn } = await world()
    const abilities = defineAbilities({ 'users.ban': (user: User) => user.role === 'admin' })
    const middleware = sessionMiddleware({ ...auth, abilities })
    const ctx = ctxFor(signedIn)
    const request = { locals: ctx.locals } as unknown as RequestContext
    await runWithRequest(request, async () => {
      await middleware(ctx, async () => {
        expect((ctx.locals.user as User).id).toBe('ada')
        expect((ctx.locals.can as (a: string) => boolean)('users.ban')).toBe(true)
        // The same session is visible to code that only has the request context.
        expect((await getRequestUser<User>())?.id).toBe('ada')
        expect(ctx.locals[SESSION_LOCALS_KEY]).toBeTruthy()
        return null
      })
    })
  })

  it('answers 401 to anonymous requests unless optional', async () => {
    const { auth, anonymous } = await world()
    await expect(
      sessionMiddleware(auth)(ctxFor(anonymous), async () => null),
    ).rejects.toBeInstanceOf(KitrError)
    const ctx = ctxFor(anonymous)
    await sessionMiddleware({ ...auth, optional: true })(ctx, async () => null)
    expect(ctx.locals.user).toBeNull()
    expect((ctx.locals.can as () => boolean)()).toBe(false)
  })

  it('reads a signed-in user as able to do anything without abilities', async () => {
    const { auth, signedIn } = await world()
    const ctx = ctxFor(signedIn)
    await sessionMiddleware(auth)(ctx, async () => null)
    expect((ctx.locals.can as () => boolean)()).toBe(true)
  })

  it('refreshes the cookie on the response through the event', async () => {
    vi.useFakeTimers()
    try {
      const sessions = createCookieSession({
        secret: SECRET,
        store: createMemorySessionStore(),
        maxAge: 1000,
      })
      const users = createMemoryUserProvider<User>({
        seed: [{ user: { id: 'ada', email: 'a@b.co', role: 'member' }, passwordHash: 'x' }],
      })
      const h = new Headers()
      await sessions.create('ada', h)
      const ctx = ctxFor(
        new Request('http://app/', { headers: { cookie: h.get('set-cookie')!.split(';')[0]! } }),
      )
      vi.advanceTimersByTime(500_000)
      await sessionMiddleware({ sessions, users })(ctx, async () => null)
      expect(ctx.event.res.headers.get('set-cookie')).toMatch(/^kitr-session=/)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('cookie-session adapter', () => {
  const user: User = { id: 'ada', email: 'ada@acme.com', role: 'admin' }
  const abilities = defineAbilities({ 'users.ban': (u: User) => u.role === 'admin' })

  const queryCache = () => {
    const data = new Map<string, unknown>()
    const key = (k: readonly unknown[]) => JSON.stringify(k)
    return {
      data,
      fetchQuery: vi.fn(
        async (o: { queryKey: readonly unknown[]; queryFn: () => Promise<unknown> }) => {
          if (!data.has(key(o.queryKey))) data.set(key(o.queryKey), await o.queryFn())
          return data.get(key(o.queryKey))
        },
      ),
      setQueryData: vi.fn((k: readonly unknown[], v: unknown) => void data.set(key(k), v)),
    }
  }

  it('loads the session over HTTP in the browser, through the query cache', async () => {
    const fetchSession = vi.fn(async () => ({ user, expiresAt: 123 }))
    const adapter = sessionAdapter<User>({
      abilities,
      fetchSession,
      signIn: async () => ({ user }),
    })
    const cache = queryCache()
    const auth = createAuth(adapter, { context: () => ({ queryClient: cache }) })
    const session = await auth.load()
    expect(session.user?.id).toBe('ada')
    expect(session.expiresAt).toBe(123)
    expect(session.can('users.ban')).toBe(true)
    await auth.load()
    expect(fetchSession).toHaveBeenCalledTimes(1)
    expect(cache.fetchQuery.mock.calls[0]![0]).toMatchObject({
      queryKey: sessionQueryKey,
      staleTime: 30_000,
    })
  })

  it('reads anonymous when the endpoint says so, and without a query cache calls it every time', async () => {
    const fetchSession = vi.fn(async () => ({ user: null }))
    const auth = createAuth(sessionAdapter<User>({ fetchSession, signIn: async () => ({ user }) }))
    expect((await auth.load()).user).toBeNull()
    await auth.load()
    expect(fetchSession).toHaveBeenCalledTimes(2)
  })

  it('replaces the cached session on sign-in and sign-out', async () => {
    const signIn = vi.fn(async () => ({ user, expiresAt: 5 }))
    const signOut = vi.fn(async () => undefined)
    const adapter = sessionAdapter<User>({
      fetchSession: async () => ({ user: null }),
      signIn,
      signOut,
      staleTime: 10,
    })
    const cache = queryCache()
    const auth = createAuth(adapter, { context: () => ({ queryClient: cache }) })
    await auth.load()
    const seen: unknown[] = []
    auth.subscribe((s) => seen.push(s.user?.id ?? null))
    const session = await auth.signIn({ email: 'a@b.co', password: 'x' })
    expect(session.user?.id).toBe('ada')
    expect(cache.data.get(JSON.stringify(sessionQueryKey))).toEqual({ user, expiresAt: 5 })
    await auth.signOut()
    expect(signOut).toHaveBeenCalled()
    expect(cache.data.get(JSON.stringify(sessionQueryKey))).toEqual({ user: null })
    expect(seen).toEqual(['ada', null])
  })

  it('clears the cached session even when the sign-out request fails', async () => {
    const cache = queryCache()
    const adapter = sessionAdapter<User>({
      fetchSession: async () => ({ user }),
      signIn: async () => ({ user }),
      signOut: async () => {
        throw new Error('offline')
      },
    })
    await expect(adapter.signOut!({ queryClient: cache })).rejects.toThrow('offline')
    expect(cache.data.get(JSON.stringify(sessionQueryKey))).toEqual({ user: null })
  })

  it('works with no sign-out function and no context', async () => {
    const adapter = sessionAdapter<User>({
      fetchSession: async () => ({ user }),
      signIn: async () => ({ user }),
    })
    await expect(adapter.signOut!()).resolves.toBeUndefined()
    expect((await adapter.signIn!({ email: 'a', password: 'b' })).user?.id).toBe('ada')
  })

  it('takes the session of the request being rendered, with no HTTP call', async () => {
    const { auth: serverAuth, signedIn, anonymous } = await world()
    const fetchSession = vi.fn(async () => ({ user: null }))
    const adapter = sessionAdapter<User>({
      abilities,
      fetchSession,
      signIn: async () => ({ user }),
    })
    const signedInSession = await runWithSession(serverAuth, signedIn, () =>
      createAuth(adapter).load(),
    )
    expect(signedInSession.user?.id).toBe('ada')
    expect(signedInSession.can('users.ban')).toBe(true)
    const anon = await runWithSession(serverAuth, anonymous, () => createAuth(adapter).load())
    expect(anon.user).toBeNull()
    expect(fetchSession).not.toHaveBeenCalled()
  })

  it('falls back to HTTP when the reader reports no request in scope', async () => {
    setServerSessionResolver(async () => undefined)
    const fetchSession = vi.fn(async () => ({ user }))
    const auth = createAuth(sessionAdapter<User>({ fetchSession, signIn: async () => ({ user }) }))
    expect((await auth.load()).user?.id).toBe('ada')
    expect(fetchSession).toHaveBeenCalledOnce()
  })
})

describe('auth provider and ensureSession', () => {
  const user: User = { id: 'ada', email: 'ada@acme.com', role: 'admin' }
  const config = (fetchSession = vi.fn(async () => ({ user }))) => ({
    auth: {
      adapter: sessionAdapter<User>({ fetchSession, signIn: async () => ({ user }) }),
    },
  })

  it("binds one auth service per scope, so a server request never sees another request's session", async () => {
    const app = createApp({ providers: [authProvider], config: config(), environment: 'server' })
    await app.boot()
    const a = app.fork()
    const b = app.fork()
    const authA = a.container.use('auth')
    const authB = b.container.use('auth')
    expect(authA).not.toBe(authB)
    expect(authA).not.toBe(app.container.use('auth'))
    await authA.load()
    expect(authA.session.user?.id).toBe('ada')
    expect(authB.session.user).toBeNull()
  })

  it('does not load a session during server boot, which belongs to no request', async () => {
    const fetchSession = vi.fn(async () => ({ user }))
    const app = createApp({
      providers: [authProvider],
      config: config(fetchSession),
      environment: 'server',
    })
    await app.boot()
    expect(fetchSession).not.toHaveBeenCalled()
  })

  it("ensureSession loads the session into the request's own service", async () => {
    const fetchSession = vi.fn(async () => ({ user }))
    const app = createApp({
      providers: [authProvider],
      config: config(fetchSession),
      environment: 'server',
    })
    const fork = app.fork()
    await ensureSession({ context: { app: fork } })
    expect(fork.container.use('auth').session.user?.id).toBe('ada')
    expect(app.container.use('auth').session.user).toBeNull()
  })

  it('ensureSession is a no-op without the auth package, and skips the load for a signed-in tab', async () => {
    const bare = createApp({ environment: 'server' })
    await expect(ensureSession({ context: { app: bare } })).resolves.toBeUndefined()

    const fetchSession = vi.fn(async () => ({ user }))
    const client = createApp({
      providers: [authProvider],
      config: config(fetchSession),
      environment: 'client',
    })
    await client.boot()
    expect(fetchSession).toHaveBeenCalledTimes(1)
    await ensureSession({ context: { app: client } })
    expect(fetchSession).toHaveBeenCalledTimes(1)
  })

  it("hands the adapter the app's query client when @kitr/query is installed", async () => {
    const calls: unknown[] = []
    const cache = {
      fetchQuery: async (o: { queryFn: () => Promise<unknown> }) => {
        calls.push('fetchQuery')
        return o.queryFn()
      },
      setQueryData: () => undefined,
    }
    const queryStub = {
      name: 'query-stub',
      register(app: { container: { value(k: string, v: unknown): void } }) {
        app.container.value('queryClient', cache)
      },
    }
    const app = createApp({
      providers: [queryStub as never, authProvider],
      config: config(),
      environment: 'client',
    })
    await app.boot()
    expect(calls).toEqual(['fetchQuery'])
    expect(app.container.use('auth').session.user?.id).toBe('ada')
  })
})
