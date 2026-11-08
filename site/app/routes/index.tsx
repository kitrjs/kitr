import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Command } from '#app/components/command'
import { PlatformBoard, PlatformBuilder } from '#app/components/platform-bits'
import homeCode from '#app/generated/home-code.json'
import { categories, findPackage, kits } from '#app/lib/catalog'
import { seo, siteUrl } from '#app/lib/seo'

const description =
  'kitr is the opinionated TypeScript framework for web, mobile, desktop and backend apps. One language, one CLI, one set of conventions, on every platform.'

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
      [
        'dim',
        '  web · http · forms · table · state · tailwind · theme · auth · storage · mocks · testing · devtools',
      ],
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

const ideas = [
  {
    title: 'Re-export, never re-implement',
    text: 'kitr/router is TanStack Router with a few helpers. Their docs still apply, and leaving kitr is a find-and-replace of imports.',
  },
  {
    title: 'One data contract',
    text: 'A query says where data comes from. A mutation says what it changes. REST calls, your own API routes and live channels all use the same pair.',
  },
  {
    title: 'No magic',
    text: 'One file, kitrrc.ts, lists everything your app loads. Nothing is discovered behind your back.',
  },
  {
    title: 'Made for agents too',
    text: 'Every command runs from flags, and AGENTS.md stays current as you add packages.',
  },
]

const familiar = [
  {
    name: 'Next.js',
    text: 'You keep React and server rendering, through TanStack Start. Pages are declared on one route table in app/routes.ts instead of folders, and data goes through TanStack Query.',
  },
  {
    name: 'Expo',
    text: 'You keep React and one codebase for several targets. Mobile is a Capacitor WebView shell, not React Native, and it is still a preview, so native views are not part of kitr.',
  },
  {
    name: 'TanStack Start',
    text: 'You keep the same Start and Router underneath. kitr adds the packages for forms, auth, state and a typed server, plus a CLI that wires them.',
  },
  {
    name: 'AdonisJS',
    text: 'You keep controllers and providers that register, boot, ready and shut down, listed in kitrrc.ts. The server is h3, and the API client is typed with no codegen.',
  },
]

function Home() {
  const [tab, setTab] = useState(0)
  const current = terminal[tab]!
  return (
    <main className="container home">
      <section className="hero">
        <div className="hero-copy">
          <span className="label">v0.1 pre-release</span>
          <h1 className="display hero-title">One way to build everything.</h1>
          <p className="lede">
            kitr gives you a React app with routing, data loading, forms, sign-in and a typed API
            server already wired together, from one CLI. The same code ships to the web and a server
            today, and to desktop and phones in preview.
          </p>
          <p className="hero-sub muted">
            It is a thin layer over TanStack Router, Query and Start, React Hook Form, Zustand, ky,
            h3 and Tailwind. Start small, then add each feature with one command.
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
          <p className="status-strip">
            <strong>v0.1 pre-release.</strong> Web and server work today; desktop and mobile are
            previews. Not on npm yet:{' '}
            <Link to="/docs/$slug" params={{ slug: 'getting-started' }}>
              here is how to try it today
            </Link>
            .
          </p>
        </div>
        <div className="hero-platforms">
          <span className="label">Ships to</span>
          <PlatformBoard />
          <a href="#mix" className="hero-platforms-note">
            Use one, or all of them in one project →
          </a>
        </div>
      </section>

      <PlatformBuilder />

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

      <section className="familiar" aria-labelledby="familiar-title">
        <div className="section-head">
          <div>
            <h2 id="familiar-title">If you know…</h2>
            <p className="muted">What stays the same, and what changes with kitr.</p>
          </div>
        </div>
        <div className="familiar-grid">
          {familiar.map((f) => (
            <article key={f.name} className="familiar-card">
              <h3>{f.name}</h3>
              <p className="muted">{f.text}</p>
              <Link to="/docs/$slug" params={{ slug: 'compare' }}>
                Compare in detail →
              </Link>
            </article>
          ))}
        </div>
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

      <section className="kits">
        <div className="section-head">
          <div>
            <h2>Start from a kit, add the rest</h2>
            <p className="muted">
              A kit is a starting set of packages and files. Pick the closest one and add or remove
              packages later.
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
              {kit.platforms.length > 0 && (
                <p className="kit-platforms mono">{kit.platforms.join(' · ')}</p>
              )}
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
