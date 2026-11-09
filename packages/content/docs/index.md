---
title: Content
description: Write pages in markdown and get a docs site: highlighted code, a sidebar, search and copies for coding agents.
order: 1
---

# Content

Product docs, guides and changelogs start as markdown files, and turning them into pages with a sidebar, highlighted code and search is a project of its own. `@kitr/content` renders each folder of markdown at build time into typed JSON that your routes load with `loadPage('docs', slug)`. It builds on [unified](https://unifiedjs.com) and [Shiki](https://shiki.style), and adds collections, a `nav.json` sidebar, callouts, package-manager command blocks, search and `llms.txt` for coding agents.

> [!SUMMARY]
> Writes pages in markdown and gets a docs site: highlighted code, a sidebar, search and copies for coding agents. Add it with `kitr add content`; the overview is at [/packages/content](/packages/content).

Rendering happens in `kitr generate`, so the browser downloads HTML and JSON, never a markdown parser. The components run on both sides. The examples follow Acme's docs at `docs.acme.com`. For records that users create and edit, use a database with [db](/packages/db) instead.

## Install

```sh
kitr add content
```

<details>
<summary>Everything kitr add changes</summary>

What `kitr add` does:

- Installs `@kitr/content` and adds it to `packages` in `kitrrc.ts`. It registers no provider.
- Turns on `kitr generate`, so `kitr dev`, `kitr build` and `kitr typecheck` render the markdown into `.kitr/content/`.
- Writes `config/content.ts` (shown in [Configure](#configure)) and regenerates `config/index.ts`.
- Writes `content/docs/nav.json` and a first page, `content/docs/getting-started.md`.
- Adds the content Vite plugin, which serves `llms.txt` in dev and writes it in the build.
- Adds a `## kitr: content` section to `AGENTS.md` on frontmatter, `nav.json`, `loadPage()` and the markdown extras.

It asks no questions and adds no env variables. The [docs kit](/docs/kits#docs) includes content and adds the sidebar, search and pages.

`kitr remove content` removes the `packages` entry, the dependency and the `AGENTS.md` section. It leaves `content/` and your routes in place.

</details>

## Configure

`kitr add content` writes this file:

```ts
// config/content.ts
import { defineConfig } from '@kitr/content'

export default defineConfig({
  collections: {
    // content/docs/*.md, served at /docs/<slug>; nav.json orders and groups them.
    docs: { source: 'content/docs', url: '/docs', nav: 'nav.json' },
  },
  // Serve and build llms.txt, llms-full.txt and <url>.md of every page, for coding agents.
  llms: true,
})
```

`kitr generate` runs this file with the project's TypeScript, so it can import helpers and compute values. The app never reads it at run time.

| Option | Default | Description |
| --- | --- | --- |
| `collections` | none | Collections by name; the name is what `loadPage(name, slug)` and `nav[name]` use. |
| `collections.<name>.source` | none | The folder of `*.md` files, from the project root. |
| `collections.<name>.url` | none | The URL prefix: `/docs` serves `cli.md` at `/docs/cli`. |
| `collections.<name>.nav` | none | A JSON file in `source` that orders and groups pages. |
| `collections.<name>.title` | the name, capitalised | The group title when there is no `nav`. |
| `llms` | `false` | Write `llms.txt`, `llms-full.txt` and `<url>.md`; `true` or `{ title, description, url }`. |
| `llms.title` | package name as words | The `#` heading of `llms.txt`: `acme-docs` becomes `Acme Docs`. |
| `llms.description` | none | The summary line under the heading. |
| `llms.url` | relative links | The site origin, such as `https://docs.acme.com`, for absolute links. |
| `code.themes` | `github-light-high-contrast`, `github-dark` | Shiki themes for light and dark. |
| `code.langs` | ts, tsx, js, jsx, json, sh, bash, css, html, md, yaml, diff | Languages to load; others render as plain text. |
| `editUrl` | none | The start of an "Edit this page" link; the file path is appended. |

There are no env variables.

## Render a page

A page is a markdown file with `title` and `description` frontmatter. Acme's guide to invoices:

```md
---
title: Send an invoice
description: Create an invoice for a team and email it.
---

# Send an invoice

Invoices belong to a team. Create one from the billing page.

## Email it

Grace gets a copy at grace@acme.com.
```

List its slug in `content/docs/nav.json`, then load it in the route's loader. On the server and in the client, `loadPage()` imports only that page's JSON:

```ts
// app/routes.ts
import { defineRoutes } from '@kitr/kitr/app'
import { notFound } from '@kitr/router'
import router from '@kitr/router/routes'
import { seo } from '@kitr/seo'
import { loadPage } from '#kitr/content'

export const routes = defineRoutes([router], (r) =>
  r.page('/docs/$slug', {
    loader: async ({ params }) => {
      const page = await loadPage('docs', params.slug)
      if (!page) throw notFound()
      return page
    },
    head: (ctx) => seo({ type: 'article' }, ctx),
    lazy: () => import('./pages/docs/slug'),
  }),
)
```

Render it with `<DocBody>` in a component:

```tsx
// app/pages/docs/slug.tsx
import { DocBody, Toc } from '@kitr/content/react'
import { getRouteApi } from '@kitr/router'

const route = getRouteApi('/docs/$slug')

export default function DocPage() {
  const page = route.useLoaderData()
  return (
    <main className="mx-auto flex max-w-5xl gap-10 px-4 py-12">
      <article className="min-w-0 flex-1">
        <h1 className="text-3xl font-bold">{page.title}</h1>
        <DocBody page={page} />
      </article>
      <Toc page={page} />
    </main>
  )
}
```

`/docs/send-an-invoice` shows the title, the body and an "On this page" list with "Email it" marked while you read it. The leading `# heading` is left out of the body because the layout renders `page.title`. A slug with no file returns `null`, and the loader's `notFound()` renders the route's not-found component.

## Order and group pages

`nav.json` lists the groups of the sidebar and the pages in each, in order. A page missing from it is not built:

```json
[
  {
    "title": "Billing",
    "description": "Invoices, plans and payments.",
    "pages": ["send-an-invoice", { "slug": "plans", "title": "Plans and seats" }]
  }
]
```

An entry is a slug or `{ slug, title?, description?, source? }`; `source` points at a file outside the folder, so two collections can share a page. A collection without `nav` lists every `*.md` in one group, sorted by the frontmatter `order`, then by title.

`nav.docs` from `#kitr/content` is that file, typed. `Slug<'docs'>` is the union of its slugs, so a link to a missing page fails `kitr typecheck`:

```tsx
// app/components/billing-links.tsx
import { Link } from '@kitr/router'
import { nav, type Slug } from '#kitr/content'

const featured: Slug<'docs'> = 'send-an-invoice'

export function BillingLinks() {
  return (
    <ul>
      {nav.docs.flatMap((group) => group.items).map((item) => (
        <li key={item.slug}>
          <Link to="/docs/$slug" params={{ slug: item.slug }}>
            {item.slug === featured ? <strong>{item.title}</strong> : item.title}
          </Link>
        </li>
      ))}
    </ul>
  )
}
```

## Highlight code

Shiki highlights every fenced block for both themes at build time. The first line names the file when it is a path comment, and it becomes the block's caption:

```ts
// server/billing/invoice.ts
export const total = (lines: { amount: number }[]) =>
  lines.reduce((sum, line) => sum + line.amount, 0)
```

The page renders a `server/billing/invoice.ts` caption above the code, without the comment line, and a Copy button. The CSS variables switch colours when `<html data-theme="dark">` is set, which [theme](/packages/theme) does. Add languages or change themes in `code`; a fence in a language that is not loaded renders as plain text.

## Show commands for every package manager

A `sh` block whose lines all start with `kitr` becomes a command block instead of HTML:

```sh
kitr add mail
```

`<DocBody>` renders it as a plain code block. Pass `renderCommand` to show a picker; the registry's `command` component, which the docs kit installs, shows npm, pnpm, yarn and bun tabs and remembers the choice:

```tsx
// app/pages/docs/body.tsx
import type { Page } from '@kitr/content'
import { DocBody } from '@kitr/content/react'
import { Command } from '#components/ui/command'

export function Body({ page }: { page: Page }) {
  return <DocBody page={page} renderCommand={(cmd) => <Command cmd={cmd} />} />
}
```

## Write callouts, steps and next steps

Markdown extras that render without any component:

| Write | Renders as |
| --- | --- |
| `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!SUMMARY]` | A callout; text after the marker is its title. |
| `## 1. Create the team` | A numbered step; the number leaves the heading. |
| A last `## Next steps` with one list of links | Cards, one per link. |
| `[the CLI](./cli.md#flags)` | A link to `/docs/cli#flags`. |
| A link to `https://` | Opens in a new tab with `rel="noreferrer"`. |
| A table | A table that scrolls sideways on phones. |

Every h2 and h3 gets an `id`, and the h2s and h3s fill `page.toc`. Link between pages by file name, so links keep working in your editor and on GitHub.

## Search the pages

`kitr generate` writes a search index with one entry per page and per h2 or h3. `search()` ranks it: titles first, then headings, then text, at most two hits per page:

```ts
// app/search.ts
import { search } from '@kitr/content'
import { loadSearch } from '#kitr/content'

export async function find(query: string) {
  const entries = await loadSearch()
  return search(entries, query, 5)
}

// await find('invoice')
// => [{ url: '/docs/send-an-invoice', title: 'Send an invoice', section: 'Billing', heading: '', text: '...' }]
```

`loadSearch()` downloads the index on first use only. The registry's `search-dialog` component wraps this in a dialog that opens on Cmd+K.

## Serve llms.txt

With `llms: true`, `kitr dev` answers `/llms.txt`, `/llms-full.txt` and every page's markdown at `<url>.md`, and `kitr build` writes the same files next to the HTML:

```sh
curl http://localhost:3000/llms.txt
# # Acme Docs
#
# ## Billing
#
# - [Send an invoice](/docs/send-an-invoice.md): Create an invoice for a team and email it.
```

Coding agents read the markdown instead of scraping HTML. Set `llms.url` to make the links absolute.

## Testing

Vitest runs `kitr generate` before the tests, so `#kitr/content` is current. Load a page and render it like any component:

```tsx
// test/docs.test.tsx
import { search } from '@kitr/content'
import { DocBody } from '@kitr/content/react'
import { render } from '@testing-library/react'
import { expect, it } from 'vitest'
import { loadPage, loadSearch } from '#kitr/content'

it('renders the getting started page', async () => {
  const page = await loadPage('docs', 'getting-started')
  expect(page).toMatchObject({ url: '/docs/getting-started', title: 'Getting started' })
  const view = render(<DocBody page={page!} />)
  expect(view.getByRole('heading', { name: 'Add a page' })).toBeTruthy()
})

it('finds the page by its heading', async () => {
  const [hit] = search(await loadSearch(), 'add a page')
  expect(hit?.url).toBe('/docs/getting-started#add-a-page')
})

it('has no page for an unknown slug', async () => {
  expect(await loadPage('docs', 'no-such-page')).toBeNull()
})
```

`<DocBody>` works without a router; inside one, it turns clicks on internal links into client-side navigation.

## Next steps

- [API reference](/packages/content/api)
- [SEO](/packages/seo)
- [The docs kit](/docs/kits#docs)
