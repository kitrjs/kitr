import { defineProvider, getDevtools } from '@kitr/core'
import { createPlatform } from './index'

/**
 * Binds the `platform` service from the active platform driver. Platform packages
 * (`kitr/mobile/provider`, `kitr/desktop/provider`...) register their driver in `register()`,
 * so list them before this provider in kitrrc.ts; `kitr add` keeps that order.
 */
export const platformProvider = defineProvider({
  name: 'platform',
  register(app) {
    app.container.singleton('platform', () => createPlatform(app))
  },
  boot(app) {
    const hub = getDevtools(app)
    if (!hub) return
    const platform = app.container.use('platform')
    hub.log(
      'platform',
      `running as ${platform.type} (${platform.os})${platform.native ? ', native' : ''}`,
    )
  },
  devtools: (app) => import('./devtools').then((m) => m.panels(app)),
})

export default platformProvider
