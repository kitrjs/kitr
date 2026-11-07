import { Link } from '@tanstack/react-router'
import { CreatorMark } from '#app/components/creator-marks'
import { type PackageEntry, packageOrder } from '#app/lib/catalog'
import type { Page } from '#app/lib/content'
import { upstream } from '#app/lib/upstream'
import { Command } from './command'
import { DocBody } from './doc-body'
import { SectionList, Sidebar, sectionOf, useActiveHeading } from './docs-nav'
import { Icon, icons } from './icons'
import { LiveExample } from './live-example'
import { CategoryBadge, RunsOnBadge, Tile } from './package-bits'

/**
 * Every package page follows one pattern: header, live example, then the guide. The sidebar is
 * the package's own outline (its pages, and the sections of the one you are on), with a way back
 * to every package; the pager at the end walks on to the next page or package.
 */
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
  const toc = page?.toc ?? []
  const active = useActiveHeading(toc)
  const pageTitle = pageLabel(pkg.pages.find((p) => p.slug === current) ?? { slug: '', title: '' })
  return (
    <div className="container docs-layout docs-layout-package">
      <Sidebar
        label={`${pkg.title} docs`}
        where={
          <>
            <span className="mono">{pkg.name}</span>
            {pkg.pages.length > 1 && <span className="docs-bar-page">{pageTitle}</span>}
          </>
        }
        section={sectionOf(toc, active)?.text}
        active={active}
      >
        <PackageNav pkg={pkg} page={page} current={current} active={active} />
      </Sidebar>
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
                <span className="built-on">
                  <span className="muted">Built on</span>
                  {pkg.builtOn.map((key) => {
                    const u = upstream(key)
                    const inner = (
                      <>
                        {u.mark && <CreatorMark name={u.mark} size={14} />}
                        {u.name}
                      </>
                    )
                    return u.url ? (
                      <a
                        key={key}
                        className="built-on-link"
                        href={u.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {inner}
                      </a>
                    ) : (
                      <span key={key} className="built-on-link">
                        {inner}
                      </span>
                    )
                  })}
                </span>
              ) : null}
            </div>
          </div>
        </header>

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
        <PackagePager pkg={pkg} current={current} />
      </main>
    </div>
  )
}

/** What a package page is called in navigation: the guide is "Guide", the rest keep their titles. */
const pageLabel = (p: { slug: string; title: string }) => (p.slug ? p.title : 'Guide')

function PackageNav({
  pkg,
  page,
  current,
  active,
}: {
  pkg: PackageEntry
  page: Page | null
  current: string
  active: string | undefined
}) {
  const pages = pkg.pages.length ? pkg.pages : [{ slug: '', title: '', order: 1 }]
  return (
    <>
      <Link to="/packages" className="sidebar-back" activeOptions={{ exact: true }}>
        <Icon icon={icons.back} size={16} />
        All packages
      </Link>
      <Link
        to="/packages/$name"
        params={{ name: pkg.name }}
        className="sidebar-package"
        activeOptions={{ exact: true }}
      >
        <Tile pkg={pkg} size={28} />
        <span className="mono">{pkg.name}</span>
      </Link>
      <div className="sidebar-group">
        {pages.map((p) => (
          <div key={p.slug || 'guide'} className="sidebar-page">
            {p.slug ? (
              <Link
                to="/packages/$name/$page"
                params={{ name: pkg.name, page: p.slug }}
                aria-current={current === p.slug ? 'page' : undefined}
              >
                {pageLabel(p)}
              </Link>
            ) : (
              <Link
                to="/packages/$name"
                params={{ name: pkg.name }}
                activeOptions={{ exact: true }}
                aria-current={current === '' ? 'page' : undefined}
              >
                {pageLabel(p)}
              </Link>
            )}
            {current === p.slug && page && <SectionList toc={page.toc} active={active} />}
          </div>
        ))}
      </div>
      {page && (
        <div className="sidebar-foot">
          <a href={page.editUrl} target="_blank" rel="noreferrer">
            <Icon icon={icons.edit} size={14} /> Edit this page
          </a>
          <a href={`${page.url}.md`}>View as markdown</a>
        </div>
      )}
    </>
  )
}

type Stop = { pkg: PackageEntry; slug: string; title: string }

/** Every package page in sidebar order: each package's guide, then its other pages. */
const stops: Stop[] = packageOrder.flatMap((pkg) =>
  pkg.pages.length
    ? pkg.pages.map((p) => ({ pkg, slug: p.slug, title: pageLabel(p) }))
    : [{ pkg, slug: '', title: 'Guide' }],
)

function PackagePager({ pkg, current }: { pkg: PackageEntry; current: string }) {
  const index = stops.findIndex((s) => s.pkg.name === pkg.name && s.slug === current)
  if (index < 0) return null
  const prev = stops[index - 1]
  const next = stops[index + 1]
  const link = (stop: Stop, dir: 'Previous' | 'Next') => {
    const same = stop.pkg.name === pkg.name
    const body = (
      <>
        <span className="label">{dir}</span>
        {same ? stop.title : <span className="mono">{stop.pkg.name}</span>}
      </>
    )
    const className = `pager-link${dir === 'Next' ? ' next' : ''}`
    return stop.slug ? (
      <Link
        to="/packages/$name/$page"
        params={{ name: stop.pkg.name, page: stop.slug }}
        className={className}
      >
        {body}
      </Link>
    ) : (
      <Link to="/packages/$name" params={{ name: stop.pkg.name }} className={className}>
        {body}
      </Link>
    )
  }
  return (
    <nav className="pager" aria-label="Previous and next">
      {prev ? link(prev, 'Previous') : <span />}
      {next && link(next, 'Next')}
    </nav>
  )
}
