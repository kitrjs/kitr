/**
 * The files `kitr add auth` writes, one function each. Plain strings: a setup module stays free
 * of Node imports. The saas kit overwrites some of them with its own (typed client, nicer pages).
 */

/** The three ways users sign in; `kitr add auth --provider <name>`. */
export type AuthProvider = 'session' | 'better-auth' | 'token'

/** `config/auth.ts` for bearer tokens: the original adapter, for an SPA in front of an API that issues tokens. */
export const tokenConfig = `import { defineConfig, localStorageTokens, tokenAdapter } from 'kitr/auth'
import { type User, abilities } from '#app/abilities'
import { env } from '#app/env'

// Swap for betterAuthAdapter(createAuthClient()) or a customAdapter({...}).
const adapter = tokenAdapter<User>({
  abilities,
  storage: localStorageTokens(),
  fetchUser: async (token) => {
    const res = await fetch(\`\${env.VITE_API_URL}/me\`, { headers: { authorization: \`Bearer \${token}\` } })
    return res.ok ? ((await res.json()) as User) : null
  },
  signIn: async (credentials) => {
    const res = await fetch(\`\${env.VITE_API_URL}/sign-in\`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(credentials) })
    if (!res.ok) throw new Error('Invalid credentials')
    return (await res.json()) as { token: string; refreshToken?: string }
  },
})

export default defineConfig({ adapter, signInPath: '/sign-in' })
`

/** `config/auth.ts` for cookie sessions, over plain `fetch`: the cookie rides along, the CSRF token is echoed on writes. */
export const sessionConfig = `import { defineConfig, type SessionPayload, sessionAdapter } from 'kitr/auth'
import { type User, abilities } from '#app/abilities'

/** shield's double-submit token: the readable cookie, echoed in a header on writes. */
const csrfToken = () => {
  const match = /(?:^|;\\s*)kitr-csrf=([^;]+)/.exec(document.cookie)
  return match ? decodeURIComponent(match[1]!) : ''
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await fetch(\`/api/auth/\${path}\`, {
    method,
    credentials: 'same-origin',
    headers: {
      accept: 'application/json',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(method === 'POST' ? { 'x-csrf-token': csrfToken() } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = res.status === 204 ? undefined : await res.json().catch(() => undefined)
  if (!res.ok) throw new Error((data as { message?: string } | undefined)?.message ?? 'Request failed')
  return data as T
}

/**
 * The session lives in an HttpOnly cookie the server sets (server/controllers/auth_controller.ts);
 * this adapter never sees a token. Server rendering reads the same session from the request.
 */
const adapter = sessionAdapter<User>({
  abilities,
  fetchSession: () => call<SessionPayload<User>>('GET', 'session'),
  signIn: (credentials) => call('POST', 'sign-in', credentials),
  signOut: () => call('POST', 'sign-out'),
})

export default defineConfig({ adapter, signInPath: '/sign-in' })
`

/** `server/auth.ts`: the session service and the users it signs in. */
export const serverAuth = `import { inProduction } from 'kitr/app'
import { createCookieSession, createMemorySessionStore, createMemoryUserProvider } from 'kitr/auth/server'
import type { User } from '#app/abilities'
import { env } from '#app/env'

/** Signs the session cookie: at least 32 random characters (\`openssl rand -base64 32\`), in SESSION_SECRET. */
function sessionSecret() {
  if (env.SESSION_SECRET) return env.SESSION_SECRET
  if (inProduction()) throw new Error('SESSION_SECRET is not set: generate one with \`openssl rand -base64 32\`.')
  return 'development-only-secret-not-for-production'
}

/**
 * Where sessions live. In memory is fine for one process and is lost on restart. For several
 * instances, share them through Redis:
 *
 *   import { Redis } from 'ioredis'
 *   store: createRedisSessionStore(new Redis(process.env.REDIS_URL))
 */
export const sessions = createCookieSession({
  secret: sessionSecret(),
  store: createMemorySessionStore(),
})

/** Where users live: in memory for the demo. Implement \`UserProvider\` over your database and swap it in. */
export const users = createMemoryUserProvider<User>({
  build: (input, id) => ({ id, email: input.email, role: 'member' }),
})

/** What the controller, the middleware and \`runWithSession\` take. */
export const auth = { sessions, users }
`

/** `server/controllers/auth_controller.ts`. */
export const authController = (
  emails: boolean,
) => `import { createSessionController } from 'kitr/auth/server'
${emails ? "import { resetPasswordMail, verifyEmailMail } from '#server/mail/auth'\n" : ''}import { auth } from '#server/auth'

/**
 * Session, sign-in, sign-up, sign-out${emails ? ', email verification and password reset' : ''} as one controller.
 * \`server/routes.ts\` links its methods; every state-changing one checks the CSRF token.
 */
export default createSessionController({
  ...auth,${
    emails
      ? `
  // Links in emails point at APP_URL, never at whatever Host header the request carried.
  appUrl: process.env.APP_URL,
  mail: { verifyEmail: verifyEmailMail, resetPassword: resetPasswordMail },`
      : ''
  }
})
`

/** `server/mail/auth.tsx`: the two emails the controller sends. */
export const authMail = `import { defineMail } from 'kitr/mail'
import type { AuthMailProps } from 'kitr/auth/server'

const page = (heading: string, intro: string, cta: string, url: string) => (
  <html lang="en">
    <body style={{ fontFamily: 'system-ui, sans-serif', lineHeight: 1.5, color: '#111' }}>
      <h1 style={{ fontSize: 20 }}>{heading}</h1>
      <p>{intro}</p>
      <p>
        <a href={url} style={{ background: '#111', color: '#fff', padding: '10px 16px', borderRadius: 6, textDecoration: 'none' }}>
          {cta}
        </a>
      </p>
      <p style={{ color: '#666', fontSize: 13 }}>If the button does not work, paste this link into your browser: {url}</p>
    </body>
  </html>
)

const preview: AuthMailProps = { url: 'http://localhost:3000/verify-email?token=preview', email: 'ada@example.com', name: 'Ada' }

/** Sent after sign-up and on request. The link opens /verify-email, which posts the token to the API. */
export const verifyEmailMail = defineMail<AuthMailProps>('verify-email', {
  subject: 'Confirm your email address',
  preview,
  render: ({ url, name }) => page(\`Welcome\${name ? \`, \${name}\` : ''}\`, 'Confirm your email address to finish setting up your account.', 'Confirm email', url),
})

/** Sent when someone asks to reset a password. The link works once and expires after an hour. */
export const resetPasswordMail = defineMail<AuthMailProps>('reset-password', {
  subject: 'Reset your password',
  preview: { ...preview, url: 'http://localhost:3000/reset-password?token=preview' },
  render: ({ url }) => page('Reset your password', 'Someone asked to reset the password for this account. If it was you, choose a new one. If not, ignore this email.', 'Choose a new password', url),
})
`

/** A plain sign-in page for projects without a kit's components. */
export const signInPage = `import { useAuth } from 'kitr/auth'
import { useNavigate } from 'kitr/router'
import { useState } from 'react'
import type { User } from '#app/abilities'

/** Replace the markup with your own components; the logic is one \`auth.signIn()\` call. */
export default function SignInPage() {
  const auth = useAuth<User, { email: string; password: string }>()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  return (
    <main style={{ maxWidth: 360, margin: '4rem auto', padding: 16 }}>
      <h1>Sign in</h1>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          try {
            await auth.signIn({ email: String(form.get('email')), password: String(form.get('password')) })
            await navigate({ to: new URLSearchParams(location.search).get('redirect') ?? '/' })
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not sign in')
          }
        }}
      >
        <p>
          <input name="email" type="email" autoComplete="email" placeholder="Email" required />
        </p>
        <p>
          <input name="password" type="password" autoComplete="current-password" placeholder="Password" required />
        </p>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit">Sign in</button>
      </form>
    </main>
  )
}
`

/** `server/better_auth.ts`: the Better Auth server as a provider, so it lives in the container like everything else. */
export const betterAuthProvider = `import { defineProvider } from 'kitr/app'
import type { betterAuth } from 'better-auth'

declare module '@kitr/core' {
  interface ContainerBindings {
    /** The Better Auth server: \`app.container.use('betterAuth').api.getSession({ headers })\` in a controller. */
    betterAuth: ReturnType<typeof betterAuth>
  }
}

/**
 * Binds \`betterAuth\` on the server (the browser has only the client in config/auth.ts).
 * Better Auth keeps users and sessions in a database: this uses its in-memory adapter so it runs
 * out of the box. Swap \`database\` for your own (\`drizzleAdapter\`, \`prismaAdapter\`, a \`pg\` pool...).
 */
export default defineProvider({
  name: 'better-auth',
  register(app) {
    if (app.isClient) return
    app.container.singleton('betterAuth', async () => {
      const { betterAuth } = await import('better-auth')
      const { memoryAdapter } = await import('better-auth/adapters/memory')
      return betterAuth({
        secret: process.env.BETTER_AUTH_SECRET,
        baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
        database: memoryAdapter({}),
        emailAndPassword: { enabled: true },
      })
    })
  },
})
`

/** `config/auth.ts` for Better Auth: its client adapter, talking to `/api/auth/*` on the same origin. */
export const betterAuthConfig = `import { createAuthClient } from 'better-auth/client'
import { betterAuthAdapter, defineConfig } from 'kitr/auth'
import { type User, abilities } from '#app/abilities'

/** Better Auth's own routes (\`/api/auth/*\`, mounted in server/main.ts) set and read the session cookie. */
const adapter = betterAuthAdapter<User>(createAuthClient(), { abilities })

export default defineConfig({ adapter, signInPath: '/sign-in' })
`
