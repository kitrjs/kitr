import { defineKitrConfig } from 'kitr/app'
import { web } from 'kitr/web'
import { desktop } from 'kitr/desktop'

/**
 * Explicit wiring, the Adonis way: every provider is listed here as a lazy import and every
 * platform by name. `kitr add`, `kitr remove` and `kitr config` edit this file; so can you.
 */
export default defineKitrConfig({
  packages: [
   '@kitr/react',
   '@kitr/router',
   '@kitr/platform',
   '@kitr/storage',
   '@kitr/query',
   '@kitr/http',
   '@kitr/forms',
   '@kitr/table',
   '@kitr/state',
   '@kitr/tailwind',
   '@kitr/theme',
   '@kitr/auth',
   '@kitr/mocks',
   '@kitr/testing',
   '@kitr/devtools',
   '@kitr/vite',
   '@kitr/web',
   '@kitr/desktop',
  ],
  providers: [
   () => import('@kitr/platform/provider'),
   () => import('@kitr/storage/provider'),
   () => import('@kitr/query/provider'),
   () => import('@kitr/http/provider'),
   () => import('@kitr/theme/provider'),
   () => import('@kitr/auth/provider'),
   // Development only: the kitr() Vite plugin strips this provider from production builds.
   () => import('@kitr/devtools/provider'),
   () => import('@kitr/web/provider'),
   () => import('@kitr/desktop/provider'),
  ],
  platforms: {
   site: web({ mode: 'spa' }),
   app: desktop(),
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