import { defineConfig } from '@kitr/seo'

export default defineConfig({
  site: { name: 'saas' },
  // Routes prerendered at build time by a web platform in ssr mode; a static web platform prerenders everything.
  prerender: [],
})
