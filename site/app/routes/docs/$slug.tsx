import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { DocBody, Toc } from '#app/components/doc-body'
import { docsNav, loadPage } from '#app/lib/content'

const flat = docsNav.flatMap((g) => g.items)

export const Route = createFileRoute('/docs/$slug')({
  loader: async ({ params }) => {
    const page = await loadPage(`docs__${params.slug}`)
    if (!page) throw notFound()
    return page
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} · kitr docs` },
          { name: 'description', content: loaderData.description ?? '' },
          { property: 'og:title', content: `${loaderData.title} · kitr docs` },
        ]
      : [],
  }),
  component: DocsPage,
})

function DocsPage() {
  const page = Route.useLoaderData()
  const { slug } = Route.useParams()
  const index = flat.findIndex((i) => i.slug === slug)
  const prev = flat[index - 1]
  const next = flat[index + 1]
  return (
    <div className="container docs-layout">
      <nav className="sidebar" aria-label="Docs">
        {docsNav.map((group) => (
          <div key={group.title} className="sidebar-group">
            <span className="label sidebar-title">{group.title}</span>
            {group.items.map((item) => (
              <Link
                key={item.slug}
                to="/docs/$slug"
                params={{ slug: item.slug }}
                aria-current={item.slug === slug ? 'page' : undefined}
              >
                {item.title}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <main className="docs-main">
        <header className="doc-head">
          {page.section && <span className="label">{page.section}</span>}
          <h1>{page.title}</h1>
          {page.description && <p className="lede">{page.description}</p>}
        </header>
        <DocBody page={page} />
        <nav className="pager" aria-label="Previous and next">
          {prev ? (
            <Link to="/docs/$slug" params={{ slug: prev.slug }} className="pager-link">
              <span className="label">Previous</span>
              {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link to="/docs/$slug" params={{ slug: next.slug }} className="pager-link next">
              <span className="label">Next</span>
              {next.title}
            </Link>
          )}
        </nav>
      </main>
      <Toc page={page} />
    </div>
  )
}
