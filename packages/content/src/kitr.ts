import { definePackage } from '@kitr/core/package'

/** What `kitr add content` writes to `config/content.ts`. */
export const contentConfig = `import { defineConfig } from '@kitr/content'

export default defineConfig({
  collections: {
    // content/docs/*.md, served at /docs/<slug>; nav.json orders and groups them.
    docs: { source: 'content/docs', url: '/docs', nav: 'nav.json' },
  },
  // Serve and build llms.txt, llms-full.txt and <url>.md of every page, for coding agents.
  llms: true,
})
`

/** What `kitr add content` writes to `content/docs/nav.json`. */
export const navJson = `[
  {
    "title": "Start here",
    "pages": ["getting-started"]
  }
]
`

/** What `kitr add content` writes to `content/docs/getting-started.md`. */
export const firstPage = `---
title: Getting started
description: What these docs cover and where to begin.
---

# Getting started

This page is \`content/docs/getting-started.md\`. Edit it, and \`kitr dev\` shows the change.

## Add a page

Write \`content/docs/<slug>.md\` and list its slug in \`content/docs/nav.json\`.
`

/**
 * \`kitr add content\`: markdown in \`content/\`, rendered by \`kitr generate\` into \`.kitr/content\`
 * and read through \`#kitr/content\`; \`llms.txt\` and \`<url>.md\` copies for coding agents.
 */
export default definePackage({
  name: 'content',
  client: true,
  add(ctx) {
    ctx.types.enable()
    ctx.config('content', contentConfig)
    ctx.write('content/docs/nav.json', navJson)
    ctx.write('content/docs/getting-started.md', firstPage)
    ctx.agents.add(
      'content',
      [
        "- Pages are markdown in the folders `config/content.ts` lists (`content/docs/*.md`, served at `/docs/<slug>`). Each starts with `title` and `description` frontmatter; the collection's `nav.json` orders and groups them, and a page missing from it is not built.",
        '- `kitr generate` (run by `kitr dev`, `kitr build` and `kitr typecheck`) renders the markdown into `.kitr/content/`. Never edit those files; edit the markdown.',
        "- Load a page in the route's loader in `app/routes.ts`: `const page = await loadPage('docs', params.slug)` with `loadPage` from `#kitr/content`, and `throw notFound()` when it is `null`. Render it with `<DocBody page={page} />` from `@kitr/content/react`. `nav.docs` from `#kitr/content` is the sidebar; `Slug<'docs'>` types a slug.",
        '- Markdown extras: `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]` callouts; a first code line `// app/routes.ts` becomes the caption; a `sh` block of `kitr ...` lines becomes a command block; `## 1. Step` headings are numbered steps; link other pages as `./other-page.md`.',
      ].join('\n'),
    )
  },
  remove(ctx) {
    ctx.agents.remove('content')
  },
  types: () => import('./types'),
  vite: { plugin: '@kitr/content/vite', serverOnlyConfig: true },
})
