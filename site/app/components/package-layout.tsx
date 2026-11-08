import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { CreatorMark } from '#app/components/creator-marks'
import { type PackageEntry, packageOrder } from '#app/lib/catalog'
import type { Page } from '#app/lib/content'
import { upstream } from '#app/lib/upstream'
import { Command } from './command'
import { DocBody } from './doc-body'
import { SectionList, Sidebar, useActiveHeading } from './docs-nav'
import { Icon, icons } from './icons'
import { LiveExample } from './live-example'
import { CategoryBadge, RunsOnBadge, Tile } from './package-bits'

/**
 * Every package has three parts: an Overview (what it is, what it is built on, what it solves,
 * further reading), the Guide (how to use it) and the API reference. The sidebar is that outline,
 * with the sections of the part you are on, and a way back to every package; the pager at the
 * end walks on to the next part or package.
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
  const overview = current === ''
  const example = overview ? pkg.examples[0] : undefined
  const toc = page?.toc ?? (overview ? builtOverviewToc(pkg) : [])
  const active = useActiveHeading(toc)
  const navigate = useNavigate()

  // Links from before the split point section anchors at the package root
  // (/packages/mail#attach-a-file); those sections now live in the guide.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once per package
  useEffect(() => {
    if (!overview || !pkg.pages.some((p) => p.slug === 'guide')) return
    const toGuide = () => {
      const id = decodeURIComponent(window.location.hash.slice(1))
      if (!id || document.getElementById(id)) return
      navigate({
        to: '/packages/$name/$page',
        params: { name: pkg.name, page: 'guide' },
        hash: id,
        replace: true,
      })
    }
    toGuide()
    window.addEventListener('hashchange', toGuide)
    return () => window.removeEventListener('hashchange', toGuide)
  }, [pkg.name, overview])

  return (
    <div className="container docs-layout docs-layout-package">
      <Sidebar
        label={`${pkg.title} docs`}
        where={
          <>
            <span className="mono">{pkg.name}</span>
            <span className="docs-bar-page">{titleOf(pkg, current)}</span>
          </>
        }
        toc={toc}
        active={active}
      >
        <PackageNav pkg={pkg} page={page} toc={toc} current={current} active={active} />
      </Sidebar>
      <main className="docs-main">
        {overview ? (
          <PackageHead pkg={pkg} />
        ) : (
          <header className="package-head package-head-compact">
            <Tile pkg={pkg} size={44} />
            <div className="package-head-text">
              <span className="label">{titleOf(pkg, current)}</span>
              <h1 className="mono package-title">{pkg.name}</h1>
            </div>
          </header>
        )}

        {example && (
          <LiveExample
            pkg={pkg.name}
            example={example.slug}
            title={example.title}
            description={example.description}
          />
        )}

        {page ? <DocBody page={page} /> : overview ? <BuiltOverview pkg={pkg} /> : null}
        <PackagePager pkg={pkg} current={current} />
      </main>
    </div>
  )
}

function PackageHead({ pkg }: { pkg: PackageEntry }) {
  return (
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
  )
}

/** The headings of the overview the site builds for a package that has no overview.md yet. */
function builtOverviewToc(pkg: PackageEntry): Page['toc'] {
  return [
    { depth: 2, id: 'what-it-is', text: 'What it is' },
    ...(pkg.builtOn?.length ? [{ depth: 2, id: 'built-on', text: 'Built on' }] : []),
    { depth: 2, id: 'install', text: 'Install' },
    { depth: 2, id: 'further-reading', text: 'Further reading' },
  ]
}

const runsOnText = {
  client: 'in the browser',
  server: 'on the server',
  both: 'in the browser and on the server',
} as const

/** Until a package ships docs/overview.md, its overview is built from the manifest. */
function BuiltOverview({ pkg }: { pkg: PackageEntry }) {
  const built = (pkg.builtOn ?? []).map(upstream)
  const has = (slug: string) => pkg.pages.some((p) => p.slug === slug)
  return (
    <div className="prose">
      <h2 id="what-it-is">What it is</h2>
      <p>{pkg.description}</p>
      <p>
        <code>kitr/{pkg.name}</code> runs {runsOnText[pkg.runsOn]}.
      </p>
      {built.length > 0 && (
        <>
          <h2 id="built-on">Built on</h2>
          <p>
            kitr re-exports {built.length > 1 ? 'these libraries' : 'this library'} unchanged and
            adds its own setup and helpers on top, so the upstream docs apply as written.
          </p>
          <ul>
            {built.map((u) => (
              <li key={u.name}>{u.url ? <a href={u.url}>{u.name}</a> : u.name}</li>
            ))}
          </ul>
        </>
      )}
      <h2 id="install">Install</h2>
      {pkg.included ? (
        <p>Every kitr app includes {pkg.title.toLowerCase()}; there is nothing to add.</p>
      ) : (
        <Command cmd={`kitr add ${pkg.name}`} />
      )}
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
      <h2 id="further-reading">Further reading</h2>
      <ul>
        {has('guide') && (
          <li>
            <Link to="/packages/$name/$page" params={{ name: pkg.name, page: 'guide' }}>
              The {pkg.title} guide
            </Link>
            : every task, with code.
          </li>
        )}
        {has('api') && (
          <li>
            <Link to="/packages/$name/$page" params={{ name: pkg.name, page: 'api' }}>
              API reference
            </Link>
            : every export with its signature.
          </li>
        )}
        {built
          .filter((u) => u.url)
          .map((u) => (
            <li key={u.name}>
              <a href={u.url}>{u.name} docs</a>
            </li>
          ))}
        <li>
          <a href={pkg.repo}>Source on GitHub</a>
        </li>
      </ul>
    </div>
  )
}

/** What a package page is called in navigation. */
const titleOf = (pkg: PackageEntry, slug: string) =>
  pkg.pages.find((p) => p.slug === slug)?.title ?? 'Overview'

function PackageNav({
  pkg,
  page,
  toc,
  current,
  active,
}: {
  pkg: PackageEntry
  page: Page | null
  toc: Page['toc']
  current: string
  active: string | undefined
}) {
  const pages = pkg.pages.length ? pkg.pages : [{ slug: '', title: 'Overview', order: 0 }]
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
          <div key={p.slug || 'overview'} className="sidebar-page">
            {p.slug ? (
              <Link
                to="/packages/$name/$page"
                params={{ name: pkg.name, page: p.slug }}
                aria-current={current === p.slug ? 'page' : undefined}
              >
                {p.title}
              </Link>
            ) : (
              <Link
                to="/packages/$name"
                params={{ name: pkg.name }}
                activeOptions={{ exact: true }}
                aria-current={current === '' ? 'page' : undefined}
              >
                {p.title}
              </Link>
            )}
            {current === p.slug && <SectionList toc={toc} active={active} />}
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

/** Every package page in sidebar order: each package's overview, guide, then API reference. */
const stops: Stop[] = packageOrder.flatMap((pkg) =>
  pkg.pages.length
    ? pkg.pages.map((p) => ({ pkg, slug: p.slug, title: p.title }))
    : [{ pkg, slug: '', title: 'Overview' }],
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
