import { definePackage } from '@kitr/core/package'

/** `kitr add monitoring`: captureException, breadcrumbs and user context behind one API (Sentry or console). */
export default definePackage({
  name: 'monitoring',
  add(ctx) {
    const serverOnly = ctx.isServerOnly
    if (!serverOnly) ctx.provider.add('@kitr/monitoring/provider')
    if (serverOnly) {
      ctx.env.add({ SENTRY_DSN: '' }, 'Monitoring')
      ctx.config(
        'monitoring',
        `import { defineConfig } from 'kitr/monitoring'

/** Reporters: development prints to the console, production sends nowhere until one is added. */
export default defineConfig({
  reporters: [
    // import * as Sentry from '@sentry/node'  (pnpm add @sentry/node)
    // ...(process.env.SENTRY_DSN ? [sentry(Sentry, { dsn: process.env.SENTRY_DSN })] : []),
  ],
  tags: { service: '${ctx.pkg.name ?? 'app'}' },
})
`,
      )
    } else {
      ctx.env.schema('public', 'VITE_SENTRY_DSN', 'e.string({ optional: true })', '')
      ctx.config(
        'monitoring',
        `import { defineConfig } from 'kitr/monitoring'
import { env } from '#app/env'

/**
 * Reporters: development prints to the console, production sends nowhere until one is added.
 * Pass the SDK module so the right flavour (react, browser, node) is bundled for the environment.
 */
export default defineConfig({
  reporters: [
    // import * as Sentry from '@sentry/react'  (pnpm add @sentry/react)
    // ...(env.VITE_SENTRY_DSN ? [sentry(Sentry, { dsn: env.VITE_SENTRY_DSN })] : []),
  ],
  // shouldReport: (error) => !(error instanceof KitrError && error.status < 500),
  tags: { app: env.VITE_APP_NAME },
})
`,
      )
    }
    ctx.agents.add(
      'monitoring',
      serverOnly
        ? `- \`server.use(reportErrors(monitoring))\` from \`kitr/monitoring/server\` reports every thrown error with method, url and request id before kitr's error handler answers.\n- Elsewhere: \`app.container.use('monitoring').captureException(error, { extra })\`; \`addBreadcrumb\` before risky steps. Reporters live in \`config/monitoring.ts\`.`
        : `- Unhandled errors, rejections and render errors are reported automatically (window handlers + the error boundary the provider wraps). For caught errors: \`useService('monitoring').captureException(error, { extra })\`.\n- \`monitoring.setUser({ id })\` after sign-in, \`setUser(null)\` on sign-out; \`addBreadcrumb({ category, message })\` before risky steps.\n- Expected failures (kitr 4xx, aborted requests) are dropped by default; tune \`shouldReport\` in \`config/monitoring.ts\`. On the server: \`server.use(reportErrors(monitoring))\` from \`kitr/monitoring/server\`.`,
    )
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/monitoring/provider')
    ctx.agents.remove('monitoring')
  },
  eject: { 'kitr/monitoring': '@sentry/react (or @sentry/node) called directly' },
})
