import { definePackage } from '@kitr/core/package'

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
    ctx.agents.add(
      'auth',
      `- Guard routes with \`beforeLoad: requireAuth()\` (from \`kitr/router\`) on a layout route; permissions with \`can('projects.update', { subject })\` or \`useCan()\` in components.\n- The session is \`useSession()\` / \`useUser()\` from \`kitr/auth\`. Abilities are plain functions in \`app/abilities.ts\`, shared with the API middleware (\`kitr/auth/server\`).`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/auth/provider')
    ctx.agents.remove('auth')
  },
})
