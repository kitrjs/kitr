import { definePackage } from '@kitr/core/package'

/** `kitr add seo`: head helpers, JSON-LD, per-route rendering defaults, prerender list, robots and sitemap. */
export default definePackage({
  name: 'seo',
  client: true,
  add(ctx) {
    ctx.config(
      'seo',
      `import { defineConfig } from '@kitr/seo'\n\nexport default defineConfig({\n  site: { name: '${ctx.pkg.name ?? 'My app'}' },\n  // Routes prerendered at build time by a web platform in ssr mode; a static web platform prerenders everything.\n  prerender: [],\n})\n`,
    )
    ctx.agents.add(
      'seo',
      `- \`head: (ctx) => seo({ title, description }, ctx)\` from \`@kitr/seo\` writes title, Open Graph, Twitter and canonical tags; \`jsonLd({...})\` adds structured data. Site defaults live in \`config/seo.ts\`.\n- Use \`...ssrRoute('data-only')\` for heavy, non-SEO pages; \`cacheHeaders({ sMaxAge })\` for the CDN.`,
    )
  },
  remove(ctx) {
    ctx.agents.remove('seo')
  },
  eject: { '@kitr/seo': 'meta tags in head()' },
})
