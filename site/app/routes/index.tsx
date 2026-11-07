import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Command } from '#app/components/command'
import { Icon } from '#app/components/icons'
import { categories, findPackage, glyph, kits } from '#app/lib/catalog'

export const Route = createFileRoute('/')({ component: Home })

const mosaic = ['query', 'api', 'forms', 'auth', 'state', 'socket', 'table', 'ui', 'server']

const terminal = [
  {
    label: 'kitr new',
    cmd: 'kitr new my-app --kit app',
    out: [
      ['ok', '✓ created my-app from the app kit'],
      ['dim', '  router · query · http · forms · table · state · ui · auth · mocks · testing'],
      ['ok', '✓ wrote AGENTS.md'],
      ['info', '→ cd my-app && npm run dev'],
    ],
  },
  {
    label: 'kitr add',
    cmd: 'kitr add socket',
    out: [
      ['ok', '+ @kitr/logger   (required by server)'],
      ['ok', '+ @kitr/server   (required by socket)'],
      ['ok', '+ @kitr/socket'],
      ['info', '~ kitrrc.ts · config/socket.ts · AGENTS.md'],
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

const ideas = [
  {
    title: 'Re-export, never re-implement',
    text: 'kitr/router is TanStack Router plus a few helpers. Upstream docs stay valid, and leaving is an import rewrite.',
  },
  {
    title: 'One data contract',
    text: 'REST APIs, your API routes, server actions and sockets all produce the same queries and mutations.',
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
              <div className="kit-head">
                <h3>{kit.name}</h3>
                <span className="mono muted">--kit {kit.name}</span>
              </div>
              <p>{kit.text}</p>
              <div
                className="kit-dots"
                role="img"
                aria-label={`Includes ${kit.packages.join(', ')}`}
              >
                {kit.packages.map((name) => {
                  const pkg = findPackage(name)
                  return pkg ? (
                    <span
                      key={name}
                      title={name}
                      style={{ background: categories[pkg.category].color }}
                    />
                  ) : null
                })}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="ideas">
        {ideas.map((idea) => (
          <div key={idea.title}>
            <h3>{idea.title}</h3>
            <p className="muted">{idea.text}</p>
          </div>
        ))}
      </section>
    </main>
  )
}
