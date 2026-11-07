import { definePackage } from '@kitr/core/package'

/** `kitr add analytics`: page/track/identify behind one API; Google Analytics, Plausible, PostHog or console. */
export default definePackage({
  name: 'analytics',
  client: true,
  add(ctx) {
    ctx.provider.add('@kitr/analytics/provider')
    ctx.env.schema('public', 'VITE_GA_MEASUREMENT_ID', 'e.string({ optional: true })', '')
    ctx.config(
      'analytics',
      `import { defineConfig, googleAnalytics } from 'kitr/analytics'
import { env } from '#app/env'

/**
 * With no adapters, development logs every event to the console and production sends nothing,
 * so the app works before any vendor is chosen.
 */
export default defineConfig({
  adapters: [
    ...(env.VITE_GA_MEASUREMENT_ID
      ? [googleAnalytics({ measurementId: env.VITE_GA_MEASUREMENT_ID })]
      : []),
    // plausible({ domain: 'example.com' }),
    // posthog(posthogJs, { apiKey: env.VITE_POSTHOG_KEY }),   // pnpm add posthog-js
  ],
  // Consent banners: start queued, then call analytics.enable() once the user agrees.
  // enabled: false,
  globalProps: { app: env.VITE_APP_NAME },
})
`,
    )
    ctx.write(
      'app/analytics.ts',
      `import type { EventMap } from 'kitr/analytics'

/** Every event the app sends, with its props. \`useAnalytics<AppEvents>()\` checks names and props. */
export interface AppEvents extends EventMap {
  'sign-in.completed': { method: 'password' | 'oauth' }
  'project.created': { id: string }
}
`,
    )
    ctx.agents.add(
      'analytics',
      `- Track from components with \`const analytics = useAnalytics<AppEvents>()\` (\`kitr/analytics/react\`) then \`analytics.track('project.created', { id })\`; declare new events in \`app/analytics.ts\` first.\n- Page views are sent automatically on every route change. \`analytics.identify(user.id, traits)\` after sign-in, \`analytics.reset()\` on sign-out.\n- Adapters live in \`config/analytics.ts\`; never call gtag/posthog directly.`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/analytics/provider')
    ctx.agents.remove('analytics')
  },
  eject: { 'kitr/analytics': 'gtag / plausible / posthog-js called directly' },
})
