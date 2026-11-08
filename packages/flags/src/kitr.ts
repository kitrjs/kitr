import { definePackage } from '@kitr/core/package'

/** `kitr add flags`: feature flags with the same answer on the server and in the browser. */
export default definePackage({
  name: 'flags',
  add(ctx) {
    const serverOnly = ctx.isServerOnly
    ctx.provider.add('@kitr/flags/provider')
    ctx.write(
      'app/flags.ts',
      `import { defineFlags } from '@kitr/flags'\n\n/** Every flag with its default, so unknown flags are a type error. */\nexport const flags = defineFlags({\n  'new-dashboard': { default: false, description: 'The redesigned dashboard' },\n  'max-upload-mb': { default: 10 },\n})\n`,
    )
    ctx.config(
      'flags',
      `import { defineConfig, envFlagsProvider, percentageFlagsProvider } from '@kitr/flags'\nimport { flags } from '#app/flags'\n\nexport default defineConfig({\n  definitions: flags,\n  // First provider with an answer wins: FLAG_NEW_DASHBOARD=true in .env, then a 10% rollout.\n  providers: [envFlagsProvider(), percentageFlagsProvider({ 'new-dashboard': 10 })],\n  // openFeatureFlagsProvider(client) plugs in LaunchDarkly, Flagsmith, Unleash... through OpenFeature.\n})\n`,
    )
    ctx.agents.add(
      'flags',
      serverOnly
        ? `- Flags live in \`app/flags.ts\` (\`defineFlags\`); resolve per request with \`resolveFlags(app, event, { userId })\` from \`@kitr/flags/server\`. Providers are ordered in \`config/flags.ts\`.`
        : `- Flags live in \`app/flags.ts\` (\`defineFlags\`). Components read \`useFlag('new-dashboard')\` from \`@kitr/flags/react\`; the server resolves them per request (\`resolveFlags\` in \`@kitr/flags/server\`) and embeds them with \`<FlagsScript />\` so the first render matches. Never read \`import.meta.env\` for a feature switch.`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/flags/provider')
    ctx.agents.remove('flags')
  },
})
