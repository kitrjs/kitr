import { definePackage } from '@kitr/core/package'

/**
 * `kitr new --kit app`: the smallest app that runs. The web platform brings Vite, React and the
 * router; `query` loads data; `tailwind` and `theme` make the first page look right; `testing`
 * gives `pnpm test` a home. Everything else (sign-in, forms, tables, an API) arrives with `kitr add` when the app
 * needs it, so a new project starts with files you will read, not files you might use.
 */
export default definePackage({
  name: 'app',
  kind: 'kit',
  kit: {
    description:
      'The smallest app that runs: pages, data loading and styling, nothing else wired yet.',
    platforms: {
      site: {
        type: 'web',
        options: {
          mode: 'spa',
        },
      },
    },
    packages: ['query', 'tailwind', 'theme', 'testing'],
    components: [],
  },
})
