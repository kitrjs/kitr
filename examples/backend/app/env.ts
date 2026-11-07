import { createEnv, env as e } from 'kitr/env'

export const env = createEnv({
  server: {
    PORT: e.number({ default: 3000 }),
    LOG_LEVEL: e.enum(['debug', 'info', 'warn', 'error'], { default: 'info' }),
  },
})
