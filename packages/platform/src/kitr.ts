import { definePackage } from '@kitr/core/package'

/** `kitr add platform`: one API for where the app runs; platform packages register the drivers. */
export default definePackage({
  name: 'platform',
  requires: ['react'],
  client: true,
  add(ctx) {
    ctx.provider.add('@kitr/platform/provider')
    ctx.config(
      'platform',
      `import { defineConfig } from 'kitr/platform'\n\nexport default defineConfig({\n  // Deep links are routed after stripping these prefixes.\n  deepLinkPrefixes: [],\n})\n`,
    )
    ctx.agents.add(
      'platform',
      `- Never branch on user agents or \`window.__TAURI__\`: use \`usePlatform()\`, \`useOnline()\`, \`useAppState()\`, \`useBackButton()\`, \`useDeepLink()\`, \`useSafeArea()\` from \`kitr/platform/react\`, or \`app.use('platform')\` outside React. \`platform.is('mobile')\` / \`platform.is('ios')\` match the type or the OS.\n- The web, desktop, tauri and mobile platform providers register the drivers; in a plain browser the defaults apply, so the same code runs everywhere.`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/platform/provider')
    ctx.agents.remove('platform')
  },
  eject: { 'kitr/platform': 'navigator.onLine, visibilitychange, the shell SDKs' },
})
