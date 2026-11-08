import { definePackage } from '@kitr/core/package'

/** `kitr add devtools`: the development overlay every package writes to. Left out of production builds unless enabled. */
export default definePackage({
  name: 'devtools',
  client: true,
  add(ctx) {
    ctx.provider.add('@kitr/devtools/provider')
    ctx.config(
      'devtools',
      `import { defineConfig } from '@kitr/devtools'

export default defineConfig({
  // Default: development only. true also ships it in production builds.
  // enabled: true,
  position: 'bottom-left',
  // ctrl/cmd+shift+<key> toggles the overlay; ctrl/cmd+shift+P opens the command palette.
  shortcutKey: 'k',
  maxEntries: 500,
})
`,
    )
    ctx.agents.add(
      'devtools',
      `- In development (or always, with \`enabled: true\` in config/devtools.ts) a "k" button (ctrl/cmd+shift+K) opens the kitr devtools: App, Router, Query, Auth, Storage, Errors, Analytics and Log panels, plus a command palette (ctrl/cmd+shift+P) with every package's actions.\n- Log from anywhere with \`getDevtools(app)?.log('channel', 'label', data)\` (\`@kitr/devtools\`); it is null when devtools is off, so the call costs nothing.\n- A provider adds its own panel with a \`devtools(app)\` method returning \`DevtoolsPanel[]\` (lazy-import the React parts); reuse \`JsonView\`, \`KeyValue\`, \`LogList\` from \`@kitr/devtools/ui\`.`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/devtools/provider')
    ctx.agents.remove('devtools')
  },
  eject: { '@kitr/devtools': 'nothing; development only unless enabled' },
  vite: { provider: { production: false } },
})
