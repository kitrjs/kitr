import { defineConfig } from 'kitr/ssr'

export default defineConfig({
  ssr: true,
  // Static HTML at build time for these and every page linked from them.
  prerender: { routes: ['/', '/pricing', '/blog'], crawlLinks: true },
  site: { name: 'Site', url: 'https://example.com' },
})
