import { defineKitrConfig } from '@kitr/kitr/app'
import { server } from '@kitr/server'

/**
 * Explicit wiring, the Adonis way: every provider is listed here as a lazy import and every
 * platform by name. `kitr add`, `kitr remove` and `kitr config` edit this file; so can you.
 */
export default defineKitrConfig({
  packages: [
    '@kitr/logger',
    '@kitr/server',
    '@kitr/api',
    '@kitr/db',
    '@kitr/realtime',
    '@kitr/testing',
  ],
  providers: [
    () => import('@kitr/logger'),
    () => import('@kitr/db'),
  ],
  platforms: {
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
