import { type Recipe, r } from './recipe'

/** `@acme/my-app` → `My App`: what users see in window titles, manifests and installers. */
export function displayName(pkgName: string | undefined): string {
  const base = (pkgName ?? 'app')
    .replace(/^@[^/]+\//, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
  return base ? base.replace(/\b\w/g, (c) => c.toUpperCase()) : 'App'
}

/**
 * Capability and observability add-ons: platform, storage, devtools, analytics, error monitoring.
 * Each one wires the basics (deps, config, scripts, scaffold) and leaves the vendor tooling in charge.
 */
export const addonRecipes: Record<string, Recipe> = {
  platform: r({
    name: 'platform',
    package: '@kitr/platform',
    requires: ['react'],
    client: true,
    description:
      'One API for where the app runs: platform type and OS, online state, app lifecycle, back button, deep links, safe areas. Platform packages register the drivers.',
    configure(ctx, c) {
      c.installPackages(['@kitr/platform'])
      c.addProvider('@kitr/platform/provider')
      c.addPackage('@kitr/platform')
      ctx.write(
        'config/platform.ts',
        `import { defineConfig } from 'kitr/platform'\n\nexport default defineConfig({\n  // Deep links are routed after stripping these prefixes.\n  deepLinkPrefixes: [],\n})\n`,
      )
      c.addAgentsSection(
        'platform',
        `- Never branch on user agents or \`window.__TAURI__\`: use \`usePlatform()\`, \`useOnline()\`, \`useAppState()\`, \`useBackButton()\`, \`useDeepLink()\`, \`useSafeArea()\` from \`kitr/platform/react\`, or \`app.use('platform')\` outside React. \`platform.is('mobile')\` / \`platform.is('ios')\` match the type or the OS.\n- The web, desktop and mobile platform providers register the drivers; in a plain browser the defaults apply, so the same code runs everywhere.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/platform/provider')
      c.removePackage('@kitr/platform')
      c.removePackages(['@kitr/platform'])
      c.removeAgentsSection('platform')
    },
  }),
  analytics: r({
    name: 'analytics',
    package: '@kitr/analytics',
    client: true,
    description:
      'page/track/identify behind one API: Google Analytics, Plausible, PostHog or console; page views from the router.',
    configure(ctx, c) {
      c.installPackages(['@kitr/analytics'])
      c.addProvider('@kitr/analytics/provider')
      c.addPackage('@kitr/analytics')
      c.addEnvSchema('public', 'VITE_GA_MEASUREMENT_ID', 'e.string({ optional: true })', '')
      ctx.write(
        'config/analytics.ts',
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
      c.addAgentsSection(
        'analytics',
        `- Track from components with \`const analytics = useAnalytics<AppEvents>()\` (\`kitr/analytics/react\`) then \`analytics.track('project.created', { id })\`; declare new events in \`app/analytics.ts\` first.\n- Page views are sent automatically on every route change. \`analytics.identify(user.id, traits)\` after sign-in, \`analytics.reset()\` on sign-out.\n- Adapters live in \`config/analytics.ts\`; never call gtag/posthog directly.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/analytics/provider')
      c.removePackage('@kitr/analytics')
      c.removePackages(['@kitr/analytics'])
      c.removeAgentsSection('analytics')
    },
  }),
  monitoring: r({
    name: 'monitoring',
    package: '@kitr/monitoring',
    description:
      'captureException, breadcrumbs and user context behind one API (Sentry or console), an error boundary and server middleware.',
    configure(ctx, c) {
      const serverOnly = ctx.isServerOnly()
      c.installPackages(['@kitr/monitoring'])
      if (!serverOnly) c.addProvider('@kitr/monitoring/provider')
      c.addPackage('@kitr/monitoring')
      if (serverOnly) {
        c.addEnv({ SENTRY_DSN: '' }, 'Monitoring')
        ctx.write(
          'config/monitoring.ts',
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
        c.addEnvSchema('public', 'VITE_SENTRY_DSN', 'e.string({ optional: true })', '')
        ctx.write(
          'config/monitoring.ts',
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
      c.addAgentsSection(
        'monitoring',
        serverOnly
          ? `- \`server.use(reportErrors(monitoring))\` from \`kitr/monitoring/server\` reports every thrown error with method, url and request id before kitr's error handler answers.\n- Elsewhere: \`app.container.use('monitoring').captureException(error, { extra })\`; \`addBreadcrumb\` before risky steps. Reporters live in \`config/monitoring.ts\`.`
          : `- Unhandled errors, rejections and render errors are reported automatically (window handlers + the error boundary the provider wraps). For caught errors: \`useService('monitoring').captureException(error, { extra })\`.\n- \`monitoring.setUser({ id })\` after sign-in, \`setUser(null)\` on sign-out; \`addBreadcrumb({ category, message })\` before risky steps.\n- Expected failures (kitr 4xx, aborted requests) are dropped by default; tune \`shouldReport\` in \`config/monitoring.ts\`. On the server: \`server.use(reportErrors(monitoring))\` from \`kitr/monitoring/server\`.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/monitoring/provider')
      c.removePackage('@kitr/monitoring')
      c.removePackages(['@kitr/monitoring'])
      c.removeAgentsSection('monitoring')
    },
  }),

  storage: r({
    name: 'storage',
    package: '@kitr/storage',
    description:
      'Typed localStorage/sessionStorage items and cookies with one API on the client and the server; SSR-safe hooks.',
    configure(ctx, c) {
      const serverOnly = ctx.isServerOnly()
      c.installPackages(['@kitr/storage'])
      c.addProvider('@kitr/storage/provider')
      c.addPackage('@kitr/storage')
      ctx.write(
        'config/storage.ts',
        `import { defineConfig } from 'kitr/storage'

export default defineConfig({
  // Prefixes every storage key and cookie name so several apps on one origin never collide.
  prefix: '${(ctx.pkg.name ?? 'app').replace(/^@[^/]+\//, '').replace(/[^a-z0-9]+/gi, '-')}:',
  cookie: { path: '/', sameSite: 'lax', secure: import.meta.env?.PROD ?? false },
})
`,
      )
      ctx.write(
        'app/storage.ts',
        serverOnly
          ? `import { defineCookie } from 'kitr/storage'

/** Cookies are typed once and read with \`cookies(event).get(item)\` from kitr/storage/server. */
export const localeCookie = defineCookie('locale', { default: 'en', maxAge: 60 * 60 * 24 * 365 })
`
          : `import { defineCookie, defineStorage } from 'kitr/storage'

/**
 * Every persisted value, in one file, typed. Components read them with
 * \`useStorage(item)\` / \`useCookie(item)\` from kitr/storage/react; plain code with \`item.get()\`.
 */
export const sidebar = defineStorage('sidebar', { default: { collapsed: false } })

export const recentSearches = defineStorage<string[]>('recent-searches', {
  default: [],
  area: 'session',
  version: 1,
})

/** Readable on the server too (\`localeCookie.get(request.headers)\`), so SSR picks the right locale. */
export const localeCookie = defineCookie('locale', { default: 'en', maxAge: 60 * 60 * 24 * 365 })
`,
      )
      c.addAgentsSection(
        'storage',
        serverOnly
          ? `- Cookies: declare with \`defineCookie\` in \`app/storage.ts\`; in controllers use \`const jar = cookies(ctx.event)\` from \`kitr/storage/server\`, then \`jar.get(item)\` / \`jar.set(item, value, { httpOnly: true })\`.`
          : `- Persisted values are declared once in \`app/storage.ts\` (\`defineStorage\` for local/session storage, \`defineCookie\` for cookies) and never read through \`localStorage\`/\`document.cookie\` directly.\n- Components: \`const [value, setValue] = useStorage(item)\` / \`useCookie(item)\` from \`kitr/storage/react\`. Both are hydration-safe: the server and first render see the default.\n- Server side (actions, controllers): \`cookies(event).get(item)\` / \`.set(item, value)\` from \`kitr/storage/server\`; wrap the root route in \`<CookieHeader value={request.headers.get('cookie')}>\` so \`useCookie\` renders the right value during SSR.\n- Add \`schema\` (zod/valibot) to validate what comes back from storage, \`version\` + \`migrate\` when a shape changes, \`ttl\` to expire.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/storage/provider')
      c.removePackage('@kitr/storage')
      c.removePackages(['@kitr/storage'])
      c.removeAgentsSection('storage')
    },
  }),
  devtools: r({
    name: 'devtools',
    package: '@kitr/devtools',
    client: true,
    description:
      'The development overlay: app, router, query cache, auth, http, storage, errors and analytics panels, a command palette, and a log every package writes to. Stripped from production builds.',
    configure(ctx, c) {
      c.installPackages(['@kitr/devtools'])
      c.addProvider('@kitr/devtools/provider')
      c.addPackage('@kitr/devtools')
      ctx.write(
        'config/devtools.ts',
        `import { defineConfig } from 'kitr/devtools'

/** Development only. The kitr() Vite plugin drops the provider from production builds. */
export default defineConfig({
  position: 'bottom-left',
  // ctrl/cmd+shift+<key> toggles the overlay; ctrl/cmd+shift+P opens the command palette.
  shortcutKey: 'k',
  maxEntries: 500,
})
`,
      )
      c.addAgentsSection(
        'devtools',
        `- In development a "k" button (ctrl/cmd+shift+K) opens the kitr devtools: App, Router, Query, Auth, Storage, Errors, Analytics and Log panels, plus a command palette (ctrl/cmd+shift+P) with every package's actions.\n- Log from anywhere with \`getDevtools(app)?.log('channel', 'label', data)\` (\`kitr/devtools\`); it is null in production so the call costs nothing.\n- A provider adds its own panel with a \`devtools(app)\` method returning \`DevtoolsPanel[]\` (lazy-import the React parts); reuse \`JsonView\`, \`KeyValue\`, \`LogList\` from \`kitr/devtools/ui\`.`,
      )
    },
    unconfigure(_ctx, c) {
      c.removeProvider('@kitr/devtools/provider')
      c.removePackage('@kitr/devtools')
      c.removePackages(['@kitr/devtools'])
      c.removeAgentsSection('devtools')
    },
  }),
}
