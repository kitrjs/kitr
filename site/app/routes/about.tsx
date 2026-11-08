import { createFileRoute, Link } from '@tanstack/react-router'
import mark from '#app/assets/mark.svg?url'
import { platonUrl, repoUrl } from '#app/components/chrome'
import { CreatorMark } from '#app/components/creator-marks'
import { kits, packages } from '#app/lib/catalog'
import { guidesNav } from '#app/lib/content'
import { platforms } from '#app/lib/platforms'
import { seo } from '#app/lib/seo'

export const Route = createFileRoute('/about')({
  head: () =>
    seo({
      title: 'About · kitr',
      description: 'Why kitr exists, the ideas behind it, the brand and who makes it.',
      path: '/about',
    }),
  component: About,
})

const ideas = [
  {
    title: 're-export',
    color: 'var(--brand-blue)',
    text: '@kitr/router is TanStack Router. @kitr/forms is React Hook Form. Their docs still apply, and leaving is a find-and-replace.',
  },
  {
    title: 'one data layer',
    color: 'var(--brand-green)',
    text: 'REST, your own API, server actions and live channels all load and save data the same way.',
  },
  {
    title: 'no magic',
    color: 'var(--brand-red)',
    text: 'One file lists everything your app loads. Every command runs without prompts, for people, CI and agents alike.',
  },
]

const why = [
  {
    title: 'The problem',
    text: 'A new app means choosing and wiring twenty libraries. Every project ends up with a different layout.',
  },
  {
    title: 'The answer',
    text: 'kitr chooses them once and one CLI wires them. The choices are written down in one file.',
  },
  {
    title: 'Who it is for',
    text: 'Teams, solo developers and coding agents. Anyone who wants one set of conventions across every app.',
  },
]

/** Six rows of the "built on" table in What is kitr, in plain words. */
const builtOn = [
  ['@kitr/router', 'TanStack Router', 'Every page listed in one file, sign-in checks on pages'],
  ['@kitr/query', 'TanStack Query', 'One way to load and save data from any source'],
  ['@kitr/forms', 'React Hook Form', 'Validation, and server errors next to the right field'],
  ['@kitr/state', 'Zustand', 'Stores that are safe with server rendering'],
  ['@kitr/web', 'Vite and TanStack Start', 'Static, single-page, server-rendered or installable'],
  ['@kitr/server', 'h3 and srvx', 'An API your app calls with full types'],
] as const

const guideCount = guidesNav.reduce((n, g) => n + g.items.length, 0)

function About() {
  return (
    <main className="container about">
      <section className="about-hero">
        <img src={mark} alt="The kitr mark: a tile cut by the letter K" width={240} height={240} />
        <div>
          <span className="label">About kitr</span>
          <h1 className="display">a box of parts that fit together</h1>
          <p className="lede">
            kitr is an opinionated TypeScript and React framework for apps on every platform, with
            the tools already chosen and wired. Every app remakes the same thirty decisions, and
            every coding agent remakes them again.
          </p>
        </div>
      </section>

      <section className="why" aria-labelledby="why-title">
        <h2 id="why-title">Why kitr exists</h2>
        <div className="why-grid">
          {why.map((w) => (
            <div key={w.title}>
              <h3>{w.title}</h3>
              <p className="muted">{w.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="idea-tiles">
        {ideas.map((i) => (
          <div key={i.title} className="idea-tile" style={{ background: i.color }}>
            <span className="display idea-title">{i.title}</span>
            <p>{i.text}</p>
          </div>
        ))}
      </section>

      <section className="about-built" aria-labelledby="built-title">
        <h2 id="built-title">Built on libraries you know</h2>
        <table className="built-table">
          <thead>
            <tr>
              <th scope="col">kitr piece</th>
              <th scope="col">Built on</th>
              <th scope="col">What kitr adds</th>
            </tr>
          </thead>
          <tbody>
            {builtOn.map(([piece, upstream, adds]) => (
              <tr key={piece}>
                <th scope="row">
                  <code>{piece}</code>
                </th>
                <td>{upstream}</td>
                <td className="muted">{adds}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">Their docs still apply. Leaving kitr is a find-and-replace.</p>
      </section>

      <section className="box" aria-labelledby="box-title">
        <h2 id="box-title">What's in the box</h2>
        <ul className="box-grid">
          <li>
            <Link to="/packages" className="box-stat">
              <span className="display box-number">{packages.length}</span>
              <span>packages</span>
            </Link>
          </li>
          <li>
            <Link to="/platforms" className="box-stat">
              <span className="display box-number">{platforms.length}</span>
              <span>platforms</span>
            </Link>
          </li>
          <li>
            <Link to="/docs/$slug" params={{ slug: 'kits' }} className="box-stat">
              <span className="display box-number">{kits.length}</span>
              <span>kits</span>
            </Link>
          </li>
          <li>
            <Link to="/guides" className="box-stat">
              <span className="display box-number">{guideCount}</span>
              <span>guides</span>
            </Link>
          </li>
        </ul>
      </section>

      <section className="about-row">
        <div className="maker">
          <a
            className="maker-plate"
            href={platonUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="platon.blue"
          >
            <CreatorMark name="platon" size={44} />
          </a>
          <span className="label">Made by</span>
          <h2>Platon</h2>
          <p className="muted">
            kitr is built and maintained by Platon Podkopov, a senior UI/UX developer in Guildford,
            UK. It is the decisions he remade for every new React app, written down once.
          </p>
          <div className="maker-links">
            <a href={`${platonUrl}/kitr`} target="_blank" rel="noreferrer">
              platon.blue
            </a>
            <a href="https://github.com/PodkopovP" target="_blank" rel="noreferrer">
              github.com/PodkopovP
            </a>
          </div>
        </div>
        <div className="brand">
          <h2>Brand</h2>
          <p className="muted">
            The mark is a tile cut by the letter K. Its three pieces are the brand colours.
          </p>
          <div className="swatches">
            {['#2368EE', '#208046', '#D62D2C', '#0F1B2B'].map((c) => (
              <span key={c} title={c} style={{ background: c }} />
            ))}
          </div>
          <a className="button" href="/favicon.svg" download="kitr-mark.svg">
            Download the mark
          </a>
        </div>
      </section>

      <section className="link-cards">
        <a href={`${repoUrl}/issues`} target="_blank" rel="noreferrer">
          <h3>Roadmap</h3>
          <span className="muted">What's planned next.</span>
        </a>
        <a href={`${repoUrl}/releases`} target="_blank" rel="noreferrer">
          <h3>Changelog</h3>
          <span className="muted">Every release and its tested versions.</span>
        </a>
        <Link to="/docs/$slug" params={{ slug: 'what-is-kitr' }}>
          <h3>What is kitr</h3>
          <span className="muted">The problems it solves, in plain words.</span>
        </Link>
        <Link to="/docs/$slug" params={{ slug: 'building-packages' }}>
          <h3>Contribute</h3>
          <span className="muted">Fix a doc or write a package.</span>
        </Link>
        <a href="/llms.txt">
          <h3>For agents</h3>
          <span className="muted">Every doc as plain text, for coding agents.</span>
        </a>
      </section>
    </main>
  )
}
