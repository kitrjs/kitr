import { definePackage } from '@kitr/core/package'

/**
 * `kitr new --kit fullstack`: The app kit plus a server-rendered web platform, an API server, actions, api and realtime channels.
 */
export default definePackage({
  name: 'fullstack',
  kind: 'kit',
  kit: {
    description:
      'The app kit plus a server-rendered web platform, an API server, actions, api and realtime channels.',
    platforms: {
      site: {
        type: 'web',
        options: {
          mode: 'ssr',
        },
      },
      api: {
        type: 'server',
      },
    },
    packages: [
      'http',
      'forms',
      'table',
      'state',
      'tailwind',
      'theme',
      'toast',
      'auth',
      'storage',
      'testing',
      'seo',
      'actions',
      'api',
      'realtime',
    ],
    components: [
      'icon',
      'button',
      'input',
      'label',
      'card',
      'form',
      'data-table',
      'page-header',
      'empty-state',
      'theme-toggle',
      'app-shell',
    ],
  },
})
