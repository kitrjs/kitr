---
title: Overview
description: Give every page a title, a share preview and a sitemap entry so search engines and chat apps show it well.
order: 0
---

# SEO

## What it is

`@kitr/seo` gives a route its tags in one call, `seo({ title, description })`, with site defaults from `config/seo.ts`. `jsonLd()` adds structured data, `ssrRoute()` picks how a route renders, and the build writes the sitemap and `robots.txt`.

Runs on both sides. Tags only help when crawlers get HTML, so use the [web](/packages/web) platform in `ssr` or `static` mode.

## Install

```sh
kitr add seo
```

Adds `@kitr/seo` and `config/seo.ts`. No provider. [Every change](/packages/seo/guide#install).

## Quick start

Set `head` on a route and return `seo()` from it:

```ts
// app/routes.ts
import { seo } from '@kitr/seo'

r.page('/pricing', {
  head: () => seo({ title: 'Pricing', description: 'Plans for every team size.' }),
  lazy: () => import('./pages/pricing'),
})
```

Open `/pricing` and view the page source. The root route's `<HeadContent />` renders the tags into `<head>`:

```html
<title>Pricing</title>
<meta property="og:title" content="Pricing">
<meta name="twitter:title" content="Pricing">
<meta name="description" content="Plans for every team size.">
<meta property="og:description" content="Plans for every team size.">
<meta name="twitter:description" content="Plans for every team size.">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary">
```

`seo()` returns `{ meta, links }`, the shape TanStack Router's `head` expects, with Open Graph and Twitter tags filled in. The router swaps tags on each navigation. Next in the guide: [Give a page its title](/packages/seo/guide#give-a-page-its-title).

## Built on

kitr adds the tag set, site defaults, JSON-LD helpers, the sitemap and `robots.txt`, and per-route rendering and caching choices.

## Problems it solves

- **Tags written by hand on every page.** [Give a page its title](/packages/seo/guide#give-a-page-its-title).
- **Blank link previews.** [Add a share image](/packages/seo/guide#add-a-share-image).
- **No rich results.** [Add structured data](/packages/seo/guide#add-structured-data).
- **Private pages in search results.** [Keep a page out of search results](/packages/seo/guide#keep-a-page-out-of-search-results).
- **Crawlers that see an empty shell.** [Prerender pages at build time](/packages/seo/guide#prerender-pages-at-build-time).
- **A sitemap that drifts from the routes.** [Generate a sitemap](/packages/seo/guide#generate-a-sitemap).

## Further reading

- [Guide](/packages/seo/guide).
- [API reference](/packages/seo/api).
- [TanStack Router document head management](https://tanstack.com/router/latest/docs/framework/react/guide/document-head-management) and [TanStack Start static prerendering](https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering).
- [Google Search Central](https://developers.google.com/search/docs).
- [Web](/packages/web) and [Router](/packages/router).
