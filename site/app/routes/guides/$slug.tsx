import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { DocBody, Toc } from '#app/components/doc-body'
import { GuideMeta } from '#app/components/guide-bits'
import { guidesNav, loadPage } from '#app/lib/content'
import { seo } from '#app/lib/seo'

const flat = guidesNav.flatMap((g) => g.items)

export const Route = createFileRoute('/guides/$slug')({
  loader: async ({ params }) => {
    const page = await loadPage(`guides__${params.slug}`)
    if (!page) throw notFound()
    return page
  },
  head: ({ loaderData }) =>
    loaderData
      ? seo({
          title: `${loaderData.title} · kitr guides`,
          description: loaderData.description ?? '',
          path: loaderData.url,
          type: 'article',
        })
      : {},
  component: GuidePage,
})

function GuidePage() {
  const page = Route.useLoaderData()
  const { slug } = Route.useParams()
  const index = flat.findIndex((i) => i.slug === slug)
  const prev = flat[index - 1]
  const next = flat[index + 1]
  return (
    <div className="container docs-layout">
      <nav className="sidebar" aria-label="Guides">
        <div className="sidebar-group">
          <Link to="/guides" className="sidebar-home">
            All guides
          </Link>
        </div>
        {guidesNav.map((group) => (
          <div key={group.title} className="sidebar-group">
            <span className="label sidebar-title">{group.title}</span>
            {group.items.map((item) => (
              <Link
                key={item.slug}
                to="/guides/$slug"
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
          {page.section && <span className="label">Guide · {page.section}</span>}
          <h1>{page.title}</h1>
          {page.description && <p className="lede">{page.description}</p>}
          <GuideMeta packages={page.packages ?? []} time={page.time} preview={page.preview} />
        </header>
        <DocBody page={page} />
        <nav className="pager" aria-label="Previous and next">
          {prev ? (
            <Link to="/guides/$slug" params={{ slug: prev.slug }} className="pager-link">
              <span className="label">Previous</span>
              {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link to="/guides/$slug" params={{ slug: next.slug }} className="pager-link next">
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
