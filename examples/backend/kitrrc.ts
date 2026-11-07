import { defineKitrConfig } from 'kitr/app'
import { server } from 'kitr/server'

/** Server-only kitr app: no React anywhere in the dependency graph. */
export default defineKitrConfig({
  packages: ['@kitr/logger', '@kitr/server', '@kitr/api', '@kitr/db', '@kitr/realtime', '@kitr/testing'],
  providers: [() => import('@kitr/logger'), () => import('@kitr/db')],
  platforms: {
    api: server(),
  },
  directories: { app: 'app', config: 'config', server: 'server', platforms: 'platforms' },
})