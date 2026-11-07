import { definePackage } from '@kitr/core/package'

/**
 * `kitr add theme`: design tokens and light/dark/system theming with no flash on load. The
 * components come from a shadcn-compatible registry through `kitr ui add`, which this package
 * mounts.
 */
export default definePackage({
  name: 'theme',
  requires: ['react'],
  client: true,
  add(ctx) {
    ctx.provider.add('@kitr/theme/provider')
    ctx.config(
      'theme',
      `import { defineConfig } from 'kitr/theme'\n\nexport default defineConfig({\n  default: 'system',\n  // Window chrome / <meta name="theme-color"> per theme.\n  colors: { light: '#ffffff', dark: '#0a0a0a' },\n  // Any shadcn-compatible registry for \`kitr ui add\`. Default: kitr's.\n  // registry: 'https://raw.githubusercontent.com/kitrjs/kitr/main/registry/dist',\n  componentsDir: 'app/components/ui',\n})\n`,
    )
    ctx.write(
      'app/styles/tokens.css',
      `/* Override kitr tokens here. See kitr/theme/styles.css for the full list. */\n:root {\n  /* --kitr-color-primary: oklch(55% 0.2 262); */\n}\n`,
    )
    ctx.agents.add(
      'theme',
      `- Theme: \`useTheme()\` from \`kitr/theme\` (\`theme\`, \`resolved\`, \`setTheme\`, \`toggle\`); \`data-theme="light|dark"\` on <html>. Put \`<ThemeScript />\` in the document head to avoid a flash.\n- Colours and radii come from the \`--kitr-*\` variables (\`kitr/theme/styles.css\`, overrides in \`app/styles/tokens.css\`); never hard-code them. Plain CSS helpers: \`pick()\`, \`vars()\`, \`dataAttrs()\` from \`kitr/theme\`.\n- Components live in \`app/components/ui/\` and are owned by the app: add more with \`kitr ui add <name>\` (shadcn-compatible registry); toasts via \`kitr ui add sonner\`.\n- Icons: Hugeicons in the stroke-rounded style through \`<Icon icon={Add01Icon} />\` from \`#components/ui/icon\` (\`kitr ui add icon\`), icons from \`@hugeicons/core-free-icons\`. No other icon set, no emoji or glyphs as icons.`,
    )
    ctx.log.info('Pull components with `kitr ui add button input form`.')
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/theme/provider')
    ctx.agents.remove('theme')
  },
  commands: () => import('./commands'),
  eject: { 'kitr/theme': 'a theme context + CSS variables' },
})
