import { Link } from '@kitr/router'
import { nav } from '#kitr/content'

/** The docs home: every group from content/docs/nav.json, each page with its description. */
export default function DocsIndexPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Docs</h1>
      <p className="mt-2 text-lg text-muted-foreground">
        Everything about Docs, from the first run to the last option.
      </p>
      {nav.docs.map((group) => (
        <section key={group.title} className="mt-10">
          <h2 className="text-lg font-semibold">{group.title}</h2>
          {group.description && <p className="text-sm text-muted-foreground">{group.description}</p>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {group.items.map((item) => (
              <Link
                key={item.slug}
                to="/docs/$slug"
                params={{ slug: item.slug }}
                className="flex flex-col gap-1 rounded-lg border border-border p-4 hover:border-primary"
              >
                <span className="font-medium">{item.title}</span>
                {item.description && (
                  <span className="text-sm text-muted-foreground">{item.description}</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
