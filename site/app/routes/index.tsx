import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { repoUrl } from '#app/components/chrome'
import { Command } from '#app/components/command'
import { Icon } from '#app/components/icons'
import { Tile } from '#app/components/package-bits'
import { PlatformBoard, PlatformBuilder } from '#app/components/platform-bits'
import { categoryCounts, findPackage, glyph, kits, packages } from '#app/lib/catalog'
import { useSwapped } from '#app/lib/motion'
import { seo, siteUrl } from '#app/lib/seo'

/** Platon's pitch: the only description of kitr on the page. */
const pitch =
  'kitr is an opinionated TypeScript and React framework for apps on every platform, with the tools already chosen and wired. You and your coding agents spend less time deciding what to use and finding where things go, and more time building.'

const description =
  'kitr is an opinionated TypeScript and React framework for apps on every platform, with the tools already chosen and wired.'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareSourceCode',
  name: 'kitr',
  description,
  url: siteUrl,
  codeRepository: repoUrl,
  programmingLanguage: 'TypeScript',
  license: 'https://opensource.org/licenses/MIT',
}

export const Route = createFileRoute('/')({
  head: () => {
    const head = seo({
      title: 'kitr: one way to build everything',
      description,
      path: '/',
    })
    return {
      ...head,
      scripts: [{ type: 'application/ld+json', children: JSON.stringify(jsonLd) }],
    }
  },
  component: Home,
})

const terminal = [
  {
    label: 'kitr new',
    cmd: 'kitr new my-app --kit app',
    out: [
      ['ok', '✓ created my-app from the app kit'],
      ['dim', '  web · query · tailwind · theme · testing'],
      ['ok', '✓ wrote AGENTS.md'],
      ['info', '→ cd my-app && npm run dev'],
    ],
  },
  {
    label: 'kitr add',
    cmd: 'kitr add realtime',
    out: [
      ['ok', '+ @kitr/logger   (required by server)'],
      ['ok', '+ @kitr/server   (required by realtime)'],
      ['ok', '+ @kitr/realtime'],
      ['info', '~ kitrrc.ts · config/realtime.ts · AGENTS.md'],
    ],
  },
  {
    label: 'kitr doctor',
    cmd: 'kitr doctor',
    out: [
      ['ok', '✓ kitrrc.ts matches package.json'],
      ['ok', '✓ every provider resolves'],
      ['warn', '! app/routes/index.tsx imports @tanstack/react-query directly'],
      ['dim', '  use @kitr/query instead'],
    ],
  },
  {
    label: 'kitr eject',
    cmd: 'kitr eject all',
    out: [
      ['dim', 'To remove kitr, rewrite these imports:'],
      ['info', '  @kitr/router → @tanstack/react-router'],
      ['info', '  @kitr/query  → @tanstack/react-query'],
      ['dim', '  …and 10 more'],
    ],
  },
] as const

type Card = { title: string; text: string; icon: string } & (
  | { to: '/packages' | '/platforms' }
  | { slug: string }
  | { pkg: string }
)

/** What you get: each card is a problem and its answer in one sentence. */
const gets: Card[] = [
  {
    title: 'Start from a kit',
    text: `${kits.length} starting apps, packages already wired.`,
    icon: 'ui',
    slug: 'kits',
  },
  {
    title: 'Add a package with one command',
    text: 'Installs, configures and briefs your agent.',
    icon: 'package',
    to: '/packages',
  },
  {
    title: 'One home for every file',
    text: 'Each kind of file has one fixed place.',
    icon: 'files',
    slug: 'project-structure',
  },
  {
    title: 'Typed end to end',
    text: 'Server types reach your app straight from the route table.',
    icon: 'api',
    pkg: 'api',
  },
  {
    title: 'Same code on every platform',
    text: 'Web, server, desktop and mobile share one codebase.',
    icon: 'platform',
    to: '/platforms',
  },
  {
    title: 'Agents follow the same rules',
    text: 'AGENTS.md holds the rules; packages add theirs.',
    icon: 'ai',
    slug: 'agents',
  },
]

/** Three packages a newcomer reaches for first, with the benefit in a few words. */
const examples = (
  [
    ['forms', 'Validation, and server errors on the right field.'],
    ['auth', 'Sign-in, protected pages and permissions.'],
    ['realtime', 'Live updates on every open screen.'],
  ] as const
).flatMap(([name, text]) => {
  const pkg = findPackage(name)
  return pkg ? [{ pkg, text }] : []
})

/** The headings of the compare page these chips jump to (rehype-slug ids). */
const coming = [
  { name: 'Next.js', hash: 'nextjs' },
  { name: 'Expo', hash: 'expo' },
  { name: 'TanStack Start', hash: 'tanstack-start' },
  { name: 'AdonisJS', hash: 'adonisjs' },
]

/** A "What you get" card: the whole card is the link. */
function GetCard({ card }: { card: Card }) {
  const body = (
    <>
      <span className="get-icon" aria-hidden="true">
        <Icon icon={glyph(card.icon)} size={22} strokeWidth={1.7} />
      </span>
      <span className="get-text">
        <strong>{card.title}</strong>
        <span className="muted">{card.text}</span>
      </span>
    </>
  )
  if ('to' in card)
    return (
      <Link to={card.to} className="get-card">
        {body}
      </Link>
    )
  if ('pkg' in card)
    return (
      <Link to="/packages/$name" params={{ name: card.pkg }} className="get-card">
        {body}
      </Link>
    )
  return (
    <Link to="/docs/$slug" params={{ slug: card.slug }} className="get-card">
      {body}
    </Link>
  )
}

function Home() {
  const [tab, setTab] = useState(0)
  const tabSwapped = useSwapped(tab)
  const current = terminal[tab]!
  return (
    <main className="container home">
      <section className="hero">
        <div className="hero-copy">
          <h1 className="display hero-title">One way to build everything.</h1>
          <p className="lede">{pitch}</p>
          <Command cmd="kitr new my-app --kit app" />
          <div className="actions">
            <Link to="/docs/$slug" params={{ slug: 'getting-started' }} className="button primary">
              Get started
            </Link>
            <a href={repoUrl} className="button" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </div>
        </div>
        <div className="hero-platforms">
          <span className="label">Ships to</span>
          <PlatformBoard />
          <a href="#mix" className="hero-platforms-note">
            Mix them in one project ↓
          </a>
        </div>
      </section>

      <section className="gets" aria-labelledby="gets-title">
        <h2 id="gets-title" className="home-title">
          What you get
        </h2>
        <ul className="get-grid">
          {gets.map((card) => (
            <li key={card.title}>
              <GetCard card={card} />
            </li>
          ))}
        </ul>
      </section>

      <PlatformBuilder />

      <section className="home-packages" aria-labelledby="packages-title">
        <div className="section-head">
          <h2 id="packages-title" className="home-title">
            Add what you need, one command at a time.
          </h2>
          <Link to="/packages" className="home-pkgs-all">
            Browse all {packages.length} packages →
          </Link>
        </div>
        <ul className="home-cats" aria-label="Package categories">
          {categoryCounts.map((c) => (
            <li key={c.category}>
              <Link to="/packages" search={{ category: c.category }} className="home-cat">
                <span className="filter-dot" style={{ background: c.color }} />
                {c.label}
                <span className="mono home-cat-count">{c.count}</span>
              </Link>
            </li>
          ))}
        </ul>
        <ul className="home-pkgs">
          {examples.map(({ pkg, text }) => (
            <li key={pkg.name}>
              <Link to="/packages/$name" params={{ name: pkg.name }} className="home-pkg">
                <Tile pkg={pkg} size={40} />
                <span className="home-pkg-text">
                  <code className="home-pkg-cmd">kitr add {pkg.name}</code>
                  <span className="muted">{text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="terminal" aria-label="The kitr CLI">
        <div className="terminal-bar">
          <span className="example-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          {terminal.map((t, i) => (
            <button
              key={t.label}
              type="button"
              className="terminal-tab mono"
              aria-pressed={i === tab}
              onClick={() => setTab(i)}
            >
              {t.label}
            </button>
          ))}
          <span className="terminal-note mono">No prompts. Agents and CI run every command.</span>
        </div>
        <pre className={`terminal-body mono${tabSwapped ? ' swap-in' : ''}`} key={tab}>
          <span className="t-dim">~/code $</span> {current.cmd}
          {'\n'}
          {current.out.map(([tone, line]) => (
            <span key={line} className={`t-${tone}`}>
              {line}
              {'\n'}
            </span>
          ))}
        </pre>
      </section>

      <section className="coming" aria-labelledby="coming-title">
        <div>
          <h2 id="coming-title" className="home-title">
            Coming from…
          </h2>
          <p className="muted">What stays the same and what changes.</p>
        </div>
        <ul className="coming-chips">
          {coming.map((c) => (
            <li key={c.hash}>
              <Link
                to="/docs/$slug"
                params={{ slug: 'compare' }}
                hash={c.hash}
                className="coming-chip"
              >
                {c.name} <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="cta" aria-labelledby="cta-title">
        <div>
          <h2 id="cta-title" className="display">
            your first app, five minutes from now
          </h2>
          <p>Install the CLI once, pick a kit, and add the rest as you need it.</p>
        </div>
        <div className="cta-actions">
          <Command cmd="kitr new my-app --kit app" />
          <Link to="/docs/$slug" params={{ slug: 'getting-started' }} className="button cta-button">
            Read the getting started guide
          </Link>
        </div>
      </section>
    </main>
  )
}
