import { defineProvider, getDevtools } from '@kitr/core'
import { createPlatform } from './index'

/** Set by @kitr/vite: `false` in a production build without the devtools overlay, so the panel chunk is never emitted. */
declare const __KITR_DEVTOOLS__: boolean | undefined

/**
 * Binds the `platform` service from the active platform driver. Platform packages
 * (`@kitr/mobile/provider`, `@kitr/desktop/provider`...) register their driver in `register()`,
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
  devtools:
    typeof __KITR_DEVTOOLS__ === 'boolean' && __KITR_DEVTOOLS__ === false
      ? undefined
      : (app, ui) => import('./devtools').then((m) => m.panels(app, ui)),
})

export default platformProvider
