---
title: SEO
description: Give every page a title, a share preview and a sitemap entry so search engines and chat apps show it well.
order: 1
---

# SEO

Search engines and chat apps need a title, a description, a share image and a canonical URL for every page, and a sitemap and `robots.txt` for the site. `kitr/seo` writes them from one call per route and tells the [web platform](/packages/web) which pages to prerender.

## Install

```sh
kitr add seo
```

This installs `@kitr/seo` and writes `config/seo.ts` with your site's name, URL, default image, the prerender list and the robots rules.

## Per route

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { jsonLd, seo } from 'kitr/seo'

export const Route = createFileRoute('/pricing')({
  head: () => ({
    ...seo({ title: 'Pricing', description: 'Plans for every team', image: '/og/pricing.png' }),
    scripts: [jsonLd({ '@type': 'Product', name: 'Acme Team' })],
  }),
})
```

`seo()` returns `meta` and `links` for TanStack Router's `head`: the title with the site name, description, Open Graph, Twitter cards, keywords, canonical and `noindex` when asked. Site-wide defaults come from `config/seo.ts`.

## Rendering and caching

`ssrRoute('data-only')` sets a route's rendering mode in SSR apps; `cacheHeaders({ sMaxAge: 60, staleWhileRevalidate: 30 })` builds a `cache-control` header for loaders and API routes.

## Prerender, sitemap, robots

`config/seo.ts` lists the routes to prerender (and whether to crawl links from them); `kitr build site` writes them as HTML, plus `sitemap.xml` and `robots.txt` from `robotsTxt()`.
