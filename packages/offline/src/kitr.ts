import { definePackage } from '@kitr/core/package'

/** `kitr add offline`: keep showing loaded data with no connection, and replay queued changes on reconnect. */
export default definePackage({
  name: 'offline',
  requires: ['query', 'storage'],
  client: true,
  add(ctx) {
    ctx.provider.add('@kitr/offline/provider')
    ctx.config(
      'offline',
      `import { defineConfig } from '@kitr/offline'\nimport { env } from '#app/env'\n\nexport default defineConfig({\n  maxAge: 24 * 60 * 60 * 1000,\n  // include: (key) => key[0] !== 'search', // leave volatile queries out of the snapshot\n  buster: env.VITE_APP_VERSION, // a new version drops old snapshots\n})\n`,
    )
    ctx.env.schema('public', 'VITE_APP_VERSION', "e.string({ default: '0.0.0' })", '0.0.0')
    ctx.agents.add(
      'offline',
      `- Successful queries are persisted and restored before the first render; mutations made offline pause and replay on reconnect (TanStack's default \`networkMode\`). Named mutations (\`useMutation('projects.rename')\`) replay even after the app restarts; give any other mutation a \`mutationKey\` and \`setMutationDefaults\`, and an optimistic \`onMutate\`. \`useOffline()\` from \`@kitr/offline/react\` gives \`{ online, pending, restored }\` for a status line.`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/offline/provider')
    ctx.agents.remove('offline')
  },
})
