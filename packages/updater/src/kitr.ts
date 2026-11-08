import { definePackage } from '@kitr/core/package'

/** `kitr add updater`: tell people a new version is ready and update the app in place, on every platform. */
export default definePackage({
  name: 'updater',
  requires: ['platform'],
  client: true,
  add(ctx) {
    ctx.provider.add('@kitr/updater/provider')
    ctx.config(
      'updater',
      `import { defineConfig } from '@kitr/updater'\n\nexport default defineConfig({\n  checkOnBoot: true,\n  interval: 60 * 60 * 1000, // look again every hour while the app is open\n  auto: false, // true applies as soon as an update is ready, without asking\n})\n`,
    )
    ctx.write(
      'app/components/update-banner.tsx',
      `import { useUpdate } from '@kitr/updater/react'

/** Mount once in the root layout. Hidden until the updater has something ready. */
export function UpdateBanner() {
  const { available, update, status, progress, apply, dismiss } = useUpdate()
  if (!available) return null
  return (
    <div role="status" className="fixed inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-foreground p-3 text-sm text-background">
      <span>Version {update?.version} is ready.</span>
      <button type="button" className="rounded-md bg-background px-3 py-1 text-foreground" onClick={apply} disabled={status === 'downloading'}>
        {status === 'downloading' ? \`Updating \${Math.round(progress * 100)}%\` : 'Restart to update'}
      </button>
      <button type="button" className="underline" onClick={dismiss}>
        Later
      </button>
    </div>
  )
}
`,
    )
    ctx.agents.add(
      'updater',
      `- \`useUpdate()\` from \`@kitr/updater/react\` drives \`app/components/update-banner.tsx\` (mount it once in the root layout). Status runs idle → checking → available → downloading → ready; the web driver watches the service worker, desktop/mobile packages register theirs.`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/updater/provider')
    ctx.agents.remove('updater')
  },
})
