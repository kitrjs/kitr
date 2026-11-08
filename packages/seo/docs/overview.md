---
title: Overview
description: Give every page a title, a share preview and a sitemap entry so search engines and chat apps show it well.
order: 0
---

# SEO

Paste a link into Slack or search for your product, and what people see comes from a handful of tags: the title, the description, a share image, a canonical URL. Each page needs them, they must be in the HTML crawlers receive, and a sitemap and `robots.txt` must agree with the routes. It is simple work that is easy to half-do.

`@kitr/seo` writes those tags for a route from one call, and wires the build so crawlers get real HTML.

## What it is

`@kitr/seo` gives a route its tags with one call, `seo({ title, description })`, filled in from site defaults in `config/seo.ts`. `jsonLd()` adds structured data for rich results, `ssrRoute()` chooses how a route renders, `robotsTxt()` and the prerender list tell the build which pages to emit as plain HTML and where the sitemap lives, and `cacheHeaders()` sets CDN caching per route.

It runs on both sides: the helpers are plain functions the server renders into HTML and the client keeps up to date while people navigate. Tags only help when the HTML reaches crawlers, so use the [web](/packages/web) platform in `ssr` or `static` mode for pages you want found.

## Install

```sh
kitr add seo
```

This installs `@kitr/seo`, adds the package to `kitrrc.ts` and writes `config/seo.ts`. There is no provider: nothing runs at startup. The guide's [Install](/packages/seo/guide#install) section lists every change.

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

`seo()` returns `{ meta, links }`, the shape TanStack Router's `head` expects, and fills in the Open Graph and Twitter tags from the title and description. When the visitor navigates to another page, the router swaps the tags for that page's. The guide continues from here: [Give a page its title](/packages/seo/guide#give-a-page-its-title).

## Built on

`@kitr/seo` builds on [TanStack Router's `head`](https://tanstack.com/router/latest/docs/framework/react/guide/document-head-management), which merges each route's tags into the document, and [TanStack Start's prerendering](https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering), which writes pages as HTML at build time. kitr adds the tag set (title template, description, canonical, Open Graph and Twitter cards), the site defaults, JSON-LD helpers, the sitemap and `robots.txt` generation, and the per-route rendering and caching choices.

## Problems it solves

- **Tags written by hand on every page.** One call, with defaults from the site config. See [Give a page its title](/packages/seo/guide#give-a-page-its-title).
- **Blank link previews.** Open Graph and Twitter tags with a share image. See [Add a share image](/packages/seo/guide#add-a-share-image).
- **No rich results.** JSON-LD for articles, products and organizations. See [Add structured data](/packages/seo/guide#add-structured-data).
- **Private pages in search results.** Mark a route `noindex` and keep it out of the sitemap. See [Keep a page out of search results](/packages/seo/guide#keep-a-page-out-of-search-results).
- **Crawlers that see an empty shell.** Prerender marketing pages at build time. See [Prerender pages at build time](/packages/seo/guide#prerender-pages-at-build-time).
- **A sitemap that drifts from the routes.** Generate it from the route table. See [Generate a sitemap](/packages/seo/guide#generate-a-sitemap).

## Further reading

- [Guide](/packages/seo/guide): install, configure and every task.
- [API reference](/packages/seo/api): every export and type.
- [TanStack Router document head management](https://tanstack.com/router/latest/docs/framework/react/guide/document-head-management) and [TanStack Start static prerendering](https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering): the mechanisms underneath.
- [Google Search Central](https://developers.google.com/search/docs): how search engines use these tags.
- [Web](/packages/web) and [Router](/packages/router): the rendering modes that decide what crawlers see, and the routes the tags belong to.
