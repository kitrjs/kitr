import { definePackage } from '@kitr/core/package'

/** `kitr add devtools`: the development overlay every package writes to. Stripped from production builds. */
export default definePackage({
  name: 'devtools',
  client: true,
  add(ctx) {
    ctx.provider.add('@kitr/devtools/provider', {
      comment:
        'Development only: the kitr() Vite plugin strips this provider from production builds.',
    })
    ctx.config(
      'devtools',
      `import { defineConfig } from '@kitr/devtools'

/** Development only. The kitr() Vite plugin drops the provider from production builds. */
export default defineConfig({
  position: 'bottom-left',
  // ctrl/cmd+shift+<key> toggles the overlay; ctrl/cmd+shift+P opens the command palette.
  shortcutKey: 'k',
  maxEntries: 500,
})
`,
    )
    ctx.agents.add(
      'devtools',
      `- In development a "k" button (ctrl/cmd+shift+K) opens the kitr devtools: App, Router, Query, Auth, Storage, Errors, Analytics and Log panels, plus a command palette (ctrl/cmd+shift+P) with every package's actions.\n- Log from anywhere with \`getDevtools(app)?.log('channel', 'label', data)\` (\`@kitr/devtools\`); it is null in production so the call costs nothing.\n- A provider adds its own panel with a \`devtools(app)\` method returning \`DevtoolsPanel[]\` (lazy-import the React parts); reuse \`JsonView\`, \`KeyValue\`, \`LogList\` from \`@kitr/devtools/ui\`.`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/devtools/provider')
    ctx.agents.remove('devtools')
  },
  eject: { '@kitr/devtools': 'nothing; development only' },
  vite: { provider: { production: false } },
})
