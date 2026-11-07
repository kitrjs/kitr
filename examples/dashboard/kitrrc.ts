import { defineKitrConfig } from 'kitr/app'
import { web } from 'kitr/web'

/**
 * Explicit wiring, the Adonis way: every provider is listed here as a lazy import and every
 * platform by name. `kitr add`, `kitr remove` and `kitr config` edit this file; so can you.
 */
export default defineKitrConfig({
  packages: [
   '@kitr/react',
   '@kitr/router',
   '@kitr/query',
   '@kitr/http',
   '@kitr/forms',
   '@kitr/table',
   '@kitr/state',
   '@kitr/tailwind',
   '@kitr/theme',
   '@kitr/auth',
   '@kitr/storage',
   '@kitr/mocks',
   '@kitr/testing',
   '@kitr/devtools',
   '@kitr/vite',
   '@kitr/web',
  ],
  providers: [
   () => import('@kitr/query/provider'),
   () => import('@kitr/http/provider'),
   () => import('@kitr/theme/provider'),
   () => import('@kitr/auth/provider'),
   () => import('@kitr/storage/provider'),
   () => import('@kitr/devtools/provider'),
   () => import('@kitr/web/provider'),
  ],
  platforms: {
   site: web({ mode: 'spa' }),
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