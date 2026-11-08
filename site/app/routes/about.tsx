import { createFileRoute, Link } from '@tanstack/react-router'
import mark from '#app/assets/mark.svg?url'
import { platonUrl, repoUrl } from '#app/components/chrome'
import { CreatorMark } from '#app/components/creator-marks'
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
    color: '#2D6CF0',
    ink: '#FFFFFF',
    text: '@kitr/router is TanStack Router. @kitr/forms is React Hook Form. Their docs still apply, and leaving is a find-and-replace.',
  },
  {
    title: 'one contract',
    color: '#1FB25A',
    ink: '#0B121C',
    text: 'REST, your own API, server actions and live channels all use the same queries and mutations.',
  },
  {
    title: 'no magic',
    color: '#EC3A3A',
    ink: '#0B121C',
    text: 'kitrrc.ts lists everything your app loads. Every command runs without prompts, for people, CI and agents alike.',
  },
]

function About() {
  return (
    <main className="container about">
      <section className="about-hero">
        <img src={mark} alt="The kitr mark: a tile cut by the letter K" width={240} height={240} />
        <div>
          <span className="label">About kitr</span>
          <h1 className="display">a box of parts that fit together</h1>
          <p className="lede">
            Every app makes the same thirty decisions: routing, data, forms, sign-in, styling,
            testing and where it ships. kitr makes them once, with libraries you already trust, and
            lets you swap out any piece.
          </p>
        </div>
      </section>

      <section className="idea-tiles">
        {ideas.map((i) => (
          <div key={i.title} className="idea-tile" style={{ background: i.color, color: i.ink }}>
            <span className="display idea-title">{i.title}</span>
            <p>{i.text}</p>
          </div>
        ))}
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
            UK. It started as the decisions remade for every new React app, written down once so the
            next app starts where the last one finished.
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
            {['#2D6CF0', '#1FB25A', '#EC3A3A', '#0F1B2B'].map((c) => (
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
          <span className="muted">What ships before 1.0.</span>
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
          <span className="muted">Every doc as plain text, ready for a coding agent.</span>
        </a>
      </section>
    </main>
  )
}
