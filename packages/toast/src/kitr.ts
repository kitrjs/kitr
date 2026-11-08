import { definePackage } from '@kitr/core/package'

/** `kitr add toast`: short messages from anywhere in the app, drawn by sonner. */
export default definePackage({
  name: 'toast',
  requires: ['react'],
  client: true,
  add(ctx) {
    ctx.provider.add('@kitr/toast/provider')
    ctx.config(
      'toast',
      `import { defineConfig } from '@kitr/toast'\n\nexport default defineConfig({\n  position: 'bottom-right',\n  richColors: true,\n})\n`,
    )
    ctx.agents.add(
      'toast',
      `- Toasts: \`toast('Saved')\`, \`toast.success()\`, \`.error()\`, \`.info()\`, \`.warning()\`, \`toast.promise()\` and \`toastError(error)\` from \`@kitr/toast\`. Callable from any module, not only components; the provider mounts the toaster, so never render a \`<Toaster />\` yourself. Position and colours live in \`config/toast.ts\`.`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/toast/provider')
    ctx.agents.remove('toast')
  },
  eject: { '@kitr/toast': 'sonner' },
  vite: { optimizeDeps: ['sonner'] },
})
