---
title: Overview
description: Write pages in markdown and get a docs site: highlighted code, a sidebar, search and copies for coding agents.
order: 0
---

# Content

## What it is

`@kitr/content` turns folders of markdown into typed pages. `kitr generate` renders each file once, with highlighted code, a table of contents and callouts, and writes JSON the app imports from `#kitr/content`: `loadPage('docs', slug)` for one page, `nav.docs` for the sidebar and `loadSearch()` for the search index.

It runs at build time; the app only reads the generated files, so a docs site can be fully static. Use it for docs, guides, changelogs and blog posts. For data that users edit, use a database with [db](/packages/db).

## Install

```sh
kitr add content
```

Adds `@kitr/content`, `config/content.ts` and a first page in `content/docs/`. The [docs kit](/docs/kits#docs) adds it with a sidebar, search and dark mode. [Every change](/packages/content/guide#install).

## Quick start

Load a page in a route's loader and render it with `<DocBody>`:

```tsx
// app/routes.ts
import { defineRoutes } from '@kitr/kitr/app'
import { notFound } from '@kitr/router'
import router from '@kitr/router/routes'
import { loadPage } from '#kitr/content'

export const routes = defineRoutes([router], (r) =>
  r.page('/docs/$slug', {
    loader: async ({ params }) => {
      const page = await loadPage('docs', params.slug)
      if (!page) throw notFound()
      return page
    },
    lazy: () => import('./pages/docs/slug'),
  }),
)
```

Open `/docs/getting-started`. The page shows `content/docs/getting-started.md`, its code highlighted for light and dark themes, and `kitr dev` re-renders it when you save the file. Next in the guide: [Render a page](/packages/content/guide#render-a-page).

## Built on

[unified](https://unifiedjs.com) parses the markdown with remark and rehype, and [Shiki](https://shiki.style) highlights code with the same grammars as VS Code. kitr adds collections, `nav.json`, typed slugs, callouts, command blocks with a package-manager picker, search and `llms.txt`.

## Problems it solves

- **Docs that drift from the sidebar.** [Order and group pages](/packages/content/guide#order-and-group-pages).
- **Code samples that look different in dark mode.** [Highlight code](/packages/content/guide#highlight-code).
- **Install commands for one package manager only.** [Show commands for every package manager](/packages/content/guide#show-commands-for-every-package-manager).
- **No search on a static site.** [Search the pages](/packages/content/guide#search-the-pages).
- **Coding agents that scrape HTML.** [Serve llms.txt](/packages/content/guide#serve-llmstxt).

## Further reading

- [Guide](/packages/content/guide).
- [API reference](/packages/content/api).
- [unified](https://unifiedjs.com/learn/) and [Shiki](https://shiki.style/guide/).
- [SEO](/packages/seo), [Router](/packages/router) and the [docs kit](/docs/kits#docs).
