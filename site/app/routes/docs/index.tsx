import { createFileRoute, Link } from '@tanstack/react-router'
import { Sidebar } from '#app/components/docs-nav'
import { Icon, icons } from '#app/components/icons'
import { docsNav } from '#app/lib/content'
import { seo } from '#app/lib/seo'

export const Route = createFileRoute('/docs/')({
  head: () =>
    seo({
      title: 'Docs · kitr',
      description:
        'Start here: what kitr is, how to create an app, use a package, configure it, add your own code and ship it.',
      path: '/docs',
    }),
  component: DocsIndex,
})

function DocsIndex() {
  return (
    <div className="container docs-layout">
      <Sidebar label="Docs" where="Docs">
        {docsNav.map((group) => (
          <div key={group.title} className="sidebar-group">
            <span className="label sidebar-title">{group.title}</span>
            {group.items.map((item) => (
              <div key={item.slug} className="sidebar-page">
                <Link to="/docs/$slug" params={{ slug: item.slug }}>
                  {item.title}
                </Link>
              </div>
            ))}
          </div>
        ))}
        <div className="sidebar-group">
          <span className="label sidebar-title">Packages</span>
          <Link to="/packages" className="sidebar-browse">
            Browse every package
            <Icon icon={icons.arrow} size={16} />
          </Link>
        </div>
      </Sidebar>
      <main className="docs-main">
        <header className="doc-head">
          <h1>Docs</h1>
          <p className="lede">Find the page that answers what you are trying to do.</p>
        </header>
        <div className="prose">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>If you want to…</th>
                  <th>Start here</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Understand why kitr exists</td>
                  <td>
                    <Link to="/docs/$slug" params={{ slug: 'what-is-kitr' }}>
                      What is kitr
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td>Create an app</td>
                  <td>
                    <Link to="/docs/$slug" params={{ slug: 'getting-started' }}>
                      Getting started
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td>Use a package</td>
                  <td>
                    <Link to="/packages">Packages</Link>
                  </td>
                </tr>
                <tr>
                  <td>Configure something</td>
                  <td>
                    <Link to="/docs/$slug" params={{ slug: 'configuration' }}>
                      Configuration
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td>Add your own code</td>
                  <td>
                    <Link to="/docs/$slug" params={{ slug: 'extending' }}>
                      Add your own code
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td>Ship to phones or desktops</td>
                  <td>
                    <Link to="/guides">Guides</Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <section className="link-cards">
          <Link to="/docs/$slug" params={{ slug: 'getting-started' }}>
            <h3>Getting started</h3>
            <span className="muted">Install the CLI and run your first app.</span>
          </Link>
          <Link to="/packages">
            <h3>Browse packages</h3>
            <span className="muted">Every package, one kitr add away.</span>
          </Link>
          <Link to="/guides">
            <h3>Guides</h3>
            <span className="muted">Step-by-step walkthroughs, from sign-in to deploy.</span>
          </Link>
        </section>
      </main>
    </div>
  )
}
