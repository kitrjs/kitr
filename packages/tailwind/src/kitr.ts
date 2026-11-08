import { definePackage, documentFile } from '@kitr/core/package'

/** `kitr add tailwind`: Tailwind v4 via the Vite plugin, the kitr preset (tokens as @theme) and cn(). */
export default definePackage({
  name: 'tailwind',
  requires: ['react'],
  client: true,
  add(ctx) {
    ctx.deps.add(
      'tailwindcss',
      '@tailwindcss/vite',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',
    )
    ctx.config(
      'tailwind',
      `import { defineConfig } from '@kitr/tailwind'\n\nexport default defineConfig({\n  entry: 'app/styles/app.css',\n  preset: true,\n})\n`,
    )
    ctx.write(
      'app/styles/app.css',
      `@import 'tailwindcss';\n@import '@kitr/tailwind/preset.css';\n@import '@kitr/theme/styles.css';\n${ctx.exists('app/styles/tokens.css') ? "@import './tokens.css';\n" : ''}\n@source '../';\n`,
    )
    ctx.replaceImport(documentFile(ctx), '@kitr/theme/styles.css', '#app/styles/app.css')
    ctx.agents.add(
      'tailwind',
      `- Tailwind v4: utilities map to kitr tokens (\`bg-background\`, \`text-primary\`, \`rounded-md\`). Use \`cn()\` from \`@kitr/tailwind\` to merge classes. Dark mode is \`data-theme="dark"\` on <html>, toggled by \`useTheme()\`.`,
    )
  },
  remove(ctx) {
    ctx.deps.remove('tailwindcss', '@tailwindcss/vite', 'tailwind-merge')
    ctx.agents.remove('tailwind')
  },
  eject: { '@kitr/tailwind': 'clsx + tailwind-merge' },
  vite: {
    plugin: '@kitr/tailwind/vite',
    optimizeDeps: ['clsx', 'tailwind-merge', 'class-variance-authority'],
  },
})
