import { definePackage } from '@kitr/core/package'

/** `kitr add analytics`: page/track/identify behind one API; Plausible, Google Analytics, PostHog or console. */
export default definePackage({
  name: 'analytics',
  client: true,
  add(ctx) {
    ctx.provider.add('@kitr/analytics/provider')
    ctx.env.schema('public', 'VITE_PLAUSIBLE_DOMAIN', 'e.string({ optional: true })', '')
    ctx.env.schema('public', 'VITE_PLAUSIBLE_HOST', 'e.string({ optional: true })', '')
    ctx.env.schema('public', 'VITE_GA_MEASUREMENT_ID', 'e.string({ optional: true })', '')
    // With consent installed, analytics already waits for the visitor: say so instead of the hint.
    const enabled = ctx.hasPackage('consent')
      ? '// Held until the visitor accepts: see config/consent.ts'
      : '// Consent banners: start queued, then call analytics.enable() once the user agrees.\n  // enabled: false,'
    ctx.config(
      'analytics',
      `import { defineConfig, googleAnalytics, plausible } from '@kitr/analytics'
import { env } from '#app/env'

/**
 * With no adapters, development logs every event to the console and production sends nothing,
 * so the app works before any vendor is chosen. Plausible is cookieless; set its domain first.
 */
export default defineConfig({
  adapters: [
    ...(env.VITE_PLAUSIBLE_DOMAIN
      ? [plausible({ domain: env.VITE_PLAUSIBLE_DOMAIN, apiHost: env.VITE_PLAUSIBLE_HOST })]
      : []),
    ...(env.VITE_GA_MEASUREMENT_ID
      ? [googleAnalytics({ measurementId: env.VITE_GA_MEASUREMENT_ID })]
      : []),
    // posthog(posthogJs, { apiKey: env.VITE_POSTHOG_KEY }),   // pnpm add posthog-js
  ],
  ${enabled}
  globalProps: { app: env.VITE_APP_NAME },
})
`,
    )
    ctx.write(
      'app/analytics.ts',
      `import type { EventMap } from '@kitr/analytics'

/**
 * Every event the app sends, with its props. \`useAnalytics<AppEvents>()\` checks names and props,
 * so declare an event here before you track it.
 */
export interface AppEvents extends EventMap {
  // 'sign-in.completed': { method: 'password' | 'oauth' }
  // 'project.created': { id: string }
}
`,
    )
    ctx.agents.add(
      'analytics',
      `- Track from components with \`const analytics = useAnalytics<AppEvents>()\` (\`@kitr/analytics/react\`) then \`analytics.track(name, props)\`; declare each event in \`AppEvents\` in \`app/analytics.ts\` first.\n- Page views are sent automatically on every route change. \`analytics.identify(user.id, traits)\` after sign-in, \`analytics.reset()\` on sign-out.\n- Adapters live in \`config/analytics.ts\`; never call gtag/posthog directly.`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/analytics/provider')
    ctx.agents.remove('analytics')
  },
  eject: { '@kitr/analytics': 'gtag / plausible / posthog-js called directly' },
})
