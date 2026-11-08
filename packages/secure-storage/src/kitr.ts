import { definePackage } from '@kitr/core/package'

/** `kitr add secure-storage`: tokens and secrets in the OS vault on mobile and desktop, AES-GCM in the browser. */
export default definePackage({
  name: 'secure-storage',
  requires: ['storage'],
  client: true,
  add(ctx) {
    ctx.provider.add('@kitr/secure-storage/provider')
    ctx.config(
      'secure-storage',
      `import { defineConfig } from '@kitr/secure-storage'\n\nexport default defineConfig({\n  // OS vault on mobile/desktop; AES-GCM in the browser. true refuses the browser fallback.\n  requireSecure: false,\n})\n`,
    )
    ctx.write(
      'app/secure.ts',
      `import { defineSecureItem } from '@kitr/secure-storage'\n\n/** Secrets, typed once: \`useSecureItem(sessionItem)\` in components, \`sessionItem(storage).get()\` elsewhere. */\nexport const sessionItem = defineSecureItem<{ token: string; expiresAt: number }>('session')\n`,
    )
    ctx.agents.add(
      'secure-storage',
      `- Tokens and secrets go through \`@kitr/secure-storage\` (\`app/secure.ts\`), never \`defineStorage\` or localStorage. \`useSecureItem(item)\` returns \`[value, set, { loading, secure }]\`; the value is undefined until the vault answers.`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/secure-storage/provider')
    ctx.agents.remove('secure-storage')
  },
})
