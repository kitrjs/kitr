import { definePackage } from '@kitr/core/package'

/** `kitr add consent`: ask for cookie and tracking consent once, and hold analytics until people agree. */
export default definePackage({
  name: 'consent',
  requires: ['storage'],
  client: true,
  add(ctx) {
    ctx.provider.add('@kitr/consent/provider')
    ctx.config(
      'consent',
      `import { defineConfig } from '@kitr/consent'\n\nexport default defineConfig({\n  categories: ['analytics', 'marketing'],\n  version: 1, // bump to ask everyone again\n  analytics: 'analytics', // analytics waits for this category\n  monitoring: false, // error reports are not gated\n})\n`,
    )
    ctx.write(
      'app/components/consent-banner.tsx',
      `import { useConsent } from '@kitr/consent/react'

/** Mount once in the root layout. Renders nothing once a choice is recorded. */
export function ConsentBanner() {
  const { decided, acceptAll, rejectAll } = useConsent()
  if (decided) return null
  return (
    <div role="dialog" aria-label="Cookie consent" className="fixed inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-3 border-t bg-background p-4 text-sm">
      <span>We use cookies for analytics. You can change your mind in settings.</span>
      <button type="button" className="rounded-md border px-3 py-1" onClick={rejectAll}>
        Only necessary
      </button>
      <button type="button" className="rounded-md bg-foreground px-3 py-1 text-background" onClick={acceptAll}>
        Accept all
      </button>
    </div>
  )
}
`,
    )
    ctx.agents.add(
      'consent',
      `- \`app/components/consent-banner.tsx\` is the one place consent is asked; mount it in the root layout. Analytics stays queued until its category is granted (\`config/consent.ts\`), so never call \`analytics.enable()\` by hand. Read a category with \`useConsent().has('marketing')\` before loading third-party scripts.`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/consent/provider')
    ctx.agents.remove('consent')
  },
})
