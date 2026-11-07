import { Link } from '@tanstack/react-router'
import { type Category, categories, type PackageEntry, packages } from '#app/lib/catalog'
import type { Page } from '#app/lib/content'
import { Command } from './command'
import { DocBody, Toc } from './doc-body'
import { LiveExample } from './live-example'
import { CategoryBadge, RunsOnBadge, Tile } from './package-bits'

/** Every package page follows one pattern: header, live example, then install, usage, configuration, API. */
export function PackageLayout({
  pkg,
  page,
  current,
}: {
  pkg: PackageEntry
  page: Page | null
  current: string
}) {
  const example = current === '' ? pkg.examples[0] : undefined
  return (
    <div className="container docs-layout">
      <PackageNav current={pkg.name} />
      <main className="docs-main">
        <header className="package-head">
          <Tile pkg={pkg} size={88} />
          <div className="package-head-text">
            <h1 className="mono package-title">{pkg.name}</h1>
            <p className="package-summary">{pkg.summary}</p>
            <div className="badges">
              <CategoryBadge category={pkg.category} />
              <RunsOnBadge value={pkg.runsOn} />
              {pkg.builtOn?.length ? (
                <span className="muted built-on">Built on {pkg.builtOn.join(', ')}</span>
              ) : null}
            </div>
          </div>
        </header>

        {pkg.pages.length > 1 && (
          <nav className="tabs" aria-label={`${pkg.title} pages`}>
            {pkg.pages.map((p) =>
              p.slug ? (
                <Link
                  key={p.slug}
                  to="/packages/$name/$page"
                  params={{ name: pkg.name, page: p.slug }}
                  aria-current={current === p.slug ? 'page' : undefined}
                >
                  {p.title}
                </Link>
              ) : (
                <Link
                  key="overview"
                  to="/packages/$name"
                  params={{ name: pkg.name }}
                  aria-current={current === '' ? 'page' : undefined}
                >
                  Overview
                </Link>
              ),
            )}
          </nav>
        )}

        {example && (
          <LiveExample
            pkg={pkg.name}
            example={example.slug}
            title={example.title}
            description={example.description}
          />
        )}

        {page ? (
          <DocBody page={page} />
        ) : (
          <div className="prose">
            <h2>Install</h2>
            {pkg.included ? (
              <p>Every kitr app includes {pkg.title.toLowerCase()}; there is nothing to add.</p>
            ) : (
              <Command cmd={`kitr add ${pkg.name}`} />
            )}
            <p>
              {pkg.description} The full guide for this package is being written. Until then, its{' '}
              <a href={pkg.repo} target="_blank" rel="noreferrer">
                source and README
              </a>{' '}
              are the reference.
            </p>
            {pkg.requires?.length ? (
              <p>
                Adding it also adds{' '}
                {pkg.requires.map((r, i) => (
                  <span key={r}>
                    {i ? ', ' : ''}
                    <Link to="/packages/$name" params={{ name: r }}>
                      {r}
                    </Link>
                  </span>
                ))}
                .
              </p>
            ) : null}
          </div>
        )}
      </main>
      {page && <Toc page={page} />}
    </div>
  )
}

function PackageNav({ current }: { current: string }) {
  return (
    <nav className="sidebar" aria-label="Packages">
      {(Object.keys(categories) as Category[]).map((c) => {
        const list = packages.filter((p) => p.category === c)
        if (!list.length) return null
        return (
          <div key={c} className="sidebar-group">
            <span className="label sidebar-title">
              <span className="filter-dot" style={{ background: categories[c].color }} />
              {categories[c].label}
            </span>
            {list.map((p) => (
              <Link
                key={p.name}
                to="/packages/$name"
                params={{ name: p.name }}
                className="mono"
                aria-current={p.name === current ? 'page' : undefined}
              >
                {p.name}
              </Link>
            ))}
          </div>
        )
      })}
    </nav>
  )
}
