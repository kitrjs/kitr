import { definePackage } from '@kitr/core/package'

/**
 * `kitr new --kit server`: A pure backend: h3 server, Adonis-style API, logger, db binding, realtime channels. No React in the bundle.
 */
export default definePackage({
  name: 'server',
  kind: 'kit',
  kit: {
    description:
      'A pure backend: h3 server, Adonis-style API, logger, db binding, realtime channels. No React in the bundle.',
    platforms: {
      api: {
        type: 'server',
      },
    },
    packages: ['logger', 'api', 'db', 'realtime', 'testing'],
  },
})
