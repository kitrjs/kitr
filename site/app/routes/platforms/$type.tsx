import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import type { CSSProperties } from 'react'
import { Command } from '#app/components/command'
import { CreatorMark } from '#app/components/creator-marks'
import { Icon, icons } from '#app/components/icons'
import { DirectoryCard, Tile } from '#app/components/package-bits'
import { PlatformTile, Rich } from '#app/components/platform-bits'
import { type Category, categories, findPackage, glyph, type PackageEntry } from '#app/lib/catalog'
import { findPlatform, type PlatformEntry, platforms } from '#app/lib/platforms'
import { seo } from '#app/lib/seo'
import { upstream } from '#app/lib/upstream'

export const Route = createFileRoute('/platforms/$type')({
  loader: ({ params }) => {
    const platform = findPlatform(params.type)
    if (!platform) throw notFound()
    return { platform }
  },
  head: ({ loaderData }) =>
    loaderData
      ? seo({
          title: `${loaderData.platform.type === 'desktop' ? 'Desktop with Electron' : loaderData.platform.name} · kitr platforms`,
          description: loaderData.platform.tagline,
          path: `/platforms/${loaderData.platform.type}`,
          type: 'article',
        })
      : {},
  component: PlatformPage,
})

const resolve = (names: string[]) =>
  names.map(findPackage).filter((p): p is PackageEntry => Boolean(p))

/** Electron and Tauri side by side, on both desktop pages. */
const shells = [
  ['Ships with', 'Its own Chromium', 'The OS webview'],
  ['Installer size', 'Larger (a browser inside)', 'Small'],
  ['Rendering', 'Identical on every OS', 'Can differ between OSes'],
  ['Native side', 'Node, over typed IPC', 'Rust commands and events'],
  ['Build needs', 'Node only', 'The Rust toolchain'],
] as const

function PlatformPage() {
  const { platform: p } = Route.useLoaderData()
  const native = resolve(p.packages.native)
  const other = resolve(p.packages.other)
  const groups = (Object.keys(categories) as Category[])
    .map((c) => ({ category: c, list: other.filter((pkg) => pkg.category === c) }))
    .filter((g) => g.list.length)
  const others = platforms.filter((x) => x.type !== p.type)
  const kits = p.kits
  const lower = p.type === 'tauri' ? p.name : p.name.toLowerCase()

  return (
    <main className="container platform-page" style={{ '--platform': p.color } as CSSProperties}>
      <nav className="crumbs mono" aria-label="Breadcrumb">
        <Link to="/platforms">Platforms</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{p.name}</span>
      </nav>

      <section className="platform-hero">
        <div className="platform-hero-copy">
          <div className="platform-hero-head">
            <span className="tile platform-hero-tile" style={{ background: p.color }}>
              <Icon icon={glyph(p.type)} size={34} stroke="#0B121C" />
            </span>
            <span className="label">
              Platform · <span className="mono">{p.type}</span>
            </span>
          </div>
          <h1 className="display platform-title">{p.name}</h1>
          <p className="lede">{p.tagline}</p>
          <ul className="target-chips" aria-label="Runs on">
            {p.targets.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <Command cmd={p.command} />
          <div className="actions">
            <Link to="/packages/$name" params={{ name: p.type }} className="button primary">
              Read the {lower} guide
            </Link>
            <a href="#packages" className="button">
              What works here
            </a>
          </div>
          <div className="built-on">
            <span className="muted">Built on</span>
            {p.builtOn.map((key) => {
              const u = upstream(key)
              return u.url ? (
                <a
                  key={key}
                  href={u.url}
                  className="built-on-link"
                  target="_blank"
                  rel="noreferrer"
                >
                  {u.mark && <CreatorMark name={u.mark} size={14} />}
                  {u.name}
                </a>
              ) : (
                <span key={key} className="built-on-link">
                  {u.name}
                </span>
              )
            })}
          </div>
        </div>
        <div
          className="feature-code platform-hero-code"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: highlighted at build time
          dangerouslySetInnerHTML={{ __html: p.code }}
        />
      </section>

      <section className="platform-highlights" aria-label={`What ${p.name} gives you`}>
        {p.highlights.map((h) => (
          <div key={h.title} className="platform-highlight">
            <h2>{h.title}</h2>
            <p className="muted">
              <Rich text={h.text} />
            </p>
          </div>
        ))}
      </section>

      <section className="platform-run" aria-labelledby="run-title">
        <div>
          <h2 id="run-title">Same commands as every platform</h2>
          <p className="muted">
            Every platform answers to <code>kitr dev</code>, <code>kitr build</code> and{' '}
            <code>kitr start</code>, by the name you gave it. Leave the name off to run them all.
          </p>
        </div>
        <dl className="run-list mono">
          {p.run.map(([cmd, what]) => (
            <div key={cmd}>
              <dt>{cmd}</dt>
              <dd>{what}</dd>
            </div>
          ))}
        </dl>
      </section>

      {p.alternative && <ShellCompare current={p} />}

      <section id="packages" className="platform-packages" aria-labelledby="packages-title">
        <div className="section-head">
          <div>
            <h2 id="packages-title">Packages that work here</h2>
            <p className="muted">
              {native.length + other.length} packages run on {lower}. Each one is a single{' '}
              <code>kitr add</code> away.
            </p>
          </div>
          <Link to="/packages">All packages →</Link>
        </div>
        {native.length > 0 && (
          <div className="package-group package-group-native">
            <h3>
              {p.nativeLabel}
              <span className="muted">
                {p.side === 'server'
                  ? 'Server-only packages for your API.'
                  : p.type === 'web'
                    ? 'Only meaningful where pages are HTML.'
                    : 'Their drivers switch to the native APIs underneath, with no code change.'}
              </span>
            </h3>
            <div className="dir-grid">
              {native.map((pkg) => (
                <DirectoryCard key={pkg.name} pkg={pkg} showCategory />
              ))}
            </div>
          </div>
        )}
        <div className="package-columns">
          {groups.map((g) => (
            <div key={g.category} className="package-column">
              <h3 className="label">
                <span
                  className="kit-chip-dot"
                  style={{ background: categories[g.category].color }}
                />
                {categories[g.category].label}
              </h3>
              <ul>
                {g.list.map((pkg) => (
                  <li key={pkg.name}>
                    <Link to="/packages/$name" params={{ name: pkg.name }} className="package-row">
                      <Tile pkg={pkg} size={32} />
                      <span className="package-row-text">
                        <span className="mono package-row-name">{pkg.name}</span>
                        <span className="muted">{pkg.summary}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="platform-learn" aria-labelledby="learn-title">
        <h2 id="learn-title">Learn more</h2>
        <div className="learn-grid">
          <div className="learn-col">
            <span className="label">Guides</span>
            {p.guides.length ? (
              <>
                {p.guides.slice(0, 4).map((g) => (
                  <Link key={g.url} to={g.url} className="learn-link">
                    <strong>{g.title}</strong>
                    {g.description && <span className="muted">{g.description}</span>}
                  </Link>
                ))}
                {p.guides.length > 4 && (
                  <Link to="/guides" className="learn-more">
                    All {p.guides.length} guides →
                  </Link>
                )}
              </>
            ) : (
              <p className="muted learn-empty">
                A step-by-step guide for {lower} is being written. Until then the platform guide
                below walks through it.
              </p>
            )}
          </div>
          <div className="learn-col">
            <span className="label">Docs</span>
            {p.docs.map((d) => (
              <Link key={d.url} to={d.url} className="learn-link">
                <strong>{d.title}</strong>
                {d.description && <span className="muted">{d.description}</span>}
              </Link>
            ))}
            <Link to="/docs/$slug" params={{ slug: 'platforms' }} className="learn-link">
              <strong>Platforms reference</strong>
              <span className="muted">Every option, command and the platform contract.</span>
            </Link>
          </div>
          <div className="learn-col">
            <span className="label">Resources</span>
            {p.resources.map((r) => (
              <a key={r.url} href={r.url} className="learn-link" target="_blank" rel="noreferrer">
                <strong>
                  {r.title} <Icon icon={icons.external} size={14} />
                </strong>
                <span className="muted">
                  <Rich text={r.text} />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {kits.length > 0 && (
        <section className="platform-kits" aria-labelledby="kits-title">
          <div>
            <h2 id="kits-title">Start from a kit</h2>
            <p className="muted">
              A kit sets up the platforms, the packages and a first page in one command.{' '}
              {kits.length > 1 && (
                <>
                  Kits with {lower}:{' '}
                  {kits.map((k, i) => (
                    <span key={k}>
                      {i > 0 && ', '}
                      <code>{k}</code>
                    </span>
                  ))}
                  .
                </>
              )}
            </p>
          </div>
          <Command cmd={`kitr new my-app --kit ${kits[0]}`} />
        </section>
      )}

      <section className="platform-combine" aria-labelledby="combine-title">
        <div className="section-head">
          <div>
            <h2 id="combine-title">Add another platform</h2>
            <p className="muted">
              Platforms share the <code>app/</code> folder, so adding one is a command, not a
              rewrite.
            </p>
          </div>
          <Link to="/platforms" hash="mix">
            Mix and match →
          </Link>
        </div>
        <div className="combine-row">
          {others.map((o) => (
            <PlatformTile key={o.type} platform={o} size="sm" />
          ))}
        </div>
      </section>
    </main>
  )
}

function ShellCompare({ current }: { current: PlatformEntry }) {
  const electron = current.type === 'desktop'
  return (
    <section className="shell-compare" aria-labelledby="compare-title">
      <div>
        <h2 id="compare-title">Electron or Tauri?</h2>
        <p className="muted">
          Both run the same <code>app/</code> and register the same <code>platform</code> and{' '}
          <code>storage</code> drivers, so switching is one line in <code>kitrrc.ts</code>. A
          project keeps one of the two. Electron is the default we recommend.
        </p>
        <Link to="/platforms/$type" params={{ type: electron ? 'tauri' : 'desktop' }}>
          {electron ? 'See Tauri →' : 'See Electron →'}
        </Link>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th />
              <th className={electron ? 'is-current' : ''}>Electron</th>
              <th className={electron ? '' : 'is-current'}>Tauri</th>
            </tr>
          </thead>
          <tbody>
            {shells.map(([row, e, t]) => (
              <tr key={row}>
                <th scope="row">{row}</th>
                <td className={electron ? 'is-current' : ''}>{e}</td>
                <td className={electron ? '' : 'is-current'}>{t}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
