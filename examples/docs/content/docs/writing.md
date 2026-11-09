---
title: Writing pages
description: Frontmatter, callouts, code captions and kitr commands.
---

# Writing pages

Pages are GitHub-flavoured markdown with a few additions. `kitr generate` turns them into HTML at build time, so none of this costs the reader anything.

## Frontmatter

Every page starts with a title and a one-sentence description. The title is the page's heading and the browser tab; the description is the line under the heading, the search result and the share preview.

```md
---
title: Writing pages
description: Frontmatter, callouts, code captions and kitr commands.
---
```

`nav.json` can override both for one page: `{ "slug": "cli", "title": "The CLI" }`.

## Callouts

A blockquote that starts with a marker becomes a callout. Text after the marker on the same line is its title.

```md
> [!NOTE]
> Plain information the reader may want.

> [!WARNING] Deletes data
> Something that loses data or breaks production.
```

> [!NOTE]
> This is a note. `[!TIP]`, `[!WARNING]` and `[!SUMMARY]` work the same way.

## Code blocks

Code is highlighted at build time in a light and a dark theme. When the first line is a comment naming a file, it becomes the block's caption.

```ts
// app/routes.ts
import { loadPage } from '#kitr/content'

const page = await loadPage('docs', 'writing')
```

## Commands

A shell block whose every line starts with `kitr ` becomes a command with tabs for npm, pnpm, yarn and bun. The reader's choice is remembered on every page.

```sh
kitr add content
```

## Steps

Number the H2 headings (`## 1. Install`) and the page shows them as steps, like [Getting started](./getting-started.md).

## Links

Link another page by its file, as you would on GitHub: `[Getting started](./getting-started.md)` becomes a link to `/docs/getting-started`. Links to other sites open in a new tab.

| Write | The reader gets |
| --- | --- |
| `[Getting started](./getting-started.md)` | `/docs/getting-started` |
| `[Writing](./writing.md#callouts)` | `/docs/writing#callouts` |
| `[kitr](https://kitr.dev)` | a new tab |

## Next steps

- [Getting started](./getting-started.md): run, add a page and publish.
- [Content package](https://kitr.dev/packages/content): every option and the React components.
