import { describe, expect, it, vi } from 'vitest'
import {
  type AuthUser,
  type ControllerContext,
  createCookieSession,
  createMemorySessionStore,
  createMemoryUserProvider,
  createSessionController,
  hashPassword,
  verifyPassword,
} from '../src/server'

interface User extends AuthUser {
  name?: string
  role: 'admin' | 'member'
}

const SECRET = 'a-secret-that-is-at-least-32-characters-long'
const CSRF = 'csrf-token-123'

type Sent = {
  template: { name: string }
  props: { url: string; email: string; name?: string }
  to: string
}

async function setup(
  options: {
    mail?: boolean
    requireVerifiedEmail?: boolean
    csrf?: false
    mailFails?: boolean
    users?: ReturnType<typeof createMemoryUserProvider<User>>
  } = {},
) {
  const store = createMemorySessionStore()
  const sessions = createCookieSession({ secret: SECRET, store })
  const users =
    options.users ??
    createMemoryUserProvider<User>({
      build: (input, id) => ({ id, email: input.email, name: input.name, role: 'member' }),
      seed: [
        {
          user: { id: 'ada', email: 'ada@acme.com', name: 'Ada', role: 'admin' },
          passwordHash: await hashPassword('lovelace-1815'),
          emailVerified: true,
        },
      ],
    })
  const sent: Sent[] = []
  const verifyEmail = { name: 'verify-email', subject: 'Verify', render: () => null }
  const resetPassword = { name: 'reset-password', subject: 'Reset', render: () => null }
  const Controller = createSessionController<User>({
    sessions,
    users,
    ...(options.mail === false ? {} : { mail: { verifyEmail, resetPassword } }),
    requireVerifiedEmail: options.requireVerifiedEmail,
    csrf: options.csrf,
    appUrl: 'https://app.acme.com/',
  })
  const controller = new Controller()
  const errors: unknown[] = []
  const app = {
    container: {
      has: (k: string) => k === 'mailer',
      use: () => ({
        send: async (template: Sent['template'], props: Sent['props'], opts: { to: string }) => {
          if (options.mailFails) throw new Error('smtp down')
          sent.push({ template, props, to: opts.to })
        },
      }),
    },
  }

  // A browser: keeps cookies between calls and echoes the CSRF cookie in the header.
  const jar = new Map<string, string>([['kitr-csrf', CSRF]])
  const call = async <B, R>(
    method: (ctx: ControllerContext<B>) => Promise<R>,
    body?: B,
    { header = CSRF as string | null }: { header?: string | null } = {},
  ) => {
    const headers = new Headers({
      cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
      ...(header ? { 'x-csrf-token': header } : {}),
    })
    const res = new Headers()
    const status: number[] = []
    const ctx: ControllerContext<B> = {
      body: body as B,
      app,
      logger: { error: (...args) => void errors.push(args) },
      request: {
        url: new URL('http://internal/api/auth'),
        headers,
        header: (n) => headers.get(n),
      },
      response: {
        status: (c) => void status.push(c),
        header: (n, v) => void res.set(n, v),
      },
      event: { res: { headers: res } },
      locals: {},
    }
    const result = await method.call(controller, ctx)
    for (const cookie of res.getSetCookie()) {
      const [pair, ...attrs] = cookie.split('; ')
      const [name, value] = pair!.split('=')
      if (attrs.some((a) => a === 'Max-Age=0')) jar.delete(name!)
      else jar.set(name!, value!)
    }
    return { result, headers: res, status: status.at(-1) }
  }
  return { controller, sessions, users, sent, errors, call, jar, store, Controller }
}

describe('session controller', () => {
  it('reports anonymous, signs in, and reports the user with a no-store response', async () => {
    const { controller, call } = await setup()
    const anon = await call(controller.session)
    expect(anon.result).toEqual({ user: null, expiresAt: undefined })
    expect(anon.headers.get('cache-control')).toBe('no-store')

    const signedIn = await call(controller.signIn, {
      email: 'ada@acme.com',
      password: 'lovelace-1815',
    })
    expect(signedIn.result.user).toMatchObject({ id: 'ada', role: 'admin' })
    expect(signedIn.result.user).not.toHaveProperty('passwordHash')
    expect(signedIn.headers.get('set-cookie')).toContain('HttpOnly')

    const me = await call(controller.session)
    expect(me.result.user?.email).toBe('ada@acme.com')
    expect(me.result.expiresAt).toBeGreaterThan(Date.now())
  })

  it('rejects a wrong password or an unknown email the same way', async () => {
    const { controller, call } = await setup()
    await expect(
      call(controller.signIn, { email: 'ada@acme.com', password: 'nope' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'Wrong email or password' })
    await expect(
      call(controller.signIn, { email: 'nobody@acme.com', password: 'anything' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'Wrong email or password' })
  })

  it('refuses a user with no password and, when asked, one with an unconfirmed email', async () => {
    const users = createMemoryUserProvider<User>({
      seed: [
        { user: { id: 'g', email: 'social@acme.com', role: 'member' }, passwordHash: null },
        {
          user: { id: 'u', email: 'new@acme.com', role: 'member' },
          passwordHash: await hashPassword('password-1'),
          emailVerified: false,
        },
      ],
    })
    const { controller, call } = await setup({ users, requireVerifiedEmail: true })
    await expect(
      call(controller.signIn, { email: 'social@acme.com', password: 'x' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(
      call(controller.signIn, { email: 'new@acme.com', password: 'password-1' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rehashes a weak stored hash after a successful sign-in', async () => {
    // The same password at a lower cost factor, as an older deployment would have stored it.
    const { scryptSync } = await import('node:crypto')
    const salt = Buffer.from('saltsaltsaltsalt')
    const hash = scryptSync('hunter2hunter2', salt, 64, { N: 1024, r: 8, p: 1 })
    const lowCost = `scrypt$1024$8$1$${salt.toString('base64url')}$${hash.toString('base64url')}`
    expect(await verifyPassword('hunter2hunter2', lowCost)).toBe(true)
    const users = createMemoryUserProvider<User>({
      seed: [{ user: { id: 'u', email: 'a@b.co', role: 'member' }, passwordHash: lowCost }],
    })
    const { controller, call } = await setup({ users })
    await call(controller.signIn, { email: 'a@b.co', password: 'hunter2hunter2' })
    const stored = users.all.get('u')!.passwordHash!
    expect(stored).not.toBe(lowCost)
    expect(stored).toMatch(/^scrypt\$32768\$/)
  })

  it('replaces the session id on sign-in', async () => {
    const { controller, call, jar } = await setup()
    await call(controller.signIn, { email: 'ada@acme.com', password: 'lovelace-1815' })
    const first = jar.get('kitr-session')
    await call(controller.signIn, { email: 'ada@acme.com', password: 'lovelace-1815' })
    expect(jar.get('kitr-session')).not.toBe(first)
  })

  it('signs out, and signs out everywhere', async () => {
    const { controller, call, jar, sessions } = await setup()
    await call(controller.signIn, { email: 'ada@acme.com', password: 'lovelace-1815' })
    const out = await call(controller.signOut)
    expect(out.status).toBe(204)
    expect(jar.has('kitr-session')).toBe(false)
    expect((await call(controller.session)).result.user).toBeNull()

    await call(controller.signIn, { email: 'ada@acme.com', password: 'lovelace-1815' })
    const phone = await sessions.create('ada', new Headers())
    const all = await call(controller.signOutAll)
    expect(all.result).toEqual({ revoked: 2 })
    expect(await sessions.list('ada')).toEqual([])
    expect(phone.id).toBeTruthy()
    await expect(call(controller.signOutAll)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  describe('csrf', () => {
    it('requires the header to match the cookie on every state-changing method', async () => {
      const { controller, call } = await setup()
      const body = { email: 'ada@acme.com', password: 'lovelace-1815' }
      await expect(call(controller.signIn, body, { header: null })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      })
      await expect(call(controller.signIn, body, { header: 'wrong' })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      })
      await expect(call(controller.signOut, undefined, { header: null })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      })
      await expect(
        call(controller.signUp, { email: 'x@y.zz', password: 'longenough' }, { header: null }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      await expect(
        call(controller.resetPassword, { token: 't', password: 'longenough' }, { header: null }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      // Reading the session needs no token.
      await expect(call(controller.session, undefined, { header: null })).resolves.toBeTruthy()
    })

    it('fails without the cookie, and is off with csrf: false', async () => {
      const { controller, call, jar } = await setup()
      jar.delete('kitr-csrf')
      await expect(
        call(controller.signIn, { email: 'ada@acme.com', password: 'lovelace-1815' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      const open = await setup({ csrf: false })
      open.jar.delete('kitr-csrf')
      await expect(
        open.call(
          open.controller.signIn,
          { email: 'ada@acme.com', password: 'lovelace-1815' },
          { header: null },
        ),
      ).resolves.toBeTruthy()
    })

    it('decodes a percent-encoded cookie and tolerates a malformed one', async () => {
      const { controller, call, jar } = await setup()
      jar.set('kitr-csrf', encodeURIComponent('a b+c'))
      await expect(call(controller.signOut, undefined, { header: 'a b+c' })).resolves.toBeTruthy()
      jar.set('kitr-csrf', '%E0%A4%A')
      await expect(
        call(controller.signOut, undefined, { header: '%E0%A4%A' }),
      ).resolves.toBeTruthy()
    })
  })

  describe('sign-up and email verification', () => {
    it('creates the user, sends a verification link, signs them in and confirms the address', async () => {
      const { controller, call, sent, users } = await setup()
      const res = await call(controller.signUp, {
        email: 'grace@acme.com',
        password: 'cobol-1959',
        name: 'Grace',
      })
      expect(res.status).toBe(201)
      expect(res.result.user).toMatchObject({ email: 'grace@acme.com', name: 'Grace' })
      expect((await call(controller.session)).result.user?.email).toBe('grace@acme.com')

      expect(sent).toHaveLength(1)
      expect(sent[0]!.to).toBe('grace@acme.com')
      expect(sent[0]!.props.name).toBe('Grace')
      const url = new URL(sent[0]!.props.url)
      expect(url.origin + url.pathname).toBe('https://app.acme.com/verify-email')

      const token = url.searchParams.get('token')!
      expect(users.all.get(res.result.user!.id)!.emailVerified).toBe(false)
      expect((await call(controller.verifyEmail, { token })).status).toBe(204)
      expect(users.all.get(res.result.user!.id)!.emailVerified).toBe(true)
    })

    it('rejects a duplicate email and a weak password', async () => {
      const { controller, call, controller: c } = await setup()
      await expect(
        call(c.signUp, { email: 'ada@acme.com', password: 'longenough' }),
      ).rejects.toMatchObject({ code: 'CONFLICT' })
      expect(controller.signUp).toBeTypeOf('function')
    })

    it('an email that fails to send does not fail the sign-up', async () => {
      const { controller, call, errors } = await setup({ mailFails: true })
      const res = await call(controller.signUp, {
        email: 'linus@acme.com',
        password: 'torvalds-91',
      })
      expect(res.result.user?.email).toBe('linus@acme.com')
      expect(errors).toHaveLength(1)
    })

    it('does not mail at all when no templates are configured, and its routes answer 404', async () => {
      const { controller, call, sent } = await setup({ mail: false })
      await call(controller.signUp, { email: 'a@b.co', password: 'longenough' })
      expect(sent).toEqual([])
      await expect(call(controller.requestVerification)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
      await expect(
        call(controller.requestPasswordReset, { email: 'a@b.co' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('sends another verification email to a signed-in user, and needs a session', async () => {
      const { controller, call, sent } = await setup()
      await expect(call(controller.requestVerification)).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      })
      await call(controller.signIn, { email: 'ada@acme.com', password: 'lovelace-1815' })
      expect((await call(controller.requestVerification)).status).toBe(202)
      expect(sent[0]!.template.name).toBe('verify-email')
    })

    it('rejects a bad, wrong-purpose or stale verification token', async () => {
      const { controller, call, sent } = await setup()
      await expect(call(controller.verifyEmail, { token: 'garbage' })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      })
      await call(controller.signIn, { email: 'ada@acme.com', password: 'lovelace-1815' })
      await call(controller.requestVerification)
      const token = new URL(sent[0]!.props.url).searchParams.get('token')!
      await expect(
        call(controller.resetPassword, { token, password: 'longenough' }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    it('answers 404 when the provider cannot mark an email verified', async () => {
      const users = createMemoryUserProvider<User>()
      const bare = { ...users, markEmailVerified: undefined }
      const { controller, call } = await setup({ users: bare as typeof users })
      await expect(call(controller.verifyEmail, { token: 'x' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
    })
  })

  describe('password reset', () => {
    it('emails a link, sets the new password once and ends every session', async () => {
      const { controller, call, sent, jar } = await setup()
      await call(controller.signIn, { email: 'ada@acme.com', password: 'lovelace-1815' })
      expect(jar.has('kitr-session')).toBe(true)

      expect((await call(controller.requestPasswordReset, { email: 'ada@acme.com' })).status).toBe(
        202,
      )
      expect(sent).toHaveLength(1)
      expect(new URL(sent[0]!.props.url).pathname).toBe('/reset-password')
      const token = new URL(sent[0]!.props.url).searchParams.get('token')!

      expect(
        (await call(controller.resetPassword, { token, password: 'new-password-1' })).status,
      ).toBe(204)
      expect((await call(controller.session)).result.user).toBeNull()
      await expect(
        call(controller.signIn, { email: 'ada@acme.com', password: 'lovelace-1815' }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
      expect(
        (await call(controller.signIn, { email: 'ada@acme.com', password: 'new-password-1' }))
          .result.user?.id,
      ).toBe('ada')

      // The link worked once: the password it was bound to is gone.
      await expect(
        call(controller.resetPassword, { token, password: 'another-one-22' }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    it('answers 202 and sends nothing for an unknown email', async () => {
      const { controller, call, sent } = await setup()
      expect(
        (await call(controller.requestPasswordReset, { email: 'ghost@acme.com' })).status,
      ).toBe(202)
      expect(sent).toEqual([])
    })

    it('does not fail the request when the mail cannot be sent', async () => {
      const { controller, call, errors } = await setup({ mailFails: true })
      expect((await call(controller.requestPasswordReset, { email: 'ada@acme.com' })).status).toBe(
        202,
      )
      expect(errors).toHaveLength(1)
    })

    it('answers 404 when the provider cannot store a password', async () => {
      const users = createMemoryUserProvider<User>()
      const bare = { ...users, setPasswordHash: undefined }
      const { controller, call } = await setup({ users: bare as typeof users })
      await expect(
        call(controller.requestPasswordReset, { email: 'a@b.co' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      await expect(
        call(controller.resetPassword, { token: 't', password: 'longenough' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  })

  describe('validation schemas', () => {
    const validate = async (schema: any, value: unknown) => schema['~standard'].validate(value)

    it('normalises emails and reports every field problem', async () => {
      const { Controller } = await setup()
      const { signIn, signUp, requestPasswordReset, verifyEmail, resetPassword } =
        Controller.validation
      expect(await validate(signIn.body, { email: ' ADA@Acme.com ', password: 'x' })).toEqual({
        value: { email: 'ada@acme.com', password: 'x' },
      })
      expect((await validate(signIn.body, { email: 'nope', password: '' })).issues).toHaveLength(2)
      expect((await validate(signIn.body, null)).issues).toHaveLength(2)
      expect(
        await validate(signUp.body, { email: 'a@b.co', password: 'longenough', name: ' Ada ' }),
      ).toEqual({
        value: { email: 'a@b.co', password: 'longenough', name: 'Ada' },
      })
      expect(
        (await validate(signUp.body, { email: 'a@b.co', password: 'short' })).issues[0],
      ).toMatchObject({
        path: ['password'],
      })
      expect(
        (await validate(signUp.body, { email: 'a@b.co', password: 'x'.repeat(300) })).issues,
      ).toHaveLength(1)
      expect((await validate(requestPasswordReset.body, {})).issues).toHaveLength(1)
      expect((await validate(verifyEmail.body, {})).issues).toHaveLength(1)
      expect((await validate(resetPassword.body, { password: 'short' })).issues).toHaveLength(2)
      expect(await validate(resetPassword.body, { token: 't', password: 'longenough' })).toEqual({
        value: { token: 't', password: 'longenough' },
      })
    })
  })

  it('takes the mailer from the container by default and lets you supply one', async () => {
    const send = vi.fn(async () => undefined)
    const Controller = createSessionController<User>({
      sessions: createCookieSession({ secret: SECRET, store: createMemorySessionStore() }),
      users: createMemoryUserProvider<User>({
        seed: [
          {
            user: { id: 'u', email: 'a@b.co', role: 'member' },
            passwordHash: await hashPassword('password-1'),
          },
        ],
      }),
      mail: { resetPassword: { name: 'r', subject: 's', render: () => null } },
      mailer: () => ({ send }),
      csrf: false,
    })
    const ctx = {
      body: { email: 'a@b.co' },
      app: { container: { has: () => false, use: () => ({}) } },
      logger: { error: vi.fn() },
      request: {
        url: new URL('https://from-request.example/x'),
        headers: new Headers(),
        header: () => null,
      },
      response: { status: vi.fn(), header: vi.fn() },
      event: { res: { headers: new Headers() } },
      locals: {},
    }
    await new Controller().requestPasswordReset(ctx)
    expect(send).toHaveBeenCalledOnce()
    // No appUrl: the link falls back to the request's origin.
    const props = (send.mock.calls[0] as unknown as [unknown, { url: string }])[1]
    expect(props.url.startsWith('https://from-request.example/reset-password?token=')).toBe(true)
  })
})
