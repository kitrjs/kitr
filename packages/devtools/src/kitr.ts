import { definePackage } from '@kitr/core/package'

/** `kitr add devtools`: the development overlay every package writes to. Left out of production builds unless enabled. */
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

export default defineConfig({
  // Default: development only. true also ships it in production builds.
  // enabled: true,
  trigger: 'auto', // 'auto' | 'hover' | 'hidden'
  position: 'bottom-left', // where the trigger starts; it can be dragged
  dock: 'bottom', // 'bottom' | 'right' on desktop
  theme: 'auto', // 'auto' | 'light' | 'dark'
  shortcut: 'k', // ctrl/cmd+shift+<key>, or a full combo such as ['Meta', 'Shift', 'K']
  touchGesture: true, // three-finger long press on touch screens
  urlFlag: 'kitr-devtools', // ?kitr-devtools opens it even when the trigger is hidden
  maxEntries: 500,
})
`,
    )
    ctx.agents.add(
      'devtools',
      `- In development (or always, with \`enabled: true\` in config/devtools.ts) the kitr devtools open from the trigger button or ctrl/cmd+shift+K, with a three-finger long press on touch screens, and ctrl/cmd+shift+P opens the command palette with every package's actions.\n- Log from anywhere with \`getDevtools(app)?.log('channel', 'label', data)\` and drop a divider with \`getDevtools(app)?.mark('label')\` (\`@kitr/devtools\`); it is null when devtools is off, so the call costs nothing.\n- A provider adds its own panel with a \`devtools(app)\` method returning \`DevtoolsPanel[]\` with \`icon\`, \`group\`, \`badge\` and \`actions\` (lazy-import the React parts); reuse the parts from \`@kitr/devtools/ui\`.`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/devtools/provider')
    ctx.agents.remove('devtools')
  },
  eject: { '@kitr/devtools': 'nothing; development only unless enabled' },
  vite: { provider: { production: false } },
})
