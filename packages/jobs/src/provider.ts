import { defineProvider } from '@kitr/core'
import { createJobs, type JobsConfig } from './index'

/**
 * Binds `jobs` from `config/jobs.ts`. The worker starts when the server is ready and drains
 * on shutdown; `worker: false` leaves starting to a separate process (`jobs.start()`).
 */
export const jobsProvider = defineProvider({
  name: 'jobs',
  register(app) {
    if (app.isClient) return
    const config = app.config.get('jobs', {} as JobsConfig)
    app.container.singleton('jobs', () => createJobs(app, config))
  },
  boot(app) {
    // Build the service now: a bad cron or interval in config/jobs.ts fails the boot.
    if (!app.isClient) app.container.use('jobs')
  },
  ready(app) {
    if (app.isClient) return
    const config = app.config.get('jobs', {} as JobsConfig)
    if (config.worker !== false) app.container.use('jobs').start()
  },
  async shutdown(app) {
    if (app.container.has('jobs')) await app.container.use('jobs').stop()
  },
})

export default jobsProvider
