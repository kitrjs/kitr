import { definePackage } from '@kitr/core/package'

/**
 * `kitr new --kit app`: A logged-in app on an external API: http, forms, tables, state, theme, tailwind, auth, mocks, testing.
 */
export default definePackage({
  name: 'app',
  kind: 'kit',
  kit: {
    description:
      'A logged-in app on an external API: http, forms, tables, state, theme, tailwind, auth, mocks, testing.',
    platforms: {
      site: {
        type: 'web',
        options: {
          mode: 'spa',
        },
      },
    },
    packages: [
      'http',
      'forms',
      'table',
      'state',
      'tailwind',
      'theme',
      'auth',
      'storage',
      'mocks',
      'testing',
      'devtools',
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
