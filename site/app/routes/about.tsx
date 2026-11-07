import { createFileRoute, Link } from '@tanstack/react-router'
import mark from '#app/assets/mark.svg?url'
import { repoUrl } from '#app/components/chrome'
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
    text: 'kitr/router is TanStack Router. kitr/forms is React Hook Form. Upstream docs still apply, and leaving is an import rewrite.',
  },
  {
    title: 'one contract',
    color: '#1FB25A',
    ink: '#0B121C',
    text: 'REST APIs, API routes, server actions and realtime channels all speak queries, mutations and subscriptions, with cache effects declared once.',
  },
  {
    title: 'no magic',
    color: '#EC3A3A',
    ink: '#0B121C',
    text: 'kitrrc.ts lists every provider. Every command runs from flags, so people, CI and coding agents drive it the same way.',
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
            Every app ends up making the same thirty decisions: routing, data loading, forms, auth,
            styling, testing, and how to ship to the web, phones, desktops and servers. kitr makes
            them once, out loud, with libraries you already trust, and lets you lift any piece out.
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
          <span className="label">Made by</span>
          <h2>Platon</h2>
          <p className="muted">
            kitr is built and maintained by Platon. It started as the set of decisions that kept
            being remade for every new React app, written down once so the next app could start
            where the last one finished.
          </p>
          <a href="https://github.com/PodkopovP" target="_blank" rel="noreferrer">
            github.com/PodkopovP
          </a>
        </div>
        <div className="brand">
          <h2>Brand</h2>
          <p className="muted">
            The mark is a tile cut by the letter K. Its three pieces are the brand colours. Packages
            use their own category colours, so the brand stays recognisable as the catalogue grows.
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
