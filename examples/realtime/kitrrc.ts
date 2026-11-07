import { defineKitrConfig } from 'kitr/app'

/**
 * Explicit wiring, the Adonis way: every provider is listed here as a lazy import.
 * `kitr add` and `kitr remove` edit this file; so can you.
 */
export default defineKitrConfig({
  packages: [
   '@kitr/router',
   '@kitr/query',
   '@kitr/forms',
   '@kitr/styling',
   '@kitr/tailwind',
   '@kitr/ui',
   '@kitr/storage',
   '@kitr/testing',
   '@kitr/devtools',
   '@kitr/logger',
   '@kitr/server',
   '@kitr/ssr',
   '@kitr/api',
   '@kitr/socket',
  ],
  providers: [
   () => import('@kitr/query/provider'),
   () => import('@kitr/ui/provider'),
   () => import('@kitr/storage/provider'),
   () => import('@kitr/devtools/provider'),
   () => import('@kitr/logger'),
  ],
  directories: {
    app: 'app',
    routes: 'app/routes',
    config: 'config',
    components: 'app/components',
  },
})