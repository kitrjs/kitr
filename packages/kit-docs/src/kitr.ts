import {
  type AddContext,
  definePackage,
  displayName,
  removeFiles as remove,
  startDocument,
  writeTemplate as write,
} from '@kitr/core/package'

const navJson = `[
  {
    "title": "Start here",
    "description": "Run the site and write your first pages.",
    "pages": ["getting-started", "writing"]
  }
]
`

const gettingStarted = `---
title: Getting started
description: Run the docs site, add a page and publish it.
---

# Getting started

This site is markdown in \`content/docs/\`, rendered by \`kitr generate\` and served by a static web platform. Every page is plain HTML after \`kitr build\`, so any static host can serve it.

> [!SUMMARY]
> Write a page in \`content/docs/<slug>.md\`, list its slug in \`content/docs/nav.json\`, and it appears at \`/docs/<slug>\` with the sidebar, search and an \`llms.txt\` entry.

## 1. Run the site

Start the dev server. It renders the markdown on start and again whenever you save a page.

\`\`\`sh
kitr dev
\`\`\`

Open the address it prints. The page you are reading is \`content/docs/getting-started.md\`.

## 2. Add a page

Create a markdown file. The file name is the page's slug and the last part of its URL.

\`\`\`md
<!-- content/docs/deploy.md -->
---
title: Deploy
description: Publish the site to any static host.
---

The build writes plain HTML to \`dist/site/client\`.
\`\`\`

Then list the slug in the group it belongs to. The order in \`nav.json\` is the order of the sidebar and of the previous and next links.

\`\`\`json
// content/docs/nav.json
[
  {
    "title": "Start here",
    "pages": ["getting-started", "writing", "deploy"]
  }
]
\`\`\`

## 3. Publish it

Build the site, then upload \`dist/site/client\` to any static host.

\`\`\`sh
kitr build
\`\`\`

The build prerenders every page linked from the home page and writes \`llms.txt\`, \`llms-full.txt\` and a \`.md\` copy of each page beside the HTML, so coding agents can read the docs without a browser.

> [!TIP]
> \`kitr start\` serves the built folder locally, so you can check the result before you upload it.

## Next steps

- [Write pages](./writing.md): frontmatter, callouts, code captions and commands.
- [Content package](https://kitr.dev/packages/content): every option of \`config/content.ts\`.
`

const writing = `---
title: Writing pages
description: Frontmatter, callouts, code captions and kitr commands.
---

# Writing pages

Pages are GitHub-flavoured markdown with a few additions. \`kitr generate\` turns them into HTML at build time, so none of this costs the reader anything.

## Frontmatter

Every page starts with a title and a one-sentence description. The title is the page's heading and the browser tab; the description is the line under the heading, the search result and the share preview.

\`\`\`md
---
title: Writing pages
description: Frontmatter, callouts, code captions and kitr commands.
---
\`\`\`

\`nav.json\` can override both for one page: \`{ "slug": "cli", "title": "The CLI" }\`.

## Callouts

A blockquote that starts with a marker becomes a callout. Text after the marker on the same line is its title.

\`\`\`md
> [!NOTE]
> Plain information the reader may want.

> [!WARNING] Deletes data
> Something that loses data or breaks production.
\`\`\`

> [!NOTE]
> This is a note. \`[!TIP]\`, \`[!WARNING]\` and \`[!SUMMARY]\` work the same way.

## Code blocks

Code is highlighted at build time in a light and a dark theme. When the first line is a comment naming a file, it becomes the block's caption.

\`\`\`ts
// app/routes.ts
import { loadPage } from '#kitr/content'

const page = await loadPage('docs', 'writing')
\`\`\`

## Commands

A shell block whose every line starts with \`kitr \` becomes a command with tabs for npm, pnpm, yarn and bun. The reader's choice is remembered on every page.

\`\`\`sh
kitr add content
\`\`\`

## Steps

Number the H2 headings (\`## 1. Install\`) and the page shows them as steps, like [Getting started](./getting-started.md).

## Links

Link another page by its file, as you would on GitHub: \`[Getting started](./getting-started.md)\` becomes a link to \`/docs/getting-started\`. Links to other sites open in a new tab.

| Write | The reader gets |
| --- | --- |
| \`[Getting started](./getting-started.md)\` | \`/docs/getting-started\` |
| \`[Writing](./writing.md#callouts)\` | \`/docs/writing#callouts\` |
| \`[kitr](https://kitr.dev)\` | a new tab |

## Next steps

- [Getting started](./getting-started.md): run, add a page and publish.
- [Content package](https://kitr.dev/packages/content): every option and the React components.
`

const files = (ctx: AddContext, name: string) => {
  const brand = displayName(name)
  // The starter's pages and their test go; the docs pages bring their own.
  remove(ctx, 'app/pages/home.tsx', 'app/pages/about.tsx', 'test/home.test.tsx')

  write(ctx, 'content/docs/nav.json', navJson)
  write(ctx, 'content/docs/getting-started.md', gettingStarted)
  write(ctx, 'content/docs/writing.md', writing)

  write(
    ctx,
    'config/seo.ts',
    `import { defineConfig } from '@kitr/seo'

export default defineConfig({
  site: { name: '${brand}' },
  // The static platform prerenders every page linked from \`/\`; list pages nothing links to.
  prerender: [],
})
`,
  )

  write(
    ctx,
    'app/document.tsx',
    startDocument({
      imports: `import contentCss from '@kitr/content/styles.css?url'
import { Link } from '@kitr/router'
import { seo } from '@kitr/seo'
import { loadSearch } from '#kitr/content'
import { SearchDialog } from '#components/ui/search-dialog'
import { ThemeToggle } from '#components/ui/theme-toggle'
`,
      headParams: 'ctx: object',
      head: `    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ...seo({ title: '${brand}', description: 'Documentation built with kitr.' }, ctx).meta,
    ],`,
      body: `      <SiteHeader />
      <Outlet />`,
      extra: `
function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link to="/" className="font-semibold">
          ${brand}
        </Link>
        <Link to="/docs" className="text-sm text-muted-foreground hover:text-foreground">
          Docs
        </Link>
        <div className="flex-1" />
        <SearchDialog load={loadSearch} />
        <ThemeToggle />
      </div>
    </header>
  )
}
`,
    }).replace(
      "links: [{ rel: 'stylesheet', href: css }],",
      "links: [\n      { rel: 'stylesheet', href: css },\n      // The look of rendered markdown, over the theme tokens. Drop it to style .prose yourself.\n      { rel: 'stylesheet', href: contentCss },\n    ],",
    ),
  )

  write(
    ctx,
    'app/routes.ts',
    `import { defineRoutes } from '@kitr/kitr/app'
import { notFound } from '@kitr/router'
import router from '@kitr/router/routes'
import { seo } from '@kitr/seo'
import { loadPage } from '#kitr/content'
import { head, RootDocument } from './document'

/**
 * Every page of the site. The docs pages are the markdown in content/docs, rendered by
 * \`kitr generate\`; the loader reads one and \`seo()\` takes its title and description.
 */
export const routes = defineRoutes([router], (r) =>
  r
    .root({ head, component: RootDocument })
    .page('/', { lazy: () => import('./pages/docs') })
    .page('/docs', {
      head: (ctx) => seo({ title: 'Docs' }, ctx),
      lazy: () => import('./pages/docs'),
    })
    .page('/docs/$slug', {
      loader: async ({ params }) => {
        const page = await loadPage('docs', params.slug)
        if (!page) throw notFound()
        return page
      },
      head: (ctx) => seo({ type: 'article' }, ctx),
      lazy: () => import('./pages/docs/slug'),
    }),
)

export type AppRoutes = typeof routes.$types
`,
  )

  write(
    ctx,
    'app/pages/docs.tsx',
    `import { Link } from '@kitr/router'
import { nav } from '#kitr/content'

/** The docs home: every group from content/docs/nav.json, each page with its description. */
export default function DocsIndexPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">${brand}</h1>
      <p className="mt-2 text-lg text-muted-foreground">
        Everything about ${brand}, from the first run to the last option.
      </p>
      {nav.docs.map((group) => (
        <section key={group.title} className="mt-10">
          <h2 className="text-lg font-semibold">{group.title}</h2>
          {group.description && <p className="text-sm text-muted-foreground">{group.description}</p>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {group.items.map((item) => (
              <Link
                key={item.slug}
                to="/docs/$slug"
                params={{ slug: item.slug }}
                className="flex flex-col gap-1 rounded-lg border border-border p-4 hover:border-primary"
              >
                <span className="font-medium">{item.title}</span>
                {item.description && (
                  <span className="text-sm text-muted-foreground">{item.description}</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
`,
  )

  write(
    ctx,
    'app/pages/docs/slug.tsx',
    `import { definePage, getRouteApi, Link } from '@kitr/router'
import { nav } from '#kitr/content'
import { DocLayout } from '#components/ui/doc-layout'

const route = getRouteApi('/docs/$slug')

/** One docs page, and what renders when the loader in app/routes.ts throws notFound(). */
export default definePage({
  component: DocPage,
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold">No such page</h1>
      <Link to="/docs" className="mt-4 inline-block underline">
        All docs
      </Link>
    </main>
  ),
})

function DocPage() {
  const page = route.useLoaderData()
  const { slug } = route.useParams()
  return <DocLayout page={page} nav={nav.docs} base="/docs" slug={slug} />
}
`,
  )

  write(
    ctx,
    'test/docs.test.tsx',
    `import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@kitr/router'
import { renderWithKitr } from '@kitr/testing/react'
import { within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { app } from '#app/app'
import { loadPage, nav } from '#kitr/content'
import { DocLayout } from '#components/ui/doc-layout'

it('renders a docs page with its title, the sidebar and the next page', async () => {
  await app.boot()
  const page = await loadPage('docs', 'getting-started')
  if (!page) throw new Error('kitr generate has not rendered content/docs/getting-started.md')
  const root = createRootRoute({
    component: () => <DocLayout page={page} nav={nav.docs} base="/docs" slug="getting-started" />,
  })
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ['/docs/getting-started'] }),
  })
  const view = renderWithKitr(<RouterProvider router={router} />, { app })
  expect((await view.findByRole('heading', { level: 1 })).textContent).toBe('Getting started')
  expect(view.getByRole('navigation', { name: 'Docs' })).toBeTruthy()
  const pager = view.getByRole('navigation', { name: 'Previous and next' })
  expect(within(pager).getByRole('link').getAttribute('href')).toBe('/docs/writing')
})

it('has no page for an unknown slug', async () => {
  expect(await loadPage('docs', 'no-such-page')).toBeNull()
})
`,
  )
}

/**
 * `kitr new --kit docs`: a static docs site from markdown. `content` renders \`content/docs\`,
 * `seo` gives every page its tags, `tailwind` and `theme` the look, and the registry components
 * the sidebar, search and package-manager commands.
 */
export default definePackage({
  name: 'docs',
  kind: 'kit',
  kit: {
    description:
      'A static docs site from markdown: sidebar, search, package-manager commands, dark mode and llms.txt.',
    platforms: {
      site: {
        type: 'web',
        options: {
          mode: 'static',
        },
      },
    },
    packages: ['content', 'seo', 'tailwind', 'theme', 'testing'],
    components: ['icon', 'button', 'theme-toggle', 'command', 'search-dialog', 'doc-layout'],
    files,
  },
})
