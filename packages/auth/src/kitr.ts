import { type AddContext, definePackage } from '@kitr/core/package'
import {
  type AuthProvider,
  authController,
  authMail,
  betterAuthConfig,
  betterAuthProvider,
  serverAuth,
  sessionConfig,
  signInPage,
  tokenConfig,
} from './templates'

/**
 * The router call `kitr add router` writes (`routes`, the table; `routeTree` in a project on file
 * routes), and the one `kitr add auth` turns it into.
 */
const PLAIN_ROUTER_CALL = /return createKitrRouter\(\{ (routes|routeTree), app \}\)/
const sessionRouterCall = (tree: string) => `return createKitrRouter({
    ${tree},
    app,
    context: {
      // A live getter, so requireAuth() sees the session the auth provider restores during boot.
      get session() {
        const auth = app.container.has('auth') ? app.container.use('auth') : null
        return (auth?.session ?? null) as Session<User> | null
      },
    },
  })`
const SESSION_CONTEXT_TYPE = `
declare module '@kitr/router' {
  interface KitrRouterContext {
    session: Session<User> | null
  }
}
`

/** The server entry the web platform writes, and what it becomes once pages render inside the session scope. */
const PLAIN_PAGE_HANDLER = 'return handler.fetch(request, options)'
const SESSION_PAGE_HANDLER =
  'return runWithSession(auth, request, () => handler.fetch(request, options))'

/**
 * `kitr add auth --provider session` without a choice means cookie sessions when the project has
 * a server to hold them, and bearer tokens (what the SPA kits have always had) when it does not.
 */
function chooseProvider(ctx: AddContext): AuthProvider {
  const asked = ctx.answers.provider as AuthProvider | undefined
  if (asked === 'better-auth' || asked === 'token') return asked
  if (asked === 'session') {
    if (!ctx.hasPackage('server'))
      throw new Error(
        '[kitr/auth] --provider session keeps sessions on a server: run `kitr add server api` first, or use --provider token.',
      )
    return 'session'
  }
  return 'token'
}

/** Cookie sessions: controller, users, routes, config, sign-in page and the SSR session scope. */
function setupSession(ctx: AddContext) {
  const wantsEmails = ctx.answers.emails !== false
  const emails = wantsEmails && ctx.hasPackage('mail')
  if (wantsEmails && !emails)
    ctx.log.warn(
      'Email verification and password reset need `kitr add mail`; the controller is written without them. Re-run with --no-emails to silence this.',
    )
  ctx.config('auth', sessionConfig)
  ctx.write('server/auth.ts', serverAuth)
  ctx.write('server/controllers/auth_controller.ts', authController(emails))
  if (emails) ctx.write('server/mail/auth.tsx', authMail)
  ctx.env.schema('server', 'SESSION_SECRET', 'e.string({ optional: true })', '')
  ctx.env.add({ APP_URL: 'http://localhost:3000' }, 'Auth: where links in emails point')

  const routes: Array<[method: 'get' | 'post', path: string, name: string]> = [
    ['get', '/api/auth/session', 'session'],
    ['post', '/api/auth/sign-in', 'signIn'],
    ['post', '/api/auth/sign-up', 'signUp'],
    ['post', '/api/auth/sign-out', 'signOut'],
    ['post', '/api/auth/sign-out-all', 'signOutAll'],
    ...(emails
      ? ([
          ['post', '/api/auth/verify-email/request', 'requestVerification'],
          ['post', '/api/auth/verify-email', 'verifyEmail'],
          ['post', '/api/auth/password/forgot', 'requestPasswordReset'],
          ['post', '/api/auth/password/reset', 'resetPassword'],
        ] as const)
      : []),
  ]
  for (const [method, path, name] of routes) {
    const done = ctx.routes.append(
      `.${method}('${path}', [AuthController, '${name}'], { name: 'auth.${name}' })`,
      {
        table: 'server',
        imports: [
          {
            from: '#server/controllers/auth_controller',
            local: 'AuthController',
            imported: 'default',
          },
        ],
        skipIf: new RegExp(`name: 'auth\\.${name}'`),
      },
    )
    if (!done) {
      ctx.log.warn(
        `Add the auth routes to server/routes.ts by hand: .${method}('${path}', [AuthController, '${name}'])`,
      )
      break
    }
  }

  // Pages render inside the request's session, so beforeLoad and loaders see it during SSR.
  ctx.edit('app/server.ts', (_mod, src) =>
    src.includes('runWithSession') || !src.includes(PLAIN_PAGE_HANDLER)
      ? src
      : src
          .replace(
            "import { server } from '#server/main'\n",
            "import { runWithSession } from 'kitr/auth/server'\nimport { auth } from '#server/auth'\nimport { server } from '#server/main'\n",
          )
          .replace(PLAIN_PAGE_HANDLER, SESSION_PAGE_HANDLER),
  )
  if (ctx.has('react') && !ctx.exists('app/pages/sign-in.tsx')) {
    ctx.write('app/pages/sign-in.tsx', signInPage)
    if (!ctx.routes.addPage('/sign-in', './pages/sign-in'))
      ctx.log.warn(
        "Add the sign-in page to app/routes.ts by hand: .page('/sign-in', { lazy: () => import('./pages/sign-in') })",
      )
  }
}

/** Better Auth: its server in the container, its routes on the kitr server, its client in config/auth.ts. */
function setupBetterAuth(ctx: AddContext) {
  ctx.deps.add('better-auth')
  ctx.config('auth', betterAuthConfig)
  ctx.write('server/better_auth.ts', betterAuthProvider)
  ctx.provider.add('./server/better_auth')
  ctx.env.add(
    { BETTER_AUTH_SECRET: '', BETTER_AUTH_URL: 'http://localhost:3000' },
    'Better Auth: the secret signs sessions (openssl rand -base64 32)',
  )
  ctx.server.attach({
    marker: "'/api/auth/**'",
    line: "// Better Auth's own endpoints (sign-in, sign-up, session...) live under /api/auth.\nserver.h3.all('/api/auth/**', (event) => server.app.container.use('betterAuth').handler(event.req))",
  })
}

const GUARD_NOTES = `- Guard routes with \`beforeLoad: requireAuth()\` (from \`kitr/router\`) on a layout route; permissions with \`can('projects.update', { subject })\` or \`useCan()\` in components.\n- The session is \`useSession()\` / \`useUser()\` from \`kitr/auth\`. Abilities are plain functions in \`app/abilities.ts\`, shared with the API middleware (\`kitr/auth/server\`).`
const SESSION_NOTES =
  '\n- Server-rendered guards: `beforeLoad: async (ctx) => { await ensureSession(ctx); return requireAuth()(ctx) }` (`ensureSession` is from `kitr/auth`), so the session is read from the request during SSR and from `GET /api/auth/session` in the browser.\n- Sessions are HttpOnly cookies: `server/auth.ts` holds the session service and the `UserProvider` (swap the in-memory users and store for your database and Redis), `server/controllers/auth_controller.ts` the routes. Pages render inside `runWithSession` (app/server.ts). Never put a token in localStorage.'
const BETTER_AUTH_NOTES =
  "\n- Better Auth runs in the kitr server (`server/better_auth.ts`, `app.container.use('betterAuth')`) and answers `/api/auth/*`; the browser uses its client through `betterAuthAdapter`."
const agentNotes = (provider: AuthProvider) =>
  GUARD_NOTES +
  (provider === 'session' ? SESSION_NOTES : provider === 'better-auth' ? BETTER_AUTH_NOTES : '')

/** `kitr add auth`: session in router context, requireAuth()/can() guards, cookie-session, token and Better Auth providers. */
export default definePackage({
  name: 'auth',
  client: true,
  questions: [
    {
      name: 'provider',
      type: 'select',
      message: 'How do users sign in?',
      options: [
        {
          value: 'token',
          label: 'Bearer tokens',
          hint: 'An SPA in front of an API that issues tokens (the default)',
        },
        {
          value: 'session',
          label: 'Cookie sessions',
          hint: 'HttpOnly cookie, server-rendered guards, CSRF; needs a kitr server',
        },
        {
          value: 'better-auth',
          label: 'Better Auth',
          hint: 'Better Auth server in the container, its client in the browser',
        },
      ],
      default: 'token',
    },
    {
      name: 'emails',
      type: 'confirm',
      message: 'Send email verification and password reset emails?',
      default: true,
      when: (answers) => answers.provider === 'session',
    },
  ],
  add(ctx) {
    ctx.provider.add('@kitr/auth/provider')
    ctx.write(
      'app/abilities.ts',
      `import { defineAbilities } from 'kitr/auth'\n\nexport interface User {\n  id: string\n  email: string\n  role: 'admin' | 'member'\n}\n\nexport const abilities = defineAbilities({\n  'projects.update': (user: User, project: { ownerId: string }) => user.role === 'admin' || project.ownerId === user.id,\n})\n`,
    )
    const provider = chooseProvider(ctx)
    if (provider === 'session') setupSession(ctx)
    else if (provider === 'better-auth') setupBetterAuth(ctx)
    else {
      ctx.config('auth', tokenConfig)
      ctx.env.schema(
        'public',
        'VITE_API_URL',
        "e.url({ default: 'http://localhost:3333' })",
        'http://localhost:3333',
      )
    }
    // requireAuth() reads the session from the router context: wire it into the default router.
    ctx.edit('app/router.tsx', (_mod, src) => {
      const plain = src.match(PLAIN_ROUTER_CALL)
      return plain && !src.includes('KitrRouterContext')
        ? src
            .replace(
              "import { createKitrRouter } from 'kitr/router'\n",
              "import type { Session } from 'kitr/auth'\nimport { createKitrRouter } from 'kitr/router'\nimport type { User } from '#app/abilities'\n",
            )
            .replace(plain[0], sessionRouterCall(plain[1]!))
            .concat(SESSION_CONTEXT_TYPE)
        : src
    })
    ctx.agents.add('auth', agentNotes(provider))
  },
  remove(ctx) {
    ctx.edit('app/router.tsx', (_mod, src) => {
      const tree = (['routes', 'routeTree'] as const).find((t) =>
        src.includes(sessionRouterCall(t)),
      )
      return tree
        ? src
            .replace("import type { Session } from 'kitr/auth'\n", '')
            .replace("import type { User } from '#app/abilities'\n", '')
            .replace(sessionRouterCall(tree), `return createKitrRouter({ ${tree}, app })`)
            .replace(SESSION_CONTEXT_TYPE, '')
        : src
    })
    ctx.provider.remove('@kitr/auth/provider')
    ctx.provider.remove('./server/better_auth')
    ctx.agents.remove('auth')
    for (const file of ['server/auth.ts', 'server/controllers/auth_controller.ts'])
      if (ctx.exists(file)) ctx.log.warn(`${file} is yours now: delete it when nothing imports it.`)
  },
})
