import { defineConfig } from '@kitr/content'

export default defineConfig({
  collections: {
    // content/docs/*.md, served at /docs/<slug>; nav.json orders and groups them.
    docs: { source: 'content/docs', url: '/docs', nav: 'nav.json' },
  },
  // Serve and build llms.txt, llms-full.txt and <url>.md of every page, for coding agents.
  llms: true,
})
