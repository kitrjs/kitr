import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Command } from '#app/components/command'
import { Icon } from '#app/components/icons'
import { PlatformBoard, PlatformBuilder } from '#app/components/platform-bits'
import homeCode from '#app/generated/home-code.json'
import { glyph, kits } from '#app/lib/catalog'
import { useSwapped } from '#app/lib/motion'
import { findPlatform } from '#app/lib/platforms'
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

const ideas = [
  {
    title: 'Re-export, never re-implement',
    text: '@kitr/router is TanStack Router. Their docs still apply, and leaving kitr is a find-and-replace.',
  },
  {
    title: 'No magic',
    text: 'One file, kitrrc.ts, lists everything your app loads. Nothing happens behind your back.',
  },
  {
    title: 'Typed end to end',
    text: 'The API client takes its types from your server routes. No codegen step, no schema to keep in sync.',
  },
]

/** One plain line per kit for the home page; the kit's own text is the fallback. */
const kitBlurb: Record<string, string> = {
  blank: 'Only the wiring. Add what you need.',
  app: 'A signed-in web app that talks to your API.',
  fullstack: 'The app kit plus your own API server.',
  server: 'An API server on its own, no React.',
  saas: 'A product with sign-in, a dashboard and its own API.',
  site: 'A marketing site with a blog, SEO and translations.',
  realtime: 'A live chat over WebSockets.',
  desktop: 'The app kit as an Electron desktop app.',
  tauri: 'The app kit as a Tauri desktop app.',
  mobile: 'The app kit as an installable phone app.',
}

const agentPoints = [
  {
    title: 'One home for every file',
    text: 'The conventions are fixed and written down. kitr make writes each kind of file where it belongs.',
  },
  {
    title: 'AGENTS.md stays current',
    text: 'kitr new writes it. Every kitr add appends the rules for that package, and kitr remove takes them out.',
  },
  {
    title: 'One-line plugin install',
    text: 'Skills for Claude Code, Cursor, Codex and Copilot that know the CLI and run kitr doctor when they finish.',
  },
]

const familiar = [
  {
    name: 'Next.js',
    text: 'Same React and server rendering. Routes live in one file instead of folders, and data goes through TanStack Query.',
  },
  {
    name: 'Expo',
    text: 'Same React, one codebase for every target. Mobile is a web view in a Capacitor shell, not React Native.',
  },
  {
    name: 'TanStack Start',
    text: 'Same Start and Router underneath. kitr adds forms, auth, state, a typed server and a CLI that wires them.',
  },
  {
    name: 'AdonisJS',
    text: 'Same controllers and providers. The server is h3, and the API client is typed with no codegen.',
  },
]

function Home() {
  const [tab, setTab] = useState(0)
  const tabSwapped = useSwapped(tab)
  const current = terminal[tab]!
  return (
    <main className="container home">
      <section className="hero">
        <div className="hero-copy">
          <span className="label">v0.1 pre-release</span>
          <h1 className="display hero-title">One way to build everything.</h1>
          <p className="lede">
            A React app with routing, data, forms, sign-in and a typed API, wired together by one
            CLI. Write it once, ship it to the web, a server, desktop and phones.
          </p>
          <p className="hero-sub muted">
            Built on TanStack, React Hook Form, Zustand, h3 and Tailwind. Add each feature with one
            command.
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
            Web, server, desktop and mobile are ready. Not on npm yet,{' '}
            <Link to="/docs/$slug" params={{ slug: 'getting-started' }}>
              here is how to try it
            </Link>
            .
          </p>
        </div>
        <div className="hero-platforms">
          <span className="label">Ships to</span>
          <PlatformBoard />
          <a href="#mix" className="hero-platforms-note">
            Use one, or all of them in one project ↓
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
            no prompts, so agents and CI can run every command
          </span>
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
            A query says where data comes from. A mutation says what it changes. REST, your own API,
            server actions and live channels all use this pair, so every screen stays in sync with
            no manual refetching.
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

      <section className="agents" aria-labelledby="agents-title">
        <div className="section-head">
          <div>
            <h2 id="agents-title">Built for agents</h2>
            <p className="muted">
              Less time choosing, more time coding. The same clarity keeps coding agents on track.
            </p>
          </div>
          <Link to="/docs/$slug" params={{ slug: 'agents' }}>
            Working with agents →
          </Link>
        </div>
        <ul className="agents-list">
          {agentPoints.map((point) => (
            <li key={point.title}>
              <h3>{point.title}</h3>
              <p className="muted">{point.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="kits" aria-labelledby="kits-title">
        <div className="section-head">
          <div>
            <h2 id="kits-title">Start from a kit</h2>
            <p className="muted">A kit is a starting set of packages. Add or remove any later.</p>
          </div>
          <Link to="/docs/$slug" params={{ slug: 'kits' }}>
            How kits work →
          </Link>
        </div>
        <ul className="kit-list">
          {kits.map((kit) => {
            const types = [...new Set(kit.platforms.map((p) => p.split(':')[1]?.trim() ?? p))]
            return (
              <li key={kit.name} className="kit-row">
                <span className="kit-row-icons" aria-hidden="true">
                  {types.length ? (
                    types.map((t) => (
                      <span
                        key={t}
                        className="kit-row-icon"
                        style={{ background: findPlatform(t)?.color }}
                      >
                        <Icon icon={glyph(t)} size={14} stroke="#0B121C" strokeWidth={1.8} />
                      </span>
                    ))
                  ) : (
                    <span className="kit-row-icon kit-row-icon-blank" />
                  )}
                </span>
                <span className="kit-row-text">
                  <code className="kit-row-name">--kit {kit.name}</code>
                  <span className="muted">{kitBlurb[kit.name] ?? kit.text}</span>
                </span>
                <span className="kit-row-count mono">
                  {kit.packages.length
                    ? `${kit.packages.length} package${kit.packages.length === 1 ? '' : 's'}`
                    : 'no packages'}
                </span>
              </li>
            )
          })}
        </ul>
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
