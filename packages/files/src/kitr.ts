import { definePackage } from '@kitr/core/package'

/** `kitr add files`: open, save and pick files on any platform, with a download fallback in older browsers. */
export default definePackage({
  name: 'files',
  requires: ['platform'],
  client: true,
  add(ctx) {
    // With the mobile platform the Capacitor driver needs its plugins; the web build never loads them.
    if (
      ctx.has('@capacitor/core') ||
      Object.values(ctx.rc.platforms).some((p) => p.factory === 'mobile')
    )
      ctx.deps.add('@capacitor/filesystem', '@capacitor/share', '@capawesome/capacitor-file-picker')
    ctx.provider.add('@kitr/files/provider')
    ctx.config(
      'files',
      `import { defineConfig } from '@kitr/files'\n\nexport default defineConfig({\n  // Filters added to every open/save dialog.\n  filters: [],\n})\n`,
    )
    ctx.agents.add(
      'files',
      `- Open, pick and save files with \`useFileDialogs()\` from \`@kitr/files/react\` (or \`app.container.use('files')\`). Never build \`<input type="file">\` or download links by hand: the service shows native dialogs on desktop/mobile and falls back on the web. A cancelled dialog resolves to \`[]\`/\`null\`.`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/files/provider')
    ctx.agents.remove('files')
  },
})
