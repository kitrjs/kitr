import { defineProvider } from '@kitr/core'
import { createFlags, type FlagsConfig, readEmbeddedFlags } from './index'

/**
 * Binds `flags` from `config/flags.ts` (`definitions` from `app/flags.ts`, `providers`). In the
 * browser a snapshot embedded by `<FlagsScript>` loads before the first render; otherwise
 * `resolve()` runs at boot. On the server, `resolveFlags(app, event)` answers per request.
 */
export const flagsProvider = defineProvider({
  name: 'flags',
  register(app) {
    const config = app.config.get('flags', {} as FlagsConfig)
    // Scoped: each server request (a fork of the app) gets its own flags, resolved for its user,
    // so `value()` and server rendering answer for that user and never for the last one resolved.
    app.container.scoped('flags', (container) =>
      createFlags(config.definitions ?? {}, config, app, {
        keepSnapshot: app.isClient || container !== app.container,
      }),
    )
  },
  async boot(app) {
    if (!app.isClient) return
    const flags = app.container.use('flags')
    const embedded = readEmbeddedFlags()
    if (embedded) flags.hydrate(embedded)
    else await flags.resolve().catch(() => {})
  },
})

export default flagsProvider
