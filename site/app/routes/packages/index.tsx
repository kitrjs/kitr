import { Search01Icon } from '@hugeicons/core-free-icons'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '#app/components/icons'
import { DirectoryCard, PlannedCard } from '#app/components/package-bits'
import {
  type Category,
  categories,
  type PackageEntry,
  type PlannedEntry,
  packages,
  planned,
  plannedStatus,
  type RunsOn,
} from '#app/lib/catalog'
import { seo } from '#app/lib/seo'
import { upstream } from '#app/lib/upstream'

type RunsFilter = 'client' | 'server'
type Search = { q?: string; category?: Category; runs?: RunsFilter }

export const Route = createFileRoute('/packages/')({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === 'string' && s.q ? s.q : undefined,
    category:
      typeof s.category === 'string' && s.category in categories
        ? (s.category as Category)
        : undefined,
    runs: s.runs === 'client' || s.runs === 'server' ? s.runs : undefined,
  }),
  head: () =>
    seo({
      title: 'Packages · kitr',
      description:
        'Every kitr package and platform: what it does for your app, where it runs, and how to add it with one command.',
      path: '/packages',
    }),
  component: Packages,
})

type Entry = PackageEntry | PlannedEntry

/** Categories in catalog order, leaving out any with no shipped package yet. */
const categoryOrder = (Object.keys(categories) as Category[]).filter((c) =>
  packages.some((p) => p.category === c),
)

/** A package that runs on both sides matches either filter. */
const matchesRuns = (value: RunsOn, runs: RunsFilter | undefined) =>
  !runs || value === runs || value === 'both'

/** Everything a search term can hit: name, summary, category and the projects it builds on. */
const haystack = new Map<Entry, string>(
  [...packages, ...planned].map((p) => [
    p,
    [
      p.name,
      'title' in p ? p.title : '',
      p.summary,
      categories[p.category].label,
      ...(p.builtOn ?? []).flatMap((b) => [b, upstream(b).name]),
    ]
      .join(' ')
      .toLowerCase(),
  ]),
)

/** 3 for an exact name, 2 for a name prefix, 1 for a match elsewhere, 0 for no match. */
function score(p: Entry, terms: string[]) {
  if (!terms.length) return 1
  const text = haystack.get(p) ?? ''
  if (!terms.every((t) => text.includes(t))) return 0
  const q = terms.join(' ')
  return p.name === q ? 3 : p.name.startsWith(q) ? 2 : 1
}

function Packages() {
  const urlSearch = Route.useSearch()
  const navigate = Route.useNavigate()
  // The page is prerendered without filters, so the first client render matches that and the
  // filters in the URL apply right after hydration.
  const [hydrated, setHydrated] = useState(false)
  const [query, setQuery] = useState('')
  const search: Search = hydrated ? urlSearch : {}
  const { category, runs } = search
  const input = useRef<HTMLInputElement>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: read the URL once, on mount.
  useEffect(() => {
    setQuery(urlSearch.q ?? '')
    setHydrated(true)
  }, [])

  const set = (next: Search) =>
    navigate({ search: (s) => ({ ...s, ...next }), replace: true, resetScroll: false })

  // "/" jumps to the filter, the way it does on most package directories.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key !== '/' || e.metaKey || e.ctrlKey || t.closest('input, textarea, select')) return
      if (t.isContentEditable) return
      e.preventDefault()
      input.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Keep the chosen category chip in view when the chips are one scrolling row (phones).
  const chips = useRef<HTMLDivElement>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when the category changes.
  useEffect(() => {
    const list = chips.current
    const chip = list?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!list || !chip || list.scrollWidth <= list.clientWidth) return
    const left = chip.offsetLeft - list.offsetLeft - (list.clientWidth - chip.offsetWidth) / 2
    list.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  }, [category])

  const terms = useMemo(() => query.trim().toLowerCase().split(/\s+/).filter(Boolean), [query])

  const view = useMemo(() => {
    const scored = (list: Entry[]) =>
      list.map((p) => ({ p, s: score(p, terms) })).filter((x) => x.s > 0)
    const all = scored([...packages, ...planned])
    const inRuns = all.filter((x) => matchesRuns(x.p.runsOn, runs))
    const inCategory = (x: { p: Entry }) => !category || x.p.category === category
    // Facet counts: each filter counts what the others leave, so a chip never promises
    // results it cannot show. Counts are shipped packages only; roadmap entries sit below.
    const shipped = (x: { p: Entry }) => !('status' in x.p)
    const categoryCounts = new Map<Category, number>()
    for (const x of inRuns.filter(shipped))
      categoryCounts.set(x.p.category, (categoryCounts.get(x.p.category) ?? 0) + 1)
    const built = all.filter((x) => shipped(x) && inCategory(x))
    const runsCounts = {
      any: built.length,
      client: built.filter((x) => matchesRuns(x.p.runsOn, 'client')).length,
      server: built.filter((x) => matchesRuns(x.p.runsOn, 'server')).length,
    }
    const shown = inRuns.filter(inCategory)
    const ranked = [...shown].sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name))
    return {
      categoryCounts,
      runsCounts,
      total: inRuns.filter(shipped).length,
      built: ranked.filter((x) => !('status' in x.p)).map((x) => x.p as PackageEntry),
      upcoming: ranked
        .filter((x) => 'status' in x.p)
        .map((x) => x.p as PlannedEntry)
        .sort(
          (a, b) =>
            Object.keys(plannedStatus).indexOf(a.status) -
            Object.keys(plannedStatus).indexOf(b.status),
        ),
    }
  }, [terms, category, runs])

  const filtered = Boolean(terms.length || category || runs)
  const count = view.built.length
  const anything = count + view.upcoming.length
  // Browsing everything reads best by category; a search reads best as one ranked list.
  const groups: Array<{ category?: Category; list: PackageEntry[] }> = terms.length
    ? [{ list: view.built }]
    : categoryOrder
        .map((c) => ({ category: c, list: view.built.filter((p) => p.category === c) }))
        .filter((g) => g.list.length)

  const clear = () => {
    setQuery('')
    set({ q: undefined, category: undefined, runs: undefined })
    input.current?.focus()
  }

  return (
    <main className="container packages-page">
      <div className="page-head">
        <h1>Packages</h1>
        <p className="muted">
          Pick the pieces your app needs. Each one is a single <code>kitr add</code> away, and every
          page shows what that command changes and how to use the result.
        </p>
      </div>

      <div className="dir">
        <div className="dir-search">
          <label className="dir-search-box">
            <Icon icon={Search01Icon} size={18} />
            <span className="visually-hidden">Filter packages</span>
            <input
              ref={input}
              type="search"
              placeholder="Search packages: login, forms, zustand…"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                set({ q: e.target.value.trim() ? e.target.value : undefined })
              }}
              onFocus={(e) => {
                // On a phone the keyboard takes half the screen: lift the box to the top so
                // the results show in what is left.
                const box = e.currentTarget.closest('.dir-search') as HTMLElement | null
                if (!box || !window.matchMedia('(max-width: 900px)').matches) return
                const top = box.getBoundingClientRect().top + window.scrollY - 65
                if (window.scrollY < top - 4) window.scrollTo({ top, behavior: 'smooth' })
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && query) {
                  e.preventDefault()
                  setQuery('')
                  set({ q: undefined })
                }
              }}
            />
            <span className="dir-kbd" aria-hidden="true">
              /
            </span>
          </label>
        </div>

        <nav className="dir-cats" aria-label="Categories">
          <span className="label dir-cats-label">Category</span>
          <div className="dir-cats-list" ref={chips}>
            <CategoryButton
              active={!category}
              onClick={() => set({ category: undefined })}
              color="var(--line)"
              label="All"
              count={view.total}
            />
            {categoryOrder.map((c) => (
              <CategoryButton
                key={c}
                active={category === c}
                onClick={() => set({ category: category === c ? undefined : c })}
                color={categories[c].color}
                label={categories[c].label}
                count={view.categoryCounts.get(c) ?? 0}
              />
            ))}
          </div>
          <Link to="/docs/$slug" params={{ slug: 'building-packages' }} className="build-card">
            <strong>Build a package</strong>
            <span className="muted">
              Add a kitr block and a docs folder, then publish with the kitr-package keyword.
            </span>
          </Link>
        </nav>

        <div className="dir-results">
          <div className="dir-status">
            <p className="dir-count" aria-live="polite">
              <strong>{count}</strong> {count === 1 ? 'package' : 'packages'}
              {category && <> in {categories[category].label}</>}
              {terms.length > 0 && <> for “{query.trim()}”</>}
              {view.upcoming.length > 0 && <>, plus {view.upcoming.length} planned</>}
              {filtered && (
                <button type="button" className="dir-clear" onClick={clear}>
                  Clear
                </button>
              )}
            </p>
            <fieldset className="dir-runs">
              <legend className="visually-hidden">Runs on</legend>
              {(
                [
                  ['any', undefined, 'Anywhere'],
                  ['client', 'client', 'Client'],
                  ['server', 'server', 'Server'],
                ] as const
              ).map(([key, value, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={runs === value}
                  onClick={() => set({ runs: value })}
                  title={
                    value
                      ? `Packages that run on the ${value} (including ones that run on both)`
                      : 'Packages that run anywhere'
                  }
                >
                  {label}
                  <span className="mono">{view.runsCounts[key]}</span>
                </button>
              ))}
            </fieldset>
          </div>

          {anything === 0 ? (
            <div className="dir-empty">
              <p>
                No package matches{terms.length ? <> “{query.trim()}”</> : ' these filters'}
                {category && <> in {categories[category].label}</>}.
              </p>
              <p className="muted">
                Try a broader word, or{' '}
                <button type="button" className="dir-clear" onClick={clear}>
                  clear the filters
                </button>
                . Missing something? You can{' '}
                <Link to="/docs/$slug" params={{ slug: 'building-packages' }}>
                  build it as a package
                </Link>
                .
              </p>
            </div>
          ) : (
            <>
              {groups.map((g) => (
                <section
                  key={g.category ?? 'matches'}
                  className="dir-group"
                  aria-labelledby={g.category ? `cat-${g.category}` : undefined}
                  aria-label={g.category ? undefined : 'Matches'}
                >
                  {g.category && !category && (
                    <h2 className="dir-group-head" id={`cat-${g.category}`}>
                      <span
                        className="filter-dot"
                        style={{ background: categories[g.category].color }}
                      />
                      {categories[g.category].label}
                    </h2>
                  )}
                  <div className="dir-grid">
                    {g.list.map((p) => (
                      <DirectoryCard key={p.name} pkg={p} showCategory={!g.category} />
                    ))}
                  </div>
                </section>
              ))}

              {view.upcoming.length > 0 && (
                <section className="dir-group dir-planned" aria-labelledby="planned">
                  <h2 className="dir-group-head" id="planned">
                    Not built yet
                    <span className="mono muted">{view.upcoming.length}</span>
                  </h2>
                  <p className="muted dir-group-note">
                    On the roadmap. Nothing here can be installed yet, and the details may change.
                  </p>
                  <div className="dir-grid">
                    {view.upcoming.map((p) => (
                      <PlannedCard key={p.name} pkg={p} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
          {anything > 0 && (
            <Link
              to="/docs/$slug"
              params={{ slug: 'building-packages' }}
              className="build-card dir-build"
            >
              <strong>Build a package</strong>
              <span className="muted">
                Add a kitr block and a docs folder, then publish with the kitr-package keyword.
              </span>
            </Link>
          )}
        </div>
      </div>
    </main>
  )
}

function CategoryButton(props: {
  active: boolean
  onClick: () => void
  color: string
  label: string
  count: number
}) {
  return (
    <button
      type="button"
      className="filter"
      aria-pressed={props.active}
      disabled={!props.active && props.count === 0}
      onClick={props.onClick}
    >
      <span className="filter-dot" style={{ background: props.color }} />
      <span className="filter-label">{props.label}</span>
      <span className="mono filter-count">{props.count}</span>
    </button>
  )
}
