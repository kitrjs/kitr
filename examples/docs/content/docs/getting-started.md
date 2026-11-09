---
title: Getting started
description: Run the docs site, add a page and publish it.
---

# Getting started

This site is markdown in `content/docs/`, rendered by `kitr generate` and served by a static web platform. Every page is plain HTML after `kitr build`, so any static host can serve it.

> [!SUMMARY]
> Write a page in `content/docs/<slug>.md`, list its slug in `content/docs/nav.json`, and it appears at `/docs/<slug>` with the sidebar, search and an `llms.txt` entry.

## 1. Run the site

Start the dev server. It renders the markdown on start and again whenever you save a page.

```sh
kitr dev
```

Open the address it prints. The page you are reading is `content/docs/getting-started.md`.

## 2. Add a page

Create a markdown file. The file name is the page's slug and the last part of its URL.

```md
<!-- content/docs/deploy.md -->
---
title: Deploy
description: Publish the site to any static host.
---

The build writes plain HTML to `dist/site/client`.
```

Then list the slug in the group it belongs to. The order in `nav.json` is the order of the sidebar and of the previous and next links.

```json
// content/docs/nav.json
[
  {
    "title": "Start here",
    "pages": ["getting-started", "writing", "deploy"]
  }
]
```

## 3. Publish it

Build the site, then upload `dist/site/client` to any static host.

```sh
kitr build
```

The build prerenders every page linked from the home page and writes `llms.txt`, `llms-full.txt` and a `.md` copy of each page beside the HTML, so coding agents can read the docs without a browser.

> [!TIP]
> `kitr start` serves the built folder locally, so you can check the result before you upload it.

## Next steps

- [Write pages](./writing.md): frontmatter, callouts, code captions and commands.
- [Content package](https://kitr.dev/packages/content): every option of `config/content.ts`.
