import { defineConfig, googleAnalytics, plausible } from '@kitr/analytics'
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
  // Consent banners: start queued, then call analytics.enable() once the user agrees.
  // enabled: false,
  globalProps: { app: env.VITE_APP_NAME },
})
