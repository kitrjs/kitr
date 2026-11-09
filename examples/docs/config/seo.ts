import { defineConfig } from '@kitr/seo'

export default defineConfig({
  site: { name: 'Docs' },
  // The static platform prerenders every page linked from `/`; list pages nothing links to.
  prerender: [],
})
