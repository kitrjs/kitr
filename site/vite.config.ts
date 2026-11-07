import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { kitr } from 'kitr/vite'
import { defineConfig, type Plugin } from 'vite'

const site = dirname(fileURLToPath(import.meta.url))
const packagesDir = resolve(site, '../packages')

/** Every live example, so the prerender writes /play/<pkg>/<example> even though only iframes link there. */
const playPages = readdirSync(packagesDir).flatMap((pkg) => {
  const dir = join(packagesDir, pkg, 'examples')
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.tsx'))
        .map((f) => ({ path: `/play/${pkg}/${f.replace(/\.tsx$/, '')}` }))
    : []
})

/**
 * Package examples live in packages/<pkg>/examples and import `kitr/*` like any app would.
 * Resolve those imports from the site, which has every package installed.
 */
function examplesResolve(): Plugin {
  return {
    name: 'kitr-site:examples',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer?.includes('/examples/') || !importer.startsWith(packagesDir)) return null
      if (source.startsWith('.') || source.startsWith('/')) return null
      return this.resolve(source, join(site, 'app/app.ts'), { ...options, skipSelf: true })
    },
  }
}

export default defineConfig({
  plugins: [
    examplesResolve(),
    kitr({
      start: {
        prerender: { enabled: true, crawlLinks: true, failOnError: true },
        pages: [
          { path: '/' },
          { path: '/packages' },
          { path: '/about' },
          { path: '/404' },
          ...playPages,
        ],
      },
    }),
  ],
  server: { fs: { allow: [resolve(site, '..')] } },
})
