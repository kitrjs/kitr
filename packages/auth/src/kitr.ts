import { definePackage } from '@kitr/core/package'

/** The router call `kitr add router` writes, and the one `kitr add auth` turns it into. */
const PLAIN_ROUTER_CALL = 'return createKitrRouter({ routeTree, app })'
const SESSION_ROUTER_CALL = `return createKitrRouter({
    routeTree,
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

/** `kitr add auth`: session in router context, requireAuth()/can() guards, token and Better Auth adapters. */
export default definePackage({
  name: 'auth',
  client: true,
  add(ctx) {
    ctx.provider.add('@kitr/auth/provider')
    ctx.write(
      'app/abilities.ts',
      `import { defineAbilities } from 'kitr/auth'\n\nexport interface User {\n  id: string\n  email: string\n  role: 'admin' | 'member'\n}\n\nexport const abilities = defineAbilities({\n  'projects.update': (user: User, project: { ownerId: string }) => user.role === 'admin' || project.ownerId === user.id,\n})\n`,
    )
    ctx.config(
      'auth',
      `import { defineConfig, localStorageTokens, tokenAdapter } from 'kitr/auth'\nimport { type User, abilities } from '#app/abilities'\nimport { env } from '#app/env'\n\n// Swap for betterAuthAdapter(createAuthClient()) or a customAdapter({...}).\nconst adapter = tokenAdapter<User>({\n  abilities,\n  storage: localStorageTokens(),\n  fetchUser: async (token) => {\n    const res = await fetch(\`\${env.VITE_API_URL}/me\`, { headers: { authorization: \`Bearer \${token}\` } })\n    return res.ok ? ((await res.json()) as User) : null\n  },\n  signIn: async (credentials) => {\n    const res = await fetch(\`\${env.VITE_API_URL}/sign-in\`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(credentials) })\n    if (!res.ok) throw new Error('Invalid credentials')\n    return (await res.json()) as { token: string; refreshToken?: string }\n  },\n})\n\nexport default defineConfig({ adapter, signInPath: '/sign-in' })\n`,
    )
    ctx.env.schema(
      'public',
      'VITE_API_URL',
      "e.url({ default: 'http://localhost:3333' })",
      'http://localhost:3333',
    )
    // requireAuth() reads the session from the router context: wire it into the default router.
    ctx.edit('app/router.tsx', (_mod, src) =>
      src.includes(PLAIN_ROUTER_CALL) && !src.includes('KitrRouterContext')
        ? src
            .replace(
              "import { createKitrRouter } from 'kitr/router'\n",
              "import type { Session } from 'kitr/auth'\nimport { createKitrRouter } from 'kitr/router'\nimport type { User } from '#app/abilities'\n",
            )
            .replace(PLAIN_ROUTER_CALL, SESSION_ROUTER_CALL)
            .concat(SESSION_CONTEXT_TYPE)
        : src,
    )
    ctx.agents.add(
      'auth',
      `- Guard routes with \`beforeLoad: requireAuth()\` (from \`kitr/router\`) on a layout route; permissions with \`can('projects.update', { subject })\` or \`useCan()\` in components.\n- The session is \`useSession()\` / \`useUser()\` from \`kitr/auth\`. Abilities are plain functions in \`app/abilities.ts\`, shared with the API middleware (\`kitr/auth/server\`).`,
    )
  },
  remove(ctx) {
    ctx.edit('app/router.tsx', (_mod, src) =>
      src.includes(SESSION_ROUTER_CALL)
        ? src
            .replace("import type { Session } from 'kitr/auth'\n", '')
            .replace("import type { User } from '#app/abilities'\n", '')
            .replace(SESSION_ROUTER_CALL, PLAIN_ROUTER_CALL)
            .replace(SESSION_CONTEXT_TYPE, '')
        : src,
    )
    ctx.provider.remove('@kitr/auth/provider')
    ctx.agents.remove('auth')
  },
})
