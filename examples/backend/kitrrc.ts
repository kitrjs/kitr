import { defineKitrConfig } from 'kitr/app'

/** Server-only kitr app: no React anywhere in the dependency graph. */
export default defineKitrConfig({
  packages: [
    '@kitr/logger',
    '@kitr/server',
    '@kitr/api',
    '@kitr/db',
    '@kitr/socket',
    '@kitr/testing',
  ],
  providers: [() => import('@kitr/logger'), () => import('@kitr/db')],
  directories: { app: 'app', config: 'config' },
})