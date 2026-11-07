import { defineKitrConfig } from 'kitr/app'
import { web } from 'kitr/web'

/**
 * Explicit wiring, the Adonis way: every provider is listed here as a lazy import and every
 * platform by name. `kitr add`, `kitr remove` and `kitr config` edit this file; so can you.
 */
export default defineKitrConfig({
  packages: ['@kitr/react', '@kitr/router', '@kitr/query', '@kitr/web'],
  providers: [() => import('@kitr/query/provider'), () => import('@kitr/web/provider')],
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