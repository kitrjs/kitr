import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { PackageCard, PlannedCard } from '#app/components/package-bits'
import {
  type Category,
  categories,
  type PlannedStatus,
  packages,
  planned,
  plannedStatus,
  type RunsOn,
  runsOn,
} from '#app/lib/catalog'
import { seo } from '#app/lib/seo'

export const Route = createFileRoute('/packages/')({
  head: () =>
    seo({
      title: 'Packages · kitr',
      description:
        'Every kitr package and platform: what it does for your app, where it runs, and how to add it with one command.',
      path: '/packages',
    }),
  component: Packages,
})

type RunsFilter = 'all' | RunsOn

/** A package that runs on both sides matches either filter. */
const matchesRuns = (value: RunsOn, filter: RunsFilter) =>
  filter === 'all' || value === filter || (filter !== 'both' && value === 'both')

function Packages() {
  const [category, setCategory] = useState<'all' | Category>('all')
  const [runs, setRuns] = useState<RunsFilter>('all')
  const [query, setQuery] = useState('')

  const [shown, upcoming] = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = (p: (typeof packages)[number] | (typeof planned)[number]) =>
      (category === 'all' || p.category === category) &&
      matchesRuns(p.runsOn, runs) &&
      (!q ||
        p.name.includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        categories[p.category].label.toLowerCase().includes(q) ||
        p.builtOn?.some((b) => b.toLowerCase().includes(q)))
    return [packages.filter(match), planned.filter(match)] as const
  }, [category, runs, query])

  return (
    <main className="container packages-page">
      <div className="page-head">
        <div>
          <h1>Packages</h1>
          <p className="muted">
            Pick the pieces your app needs. Each one is a single <code>kitr add</code> away, and
            every page shows what that command changes and how to use the result.
          </p>
        </div>
        <label className="filter-input">
          <span className="visually-hidden">Filter packages</span>
          <input
            type="search"
            placeholder="What do you need? e.g. login, forms"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      <div className="packages-layout">
        <aside className="filters">
          <fieldset>
            <legend className="label">Category</legend>
            <FilterButton
              active={category === 'all'}
              onClick={() => setCategory('all')}
              color="var(--line)"
              label="All packages"
              count={packages.length}
            />
            {/* Counts are shipped packages only; roadmap entries are listed below the grid. */}
            {(Object.keys(categories) as Category[])
              .filter((c) => packages.some((p) => p.category === c))
              .map((c) => (
                <FilterButton
                  key={c}
                  active={category === c}
                  onClick={() => setCategory(c)}
                  color={categories[c].color}
                  label={categories[c].label}
                  count={packages.filter((p) => p.category === c).length}
                />
              ))}
          </fieldset>
          <fieldset>
            <legend className="label">Runs on</legend>
            {(['all', 'client', 'server', 'both'] as const).map((r) => (
              <FilterButton
                key={r}
                active={runs === r}
                onClick={() => setRuns(r)}
                color={r === 'all' ? 'var(--line)' : runsOn[r].background}
                label={
                  r === 'all' ? 'Anywhere' : r === 'both' ? 'Client and server' : runsOn[r].label
                }
                count={packages.filter((p) => matchesRuns(p.runsOn, r)).length}
              />
            ))}
          </fieldset>
          <Link to="/docs/$slug" params={{ slug: 'building-packages' }} className="build-card">
            <strong>Build a package</strong>
            <span className="muted">
              Add a kitr block and a docs folder, then publish with the kitr-package keyword.
            </span>
          </Link>
        </aside>

        <div className="package-sections" aria-live="polite">
          <div className="card-grid">
            {shown.map((p) => (
              <PackageCard key={p.name} pkg={p} />
            ))}
          </div>
          {!shown.length && !upcoming.length && (
            <p className="muted">No package matches. Try another word, or clear the filters.</p>
          )}
          {(['building', 'next', 'later'] as PlannedStatus[]).map((status) => {
            const list = upcoming.filter((p) => p.status === status)
            if (!list.length) return null
            return (
              <section
                key={status}
                className="planned-section"
                aria-labelledby={`planned-${status}`}
              >
                <h2 id={`planned-${status}`}>{plannedStatus[status].heading}</h2>
                <p className="muted">{plannedStatus[status].text}</p>
                <div className="card-grid">
                  {list.map((p) => (
                    <PlannedCard key={p.name} pkg={p} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </main>
  )
}

function FilterButton(props: {
  active: boolean
  onClick: () => void
  color: string
  label: string
  count: number
}) {
  return (
    <button type="button" className="filter" aria-pressed={props.active} onClick={props.onClick}>
      <span className="filter-dot" style={{ background: props.color }} />
      <span className="filter-label">{props.label}</span>
      <span className="mono muted">{props.count}</span>
    </button>
  )
}
