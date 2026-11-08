import { createEnv, env as e } from '@kitr/kitr/env'

/** Validated at startup. Public vars (VITE_*) ship to the browser; server vars throw if read there. */
export const env = createEnv({
  public: {
    VITE_APP_NAME: e.string({ default: 'desktop' }),
    VITE_API_URL: e.url({ default: 'http://localhost:3333' }),
  },
  server: {},
})