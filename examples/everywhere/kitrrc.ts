import { defineKitrConfig } from 'kitr/app'
import { web } from '@kitr/web'
import { desktop } from '@kitr/desktop'
import { mobile } from '@kitr/mobile'

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
    '@kitr/toast',
    '@kitr/auth',
    '@kitr/storage',
    '@kitr/mocks',
    '@kitr/testing',
    '@kitr/vite',
    '@kitr/web',
    '@kitr/platform',
    '@kitr/desktop',
    '@kitr/mobile',
    '@kitr/secure-storage',
    '@kitr/notifications',
  ],
  providers: [
    () => import('@kitr/query/provider'),
    () => import('@kitr/http/provider'),
    () => import('@kitr/theme/provider'),
    () => import('@kitr/toast/provider'),
    () => import('@kitr/auth/provider'),
    () => import('@kitr/storage/provider'),
    () => import('@kitr/web/provider'),
    () => import('@kitr/platform/provider'),
    () => import('@kitr/desktop/provider'),
    () => import('@kitr/mobile/provider'),
    () => import('@kitr/secure-storage/provider'),
    () => import('@kitr/notifications/provider'),
    () => import('#app/providers/flags-provider'),
  ],
  platforms: {
    site: web({ mode: 'spa' }),
    app: desktop(),
    phone: mobile(),
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
