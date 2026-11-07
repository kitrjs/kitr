import { definePackage } from '@kitr/core/package'

/**
 * `kitr add vite`: Vite with the kitr() plugin. Every browser platform (web, desktop, tauri,
 * mobile) requires it; a server-only project never sees it. The plugin reads kitrrc.ts and the
 * installed packages' `vite` declarations, so this file stays the same whatever is added later.
 */
export default definePackage({
  name: 'vite',
  dev: true,
  add(ctx) {
    ctx.deps.add({ name: 'vite', dev: true })
    ctx.write(
      'vite.config.ts',
      `import { kitr } from 'kitr/vite'\nimport { defineConfig } from 'vite'\n\nexport default defineConfig({\n  plugins: [kitr()],\n})\n`,
    )
    ctx.tsconfig.addTypes('vite/client', '@kitr/vite/client')
    ctx.tsconfig.addInclude('vite.config.ts')
    ctx.agents.add(
      'vite',
      '- `vite.config.ts` holds `kitr()` and nothing else: the plugin wires the router, React, Tailwind, `virtual:kitr/*` and the `#app`-style aliases from kitrrc.ts and the installed packages. Add a Vite plugin of your own next to `kitr()`.',
    )
  },
  remove(ctx) {
    ctx.deps.remove('vite')
    ctx.unlink('vite.config.ts')
    ctx.tsconfig.removeTypes('vite/client', '@kitr/vite/client')
    ctx.agents.remove('vite')
  },
  doctor(project) {
    if (!project.exists('vite.config.ts'))
      return [{ level: 'error', message: 'vite.config.ts is missing', fix: 'kitr add vite' }]
    if (!project.read('vite.config.ts').includes('kitr/vite'))
      return [
        {
          level: 'warn',
          message: 'vite.config.ts does not use the kitr() plugin',
          fix: "import { kitr } from 'kitr/vite' and add kitr() to plugins",
        },
      ]
    return []
  },
  eject: { 'kitr/vite': 'vite + @tanstack/router-plugin (your own vite.config.ts)' },
})
