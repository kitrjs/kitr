import { createEnv, env as e } from '@kitr/kitr/env'

/** Validated at startup. Public vars (VITE_*) ship to the browser; server vars throw if read there. */
export const env = createEnv({
  public: {
    VITE_APP_NAME: e.string({ default: 'saas' }),
    VITE_API_URL: e.url({ default: 'http://localhost:3333' }),
    VITE_PLAUSIBLE_DOMAIN: e.string({ optional: true }),
    VITE_PLAUSIBLE_HOST: e.string({ optional: true }),
    VITE_GA_MEASUREMENT_ID: e.string({ optional: true }),
    VITE_SENTRY_DSN: e.string({ optional: true }),
  },
  server: {
    SESSION_SECRET: e.string({ optional: true }),
  },
})