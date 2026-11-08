import { describe, expect, it } from 'vitest'
import auth from '../src/kitr'
import { authController } from '../src/templates'

interface Recorded {
  writes: Record<string, string>
  configs: Record<string, string>
  providers: string[]
  removedProviders: string[]
  agents: Record<string, string>
  env: Array<Record<string, string>>
  envSchema: string[]
  deps: string[]
  routes: string[]
  pages: string[]
  attaches: Array<{ marker: string; line: string }>
  warnings: string[]
  edits: Record<string, string>
}

/** A recording stand-in for the codemod context; `files` are what already exists in the project. */
function fakeCtx(
  answers: Record<string, unknown>,
  options: { packages?: string[]; files?: Record<string, string>; appendOk?: boolean } = {},
) {
  const rec: Recorded = {
    writes: {},
    configs: {},
    providers: [],
    removedProviders: [],
    agents: {},
    env: [],
    envSchema: [],
    deps: [],
    routes: [],
    pages: [],
    attaches: [],
    warnings: [],
    edits: {},
  }
  const files = { ...options.files }
  const packages = new Set(options.packages ?? ['server', 'mail', 'react'])
  const ctx = {
    answers,
    hasPackage: (name: string) => packages.has(name),
    has: (name: string) => packages.has(name),
    exists: (file: string) => file in files || file in rec.writes,
    write: (file: string, src: string) => {
      rec.writes[file] = src
    },
    config: (name: string, src: string) => {
      rec.configs[name] = src
    },
    edit: (file: string, fn: (mod: unknown, src: string) => string) => {
      if (file in files) rec.edits[file] = fn(undefined, files[file] as string)
    },
    provider: {
      add: (p: string) => rec.providers.push(p),
      remove: (p: string) => rec.removedProviders.push(p),
    },
    env: {
      add: (vars: Record<string, string>) => rec.env.push(vars),
      schema: (_scope: string, name: string) => rec.envSchema.push(name),
    },
    deps: { add: (d: string) => rec.deps.push(d) },
    routes: {
      append: (line: string) => {
        if (options.appendOk === false) return false
        rec.routes.push(line)
        return true
      },
      addPage: (path: string) => {
        rec.pages.push(path)
        return true
      },
    },
    server: { attach: (o: { marker: string; line: string }) => rec.attaches.push(o) },
    agents: {
      add: (name: string, text: string) => {
        rec.agents[name] = text
      },
      remove: () => {},
    },
    log: { warn: (m: string) => rec.warnings.push(m), step: () => {}, success: () => {} },
  }
  return { ctx, rec }
}

const PLAIN_ROUTER = `import { createKitrRouter } from '@kitr/router'
import { app } from './app'
import { routes } from './routes'

export function getRouter() {
  return createKitrRouter({ routes, app })
}
`

describe('kitr add auth', () => {
  it('writes the bearer-token setup by default', async () => {
    const { ctx, rec } = fakeCtx({})
    await auth.add!(ctx as never)
    expect(rec.providers).toEqual(['@kitr/auth/provider'])
    expect(rec.configs.auth).toContain('tokenAdapter')
    expect(rec.writes['app/abilities.ts']).toContain('defineAbilities')
    expect(rec.envSchema).toEqual(['VITE_API_URL'])
    expect(rec.writes['server/auth.ts']).toBeUndefined()
    expect(rec.agents.auth).toContain('requireAuth()')
  })

  it('wires cookie sessions: controller, users, routes, env, sign-in page', async () => {
    const { ctx, rec } = fakeCtx({ provider: 'session', emails: true })
    await auth.add!(ctx as never)
    expect(rec.configs.auth).toContain('sessionAdapter')
    expect(rec.writes['server/auth.ts']).toContain('createCookieSession')
    expect(rec.writes['server/controllers/auth_controller.ts']).toContain('createSessionController')
    expect(rec.writes['server/mail/auth.tsx']).toContain('defineMail')
    expect(rec.writes['app/pages/sign-in.tsx']).toBeDefined()
    expect(rec.pages).toEqual(['/sign-in'])
    expect(rec.envSchema).toEqual(['SESSION_SECRET'])
    expect(rec.env[0]).toHaveProperty('APP_URL')
    expect(rec.routes.some((r) => r.includes('/api/auth/password/reset'))).toBe(true)
    expect(rec.routes.some((r) => r.includes('/api/auth/sign-in'))).toBe(true)
    expect(rec.agents.auth).toContain('HttpOnly')
  })

  it('leaves out the email routes and templates without them', async () => {
    const { ctx, rec } = fakeCtx({ provider: 'session', emails: false })
    await auth.add!(ctx as never)
    expect(rec.writes['server/mail/auth.tsx']).toBeUndefined()
    expect(rec.writes['server/controllers/auth_controller.ts']).not.toContain('resetPassword:')
    expect(rec.routes.some((r) => r.includes('password'))).toBe(false)
  })

  it('warns when emails are wanted but the mail package is missing', async () => {
    const { ctx, rec } = fakeCtx({ provider: 'session' }, { packages: ['server', 'react'] })
    await auth.add!(ctx as never)
    expect(rec.warnings.join('\n')).toMatch(/kitr add mail/)
    expect(rec.writes['server/mail/auth.tsx']).toBeUndefined()
  })

  it('tells the user to link routes by hand when the route table cannot be edited', async () => {
    const { ctx, rec } = fakeCtx({ provider: 'session', emails: true }, { appendOk: false })
    await auth.add!(ctx as never)
    expect(rec.warnings.join('\n')).toMatch(/server\/routes\.ts by hand/)
  })

  it('keeps an existing sign-in page', async () => {
    const { ctx, rec } = fakeCtx(
      { provider: 'session' },
      { files: { 'app/pages/sign-in.tsx': 'mine' } },
    )
    await auth.add!(ctx as never)
    expect(rec.writes['app/pages/sign-in.tsx']).toBeUndefined()
  })

  it('refuses cookie sessions without a server', async () => {
    const { ctx } = fakeCtx({ provider: 'session' }, { packages: ['react'] })
    await expect(Promise.resolve().then(() => auth.add!(ctx as never))).rejects.toThrow(/server/)
  })

  it('wraps page rendering in the session scope, once', async () => {
    const page = `import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { server } from '#server/main'

export default createServerEntry({
  fetch(request, options) {
    if (server.handles(request)) return server.fetch(request)
    return handler.fetch(request, options)
  },
})
`
    const { ctx, rec } = fakeCtx({ provider: 'session' }, { files: { 'app/server.ts': page } })
    await auth.add!(ctx as never)
    const edited = rec.edits['app/server.ts'] as string
    expect(edited).toContain('runWithSession(auth, request, () => handler.fetch(request, options))')
    expect(edited).toContain("import { auth } from '#server/auth'")

    const again = fakeCtx({ provider: 'session' }, { files: { 'app/server.ts': edited } })
    await auth.add!(again.ctx as never)
    expect(again.rec.edits['app/server.ts']).toBe(edited)
  })

  it('gives the router a stand-in session for cookies, and the live getter for tokens', async () => {
    const cookies = fakeCtx({ provider: 'session' }, { files: { 'app/router.tsx': PLAIN_ROUTER } })
    await auth.add!(cookies.ctx as never)
    const cookieRouter = cookies.rec.edits['app/router.tsx'] as string
    expect(cookieRouter).toContain('new Proxy')
    expect(cookieRouter).toContain("import type { KitrApp } from 'kitr/app'")
    expect(cookieRouter).toContain('KitrRouterContext')

    const tokens = fakeCtx({}, { files: { 'app/router.tsx': PLAIN_ROUTER } })
    await auth.add!(tokens.ctx as never)
    const tokenRouter = tokens.rec.edits['app/router.tsx'] as string
    expect(tokenRouter).toContain('get session()')
    expect(tokenRouter).not.toContain('Proxy')

    // Already wired: left alone.
    const again = fakeCtx({}, { files: { 'app/router.tsx': tokenRouter } })
    await auth.add!(again.ctx as never)
    expect(again.rec.edits['app/router.tsx']).toBe(tokenRouter)
  })

  it('sets up Better Auth in the container and on the server', async () => {
    const { ctx, rec } = fakeCtx({ provider: 'better-auth' })
    await auth.add!(ctx as never)
    expect(rec.deps).toEqual(['better-auth'])
    expect(rec.providers).toContain('./server/better_auth')
    expect(rec.writes['server/better_auth.ts']).toContain('betterAuth')
    expect(rec.configs.auth).toContain('createAuthClient')
    expect(rec.attaches[0]?.line).toContain("'/api/auth/**'")
    expect(rec.agents.auth).toContain('Better Auth')
  })

  it('removes what it wired and warns about files that are now the project’s', async () => {
    const cookies = fakeCtx({ provider: 'session' }, { files: { 'app/router.tsx': PLAIN_ROUTER } })
    await auth.add!(cookies.ctx as never)
    const wired = cookies.rec.edits['app/router.tsx'] as string

    const removal = fakeCtx({}, { files: { 'app/router.tsx': wired, 'server/auth.ts': 'x' } })
    await auth.remove!(removal.ctx as never)
    expect(removal.rec.edits['app/router.tsx']).toBe(PLAIN_ROUTER)
    expect(removal.rec.removedProviders).toContain('@kitr/auth/provider')
    expect(removal.rec.warnings.join('\n')).toContain('server/auth.ts')

    const tokens = fakeCtx({}, { files: { 'app/router.tsx': PLAIN_ROUTER } })
    await auth.add!(tokens.ctx as never)
    const tokenRouter = tokens.rec.edits['app/router.tsx'] as string
    const back = fakeCtx({}, { files: { 'app/router.tsx': tokenRouter } })
    await auth.remove!(back.ctx as never)
    expect(back.rec.edits['app/router.tsx']).toBe(PLAIN_ROUTER)
  })
})

describe('auth templates', () => {
  it('the controller template follows the emails choice', () => {
    expect(authController(true)).toContain('resetPassword')
    expect(authController(false)).not.toContain('resetPassword')
  })
})
