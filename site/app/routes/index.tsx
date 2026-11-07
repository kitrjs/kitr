import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Command } from '#app/components/command'
import { Icon } from '#app/components/icons'
import homeCode from '#app/generated/home-code.json'
import { categories, findPackage, glyph, kits } from '#app/lib/catalog'
import { seo, siteUrl } from '#app/lib/seo'

const description =
  'kitr is a thin layer over TanStack, React Hook Form, Zustand, ky, h3 and Tailwind: one import surface, one data contract and one CLI, for web, server, desktop and mobile.'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareSourceCode',
  name: 'kitr',
  description,
  url: siteUrl,
  codeRepository: 'https://github.com/kitrjs/kitr',
  programmingLanguage: 'TypeScript',
  license: 'https://opensource.org/licenses/MIT',
}

export const Route = createFileRoute('/')({
  head: () => {
    const head = seo({
      title: 'kitr: the React framework where everything is an add-on',
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

const mosaic = ['query', 'api', 'forms', 'auth', 'state', 'realtime', 'table', 'theme', 'server']

const terminal = [
  {
    label: 'kitr new',
    cmd: 'kitr new my-app --kit app',
    out: [
      ['ok', '✓ created my-app from the app kit'],
      ['dim', '  router · query · http · forms · table · state · theme · auth · mocks · testing'],
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
      ['dim', '  use kitr/query instead'],
    ],
  },
  {
    label: 'kitr eject',
    cmd: 'kitr eject all',
    out: [
      ['dim', 'To remove kitr, rewrite these imports:'],
      ['info', '  kitr/router → @tanstack/react-router'],
      ['info', '  kitr/query  → @tanstack/react-query'],
      ['dim', '  …and 10 more'],
    ],
  },
] as const

const platforms = [
  {
    name: 'web',
    cmd: 'kitr add web site --mode ssr',
    text: 'Static, single-page or server-rendered, from the same app. Add a manifest and offline support with one option.',
  },
  {
    name: 'server',
    cmd: 'kitr add server api --runtime node',
    text: 'An API on Node, Bun, Deno or Cloudflare Workers, with the typed client your pages call.',
  },
  {
    name: 'desktop',
    cmd: 'kitr add desktop app --shell tauri',
    text: 'Windows, macOS and Linux. A small Tauri binary or a familiar Electron shell.',
  },
  {
    name: 'mobile',
    cmd: 'kitr add mobile phone',
    text: 'iPhone and Android through Capacitor, with storage and device APIs switched to native.',
  },
]

const ideas = [
  {
    title: 'Re-export, never re-implement',
    text: 'kitr/router is TanStack Router plus a few helpers. Upstream docs stay valid, and leaving is an import rewrite.',
  },
  {
    title: 'One data contract',
    text: 'REST APIs, your own API routes, server actions and realtime channels all produce the same queries and mutations.',
  },
  {
    title: 'Explicit wiring',
    text: 'kitrrc.ts lists every provider. Config is typed per package. Nothing is hidden.',
  },
  {
    title: 'Made for agents too',
    text: 'Every command runs from flags, and AGENTS.md stays current as you add packages.',
  },
]

function Home() {
  const [tab, setTab] = useState(0)
  const current = terminal[tab]!
  return (
    <main className="container home">
      <section className="hero">
        <div className="hero-copy">
          <span className="label">Pre-release · v0.1</span>
          <h1 className="display hero-title">The React framework where everything is an add-on.</h1>
          <p className="lede">
            kitr is a thin layer over the libraries you would pick anyway: TanStack, React Hook
            Form, Zustand, ky, h3 and Tailwind. Start small, then add sign-in, forms, an API or live
            updates with one command each.
          </p>
          <Command cmd="kitr new my-app --kit app" />
          <div className="actions">
            <Link to="/docs/$slug" params={{ slug: 'getting-started' }} className="button primary">
              Get started
            </Link>
            <Link to="/packages" className="button">
              Browse packages
            </Link>
          </div>
        </div>
        <nav className="mosaic" aria-label="Some kitr packages">
          {mosaic.map((name) => {
            const pkg = findPackage(name)
            if (!pkg) return null
            return (
              <Link
                key={name}
                to="/packages/$name"
                params={{ name }}
                className="mosaic-tile"
                style={{ background: categories[pkg.category].color }}
              >
                <Icon icon={glyph(name)} size={36} stroke="#0B121C" strokeWidth={1.6} />
                <span className="mono">{name}</span>
              </Link>
            )
          })}
        </nav>
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
          <span className="terminal-note mono">
            every command runs from flags, so agents and CI never hit a prompt
          </span>
        </div>
        <pre className="terminal-body mono">
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

      <section className="feature" aria-labelledby="contract-title">
        <div className="feature-copy">
          <span className="label">One data contract</span>
          <h2 id="contract-title">Describe your data once. Every screen keeps up.</h2>
          <p className="muted">
            A query says where data comes from. A mutation says what it changes. Your REST API, your
            own API routes, server actions and realtime channels all speak this contract, so the
            cache stays right without a single manual refetch.
          </p>
          <Link to="/packages/$name" params={{ name: 'query' }}>
            How queries work →
          </Link>
        </div>
        <div
          className="feature-code"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: highlighted at build time
          dangerouslySetInnerHTML={{ __html: homeCode.contract }}
        />
      </section>

      <section className="platforms-home" aria-labelledby="platforms-title">
        <div className="section-head">
          <div>
            <span className="label">Platforms</span>
            <h2 id="platforms-title">Write it once. Ship it everywhere.</h2>
            <p className="muted">
              One <code>app/</code> folder, named platforms in <code>kitrrc.ts</code>, and{' '}
              <code>kitr dev</code> runs them all.
            </p>
          </div>
          <Link to="/docs/$slug" params={{ slug: 'platforms' }}>
            Platforms guide →
          </Link>
        </div>
        <div className="platforms-layout">
          <div className="platform-cards">
            {platforms.map((p) => {
              const pkg = findPackage(p.name)
              return (
                <Link
                  key={p.name}
                  to="/packages/$name"
                  params={{ name: p.name }}
                  className="platform-card"
                >
                  <span
                    className="tile"
                    style={{
                      width: 48,
                      height: 48,
                      background: pkg ? categories[pkg.category].color : 'var(--line)',
                    }}
                  >
                    <Icon icon={glyph(p.name)} size={26} stroke="#0B121C" strokeWidth={1.6} />
                  </span>
                  <span className="platform-card-text">
                    <strong className="mono">{p.name}</strong>
                    <span className="muted">{p.text}</span>
                    <code className="platform-cmd">{p.cmd}</code>
                  </span>
                </Link>
              )
            })}
          </div>
          <div
            className="feature-code"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: highlighted at build time
            dangerouslySetInnerHTML={{ __html: homeCode.platforms }}
          />
        </div>
      </section>

      <section className="kits">
        <div className="section-head">
          <div>
            <h2>Start from a kit, add the rest</h2>
            <p className="muted">
              Every provider is listed in <code>kitrrc.ts</code>. Nothing is hidden.
            </p>
          </div>
          <Link to="/packages">All packages →</Link>
        </div>
        <div className="kit-grid">
          {kits.map((kit) => (
            <article key={kit.name} className="kit">
              <h3>{kit.name}</h3>
              <code className="kit-flag">--kit {kit.name}</code>
              <p>{kit.text}</p>
              <ul className="kit-chips" aria-label={`${kit.name} kit packages`}>
                {kit.packages.map((name) => {
                  const pkg = findPackage(name)
                  return pkg ? (
                    <li key={name}>
                      <Link to="/packages/$name" params={{ name }} className="kit-chip mono">
                        <span
                          className="kit-chip-dot"
                          style={{ background: categories[pkg.category].color }}
                        />
                        {name}
                      </Link>
                    </li>
                  ) : null
                })}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="ideas" aria-label="Principles">
        {ideas.map((idea) => (
          <div key={idea.title}>
            <h3>{idea.title}</h3>
            <p className="muted">{idea.text}</p>
          </div>
        ))}
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
