import { defineKitrConfig } from 'kitr/app'
import { web } from 'kitr/web'
import { server } from 'kitr/server'

/**
 * Explicit wiring, the Adonis way: every provider is listed here as a lazy import and every
 * platform by name. `kitr add`, `kitr remove` and `kitr config` edit this file; so can you.
 */
export default defineKitrConfig({
  packages: [
   '@kitr/react',
   '@kitr/router',
   '@kitr/logger',
   '@kitr/server',
   '@kitr/query',
   '@kitr/forms',
   '@kitr/tailwind',
   '@kitr/theme',
   '@kitr/i18n',
   '@kitr/storage',
   '@kitr/analytics',
   '@kitr/testing',
   '@kitr/devtools',
   '@kitr/seo',
   '@kitr/api',
   '@kitr/web',
  ],
  providers: [
   () => import('@kitr/logger'),
   () => import('@kitr/query/provider'),
   () => import('@kitr/theme/provider'),
   () => import('@kitr/i18n/provider'),
   () => import('@kitr/storage/provider'),
   () => import('@kitr/analytics/provider'),
   () => import('@kitr/devtools/provider'),
   () => import('@kitr/web/provider'),
  ],
  platforms: {
   site: web({ mode: 'ssr' }),
   api: server(),
  },
  directories: {
    app: 'app',
    routes: 'app/routes',
    config: 'config',
    components: 'app/components',
    server: 'server',
    platforms: 'platforms',
  },
})