import { KitrError, type StandardSchemaV1 } from '@kitr/core'
import type { SessionPayload } from './adapters'
import { type CookieSessions, readCookie, safeEqual } from './cookie-session'
import { hashPassword, needsRehash, verifyPassword } from './password'
import { type ResolvedSession, resolveSession } from './request'
import { createToken, fingerprint, readToken } from './tokens'
import type { AuthUser, UserProvider } from './users'

/** An email template as the controller sends it: `defineMail(...)` from `kitr/mail` fits. */
export interface AuthMailTemplate<Props> {
  readonly name: string
  readonly subject: string | ((props: Props) => string)
  readonly render: (props: Props) => unknown
}

/** What a verification or reset email gets as props. */
export interface AuthMailProps {
  /** Where the recipient goes to finish: the link with the token. */
  url: string
  /** The recipient's address. */
  email: string
  /** Their name, when the user has one. */
  name?: string
}

/** The mailer the controller sends through: the `mailer` binding from `kitr/mail`. */
export interface AuthMailer {
  send(template: any, props: any, options: { to: string }): Promise<unknown>
}

/** Options of `createSessionController`. */
export interface SessionControllerOptions<TUser extends AuthUser> {
  /** From `createCookieSession`. */
  sessions: CookieSessions
  /** Your `UserProvider`. */
  users: UserProvider<TUser>
  /** Email for sign-up verification and password reset. Leave out to turn both off (their routes answer 404). */
  mail?: {
    /** The "confirm your address" email. */
    verifyEmail?: AuthMailTemplate<AuthMailProps>
    /** The "reset your password" email. */
    resetPassword?: AuthMailTemplate<AuthMailProps>
    /** Pages the links point at, with `?token=` appended. Default `/verify-email` and `/reset-password`. */
    paths?: { verifyEmail?: string; resetPassword?: string }
  }
  /** The mailer, given the request's app. Default: `app.container.use('mailer')`. */
  mailer?: (app: ControllerContext['app']) => AuthMailer
  /** The public origin links in emails point at (`https://app.acme.com`). Set it in production: the request's own origin is only a fallback. */
  appUrl?: string
  /** Refuse sign-in until the email is confirmed. Default false. */
  requireVerifiedEmail?: boolean
  /** Shortest accepted password. Default 8. */
  minPasswordLength?: number
  /** Lifetime of the email links in seconds. Defaults: 24 hours to verify, 1 hour to reset. */
  tokenTtl?: { verifyEmail?: number; resetPassword?: number }
  /**
   * Called with the user's id after every one of their sessions was revoked (sign out everywhere,
   * password reset). Close the user's live connections here, since a socket is authorised when it
   * opens: `onSessionsRevoked: (id) => realtime.closeSessions(id)`.
   */
  onSessionsRevoked?: (userId: string) => void | Promise<void>
  /**
   * The double-submit CSRF check on every state-changing method, with shield's names by default
   * (`kitr-csrf` cookie, `x-csrf-token` header). The check is the controller's own, so it holds
   * with or without `shield(server)`; `false` turns it off.
   */
  csrf?: false | { cookie?: string; header?: string }
}

/** The slice of an `@kitr/api` `HttpContext` the controller uses. An `HttpContext` fits as it is. */
export interface ControllerContext<Body = unknown> {
  body: Body
  app: { container: { has(key: string): boolean; use(key: string): any } }
  logger: { error(message: string, data?: unknown): void }
  request: { url: URL; headers: Headers; header(name: string): string | null }
  response: { status(code: number): unknown; header(name: string, value: string): unknown }
  event: { res: { headers: Headers } }
  locals: Record<string, unknown>
}

const schema = <T>(
  check: (input: Record<string, unknown>) => Array<[field: string, message: string]> | T,
): StandardSchemaV1<unknown, T> => ({
  '~standard': {
    version: 1,
    vendor: 'kitr',
    validate(value) {
      const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
      const result = check(input)
      if (Array.isArray(result) && result.every((r) => Array.isArray(r)))
        return {
          issues: (result as Array<[string, string]>).map(([field, message]) => ({
            message,
            path: [field],
          })),
        }
      return { value: result as T }
    },
  },
})

const text = (input: Record<string, unknown>, field: string) =>
  typeof input[field] === 'string' ? (input[field] as string) : ''
const looksLikeEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254
const MAX_PASSWORD = 256

/** A throwaway hash, verified against when the email is unknown so a miss takes as long as a hit. */
let dummyHash: Promise<string> | undefined // kitr-allow-module-state: one throwaway hash per process, computed once for constant-time misses

/**
 * The cookie-session routes as a controller: the same shape as any `@kitr/api` controller, so the
 * route table links methods by name and the typed client sees their inputs and outputs.
 *
 *   const AuthController = createSessionController({ sessions, users, mail: { verifyEmail, resetPassword } })
 *
 *   r.get('/auth/session', [AuthController, 'session'], { name: 'auth.session' })
 *   r.post('/auth/sign-in', [AuthController, 'signIn'], { name: 'auth.signIn' })
 *
 * Methods: `session` (GET, who am I), `signIn`, `signUp`, `signOut`, `signOutAll`,
 * `requestVerification`, `verifyEmail`, `requestPasswordReset` and `resetPassword`. Every
 * state-changing method checks the CSRF token first.
 */
export function createSessionController<TUser extends AuthUser>(
  options: SessionControllerOptions<TUser>,
) {
  const { sessions, users } = options
  const minPassword = options.minPasswordLength ?? 8
  const csrfNames =
    options.csrf === false
      ? null
      : {
          cookie: options.csrf?.cookie ?? 'kitr-csrf',
          header: options.csrf?.header ?? 'x-csrf-token',
        }
  const ttl = {
    verifyEmail: options.tokenTtl?.verifyEmail ?? 60 * 60 * 24,
    resetPassword: options.tokenTtl?.resetPassword ?? 60 * 60,
  }

  const checkCsrf = (ctx: ControllerContext<any>) => {
    if (!csrfNames) return
    const sent = ctx.request.header(csrfNames.header)
    const raw = readCookie(ctx.request.headers, csrfNames.cookie)
    let cookie = raw
    try {
      cookie = raw === undefined ? undefined : decodeURIComponent(raw)
    } catch {}
    if (!sent || !cookie || !safeEqual(sent, cookie))
      throw new KitrError('FORBIDDEN', 'CSRF token missing or invalid')
  }

  const current = (ctx: ControllerContext<any>): Promise<ResolvedSession<TUser> | null> =>
    resolveSession({ sessions, users }, ctx.request.headers, ctx.event.res.headers)

  const payload = (resolved: ResolvedSession<TUser> | null): SessionPayload<TUser> => ({
    user: resolved?.user ?? null,
    expiresAt: resolved?.session.expiresAt,
  })

  const link = (ctx: ControllerContext<any>, path: string, token: string) =>
    `${(options.appUrl ?? ctx.request.url.origin).replace(/\/$/, '')}${path}?token=${encodeURIComponent(token)}`

  const sendMail = async (
    ctx: ControllerContext<any>,
    kind: 'verifyEmail' | 'resetPassword',
    user: TUser,
    token: string,
  ) => {
    const template = options.mail?.[kind]
    if (!template) throw KitrError.notFound('Email')
    const mailer = options.mailer
      ? options.mailer(ctx.app)
      : (ctx.app.container.use('mailer') as AuthMailer)
    const path =
      options.mail?.paths?.[kind] ?? (kind === 'verifyEmail' ? '/verify-email' : '/reset-password')
    const name = (user as { name?: unknown }).name
    await mailer.send(
      template,
      {
        url: link(ctx, path, token),
        email: user.email,
        ...(typeof name === 'string' ? { name } : {}),
      } satisfies AuthMailProps,
      { to: user.email },
    )
  }

  const sendVerification = async (ctx: ControllerContext<any>, user: TUser) => {
    if (!options.mail?.verifyEmail) return
    try {
      const token = await createToken(
        sessions,
        'verify-email',
        user.id,
        ttl.verifyEmail,
        await fingerprint(user.email.toLowerCase()),
      )
      await sendMail(ctx, 'verifyEmail', user, token)
    } catch (error) {
      // A mail outage must not fail the sign-up; the user can ask for another email.
      ctx.logger.error('could not send the verification email', error)
    }
  }

  const signedIn = async (
    ctx: ControllerContext<any>,
    user: TUser,
  ): Promise<SessionPayload<TUser>> => {
    const record = await sessions.create(user.id, ctx.event.res.headers, {
      request: ctx.request.headers,
    })
    return { user, expiresAt: record.expiresAt }
  }

  const checkPassword = (password: string, field = 'password'): Array<[string, string]> => {
    if (password.length < minPassword) return [[field, `Use at least ${minPassword} characters`]]
    if (password.length > MAX_PASSWORD) return [[field, `Use at most ${MAX_PASSWORD} characters`]]
    return []
  }

  type Credentials = { email: string; password: string }
  const credentials = schema<Credentials>((input) => {
    const email = text(input, 'email').trim().toLowerCase()
    const password = text(input, 'password')
    const issues: Array<[string, string]> = []
    if (!looksLikeEmail(email)) issues.push(['email', 'Enter a valid email'])
    if (!password || password.length > MAX_PASSWORD)
      issues.push(['password', 'Password is required'])
    return issues.length ? issues : { email, password }
  })
  type SignUp = Credentials & { name?: string }
  const signUpBody = schema<SignUp>((input) => {
    const email = text(input, 'email').trim().toLowerCase()
    const password = text(input, 'password')
    const name = text(input, 'name').trim()
    const issues: Array<[string, string]> = []
    if (!looksLikeEmail(email)) issues.push(['email', 'Enter a valid email'])
    issues.push(...checkPassword(password))
    return issues.length ? issues : { email, password, ...(name ? { name } : {}) }
  })
  const emailBody = schema<{ email: string }>((input) => {
    const email = text(input, 'email').trim().toLowerCase()
    return looksLikeEmail(email) ? { email } : [['email', 'Enter a valid email']]
  })
  const tokenBody = schema<{ token: string }>((input) => {
    const token = text(input, 'token')
    return token ? { token } : [['token', 'Token is required']]
  })
  const resetBody = schema<{ token: string; password: string }>((input) => {
    const token = text(input, 'token')
    const password = text(input, 'password')
    const issues: Array<[string, string]> = []
    if (!token) issues.push(['token', 'Token is required'])
    issues.push(...checkPassword(password))
    return issues.length ? issues : { token, password }
  })

  return class SessionController {
    static validation = {
      signIn: { body: credentials },
      signUp: { body: signUpBody },
      requestPasswordReset: { body: emailBody },
      verifyEmail: { body: tokenBody },
      resetPassword: { body: resetBody },
    }

    /** `GET`: the signed-in user and when the session ends, `{ user: null }` when anonymous. Never cached. */
    async session(ctx: ControllerContext): Promise<SessionPayload<TUser>> {
      ctx.response.header('cache-control', 'no-store')
      ctx.response.header('vary', 'cookie')
      return payload(await current(ctx))
    }

    /** `POST` `{ email, password }`: check the password, start a session (new id) and set the cookie. */
    async signIn(ctx: ControllerContext<Credentials>): Promise<SessionPayload<TUser>> {
      checkCsrf(ctx)
      const stored = await users.findByEmail(ctx.body.email)
      dummyHash ??= hashPassword(crypto.randomUUID())
      const ok = await verifyPassword(ctx.body.password, stored?.passwordHash ?? (await dummyHash))
      if (!stored?.passwordHash || !ok) throw KitrError.unauthorized('Wrong email or password')
      if (options.requireVerifiedEmail && !stored.emailVerified)
        throw KitrError.forbidden('Confirm your email address first')
      if (users.setPasswordHash && needsRehash(stored.passwordHash))
        await users.setPasswordHash(stored.user.id, await hashPassword(ctx.body.password))
      return signedIn(ctx, stored.user)
    }

    /** `POST` `{ email, password, name? }`: create the user, send the verification email and sign them in. */
    async signUp(ctx: ControllerContext<SignUp>): Promise<SessionPayload<TUser>> {
      checkCsrf(ctx)
      if (await users.findByEmail(ctx.body.email))
        throw new KitrError('CONFLICT', 'That email is already registered')
      const user = await users.create({
        email: ctx.body.email,
        passwordHash: await hashPassword(ctx.body.password),
        ...(ctx.body.name ? { name: ctx.body.name } : {}),
      })
      await sendVerification(ctx, user)
      ctx.response.status(201)
      return signedIn(ctx, user)
    }

    /** `POST`: end this session and expire the cookie. Answers 204 whether or not anyone was signed in. */
    async signOut(ctx: ControllerContext): Promise<void> {
      checkCsrf(ctx)
      await sessions.destroy(ctx.request.headers, ctx.event.res.headers)
      ctx.response.status(204)
    }

    /** `POST`: end every session of the signed-in user, on every device, and expire this cookie. */
    async signOutAll(ctx: ControllerContext): Promise<{ revoked: number }> {
      checkCsrf(ctx)
      const resolved = await current(ctx)
      if (!resolved) throw KitrError.unauthorized()
      const revoked = await sessions.revokeAll(resolved.user.id)
      await sessions.destroy(ctx.request.headers, ctx.event.res.headers)
      await options.onSessionsRevoked?.(resolved.user.id)
      return { revoked }
    }

    /** `POST`: email the signed-in user a fresh verification link. */
    async requestVerification(ctx: ControllerContext): Promise<void> {
      checkCsrf(ctx)
      if (!options.mail?.verifyEmail) throw KitrError.notFound('Email verification')
      const resolved = await current(ctx)
      if (!resolved) throw KitrError.unauthorized()
      await sendVerification(ctx, resolved.user)
      ctx.response.status(202)
    }

    /** `POST` `{ token }`: confirm the address the link was sent to. 400 when the link is wrong or expired. */
    async verifyEmail(ctx: ControllerContext<{ token: string }>): Promise<void> {
      checkCsrf(ctx)
      if (!users.markEmailVerified) throw KitrError.notFound('Email verification')
      const id = await readToken(sessions, 'verify-email', ctx.body.token, async (subject) => {
        const user = await users.findById(subject)
        return user ? fingerprint(user.email.toLowerCase()) : ''
      })
      if (!id) throw new KitrError('BAD_REQUEST', 'This link is invalid or has expired')
      await users.markEmailVerified(id)
      ctx.response.status(204)
    }

    /** `POST` `{ email }`: email a reset link when the address has an account. Always 202, so it cannot be used to find accounts. */
    async requestPasswordReset(ctx: ControllerContext<{ email: string }>): Promise<void> {
      checkCsrf(ctx)
      if (!options.mail?.resetPassword || !users.setPasswordHash)
        throw KitrError.notFound('Password reset')
      const stored = await users.findByEmail(ctx.body.email)
      if (stored?.passwordHash) {
        try {
          // Bound to the current hash: once the password changes, the link stops working.
          const token = await createToken(
            sessions,
            'reset-password',
            stored.user.id,
            ttl.resetPassword,
            await fingerprint(stored.passwordHash),
          )
          await sendMail(ctx, 'resetPassword', stored.user, token)
        } catch (error) {
          ctx.logger.error('could not send the password reset email', error)
        }
      }
      ctx.response.status(202)
    }

    /** `POST` `{ token, password }`: set a new password, and end every session the old one had. */
    async resetPassword(
      ctx: ControllerContext<{ token: string; password: string }>,
    ): Promise<void> {
      checkCsrf(ctx)
      if (!users.setPasswordHash) throw KitrError.notFound('Password reset')
      const id = await readToken(sessions, 'reset-password', ctx.body.token, async (subject) => {
        const user = await users.findById(subject)
        const stored = user ? await users.findByEmail(user.email.toLowerCase()) : null
        return fingerprint(stored?.passwordHash ?? '')
      })
      if (!id) throw new KitrError('BAD_REQUEST', 'This link is invalid or has expired')
      await users.setPasswordHash(id, await hashPassword(ctx.body.password))
      await sessions.revokeAll(id)
      await options.onSessionsRevoked?.(id)
      ctx.response.status(204)
    }
  }
}
