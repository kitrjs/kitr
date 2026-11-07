import { createFileRoute, Link } from '@tanstack/react-router'
import { GuideCard } from '#app/components/guide-bits'
import { guidesNav } from '#app/lib/content'
import { seo } from '#app/lib/seo'

export const Route = createFileRoute('/guides/')({
  head: () =>
    seo({
      title: 'Guides · kitr',
      description:
        'Step-by-step walkthroughs: build an app, ship it to phones and desktops, deploy it, and move to kitr.',
      path: '/guides',
    }),
  component: Guides,
})

function Guides() {
  return (
    <main className="container guides-page">
      <div className="page-head">
        <div>
          <h1>Guides</h1>
          <p className="muted">
            Each guide builds one thing from an empty folder to a running app, across as many
            packages as it takes. For one package in depth, open its page under{' '}
            <Link to="/packages">Packages</Link>.
          </p>
        </div>
      </div>
      {guidesNav.map((group) => (
        <section key={group.title} className="guide-group" aria-labelledby={slugify(group.title)}>
          <h2 id={slugify(group.title)}>{group.title}</h2>
          {group.description && <p className="muted">{group.description}</p>}
          <div className="guide-grid">
            {group.items.map((guide) => (
              <GuideCard key={guide.slug} guide={guide} />
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')
