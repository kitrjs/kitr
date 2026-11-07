import { defineProvider } from '@kitr/core'
import type { ShieldConfig } from './index'

/** Validates `config/shield.ts` at boot; `shield(server)` in server/main.ts attaches the middleware. */
export const shieldProvider = defineProvider({
  name: 'shield',
  register(app) {
    if (app.isClient) return
    const config = app.config.get('shield', {} as ShieldConfig)
    if (config.cors && config.cors.origin === '*' && config.cors.credentials)
      throw new Error(
        '[kitr/shield] cors.origin "*" cannot be combined with credentials; list the origins instead.',
      )
  },
})

export default shieldProvider
