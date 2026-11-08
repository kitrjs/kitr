import { BookOpen01Icon, File02Icon, MapsIcon } from '@hugeicons/core-free-icons'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { findPackage, packages } from '#app/lib/catalog'
import { loadSearch, type SearchEntry, search } from '#app/lib/content'
import { Icon, icons } from './icons'
import { Tile } from './package-bits'

/** Lets a package's short name ("i18n") find its overview page as well as its title does. */
const names = new Map(packages.map((p) => [`/packages/${p.name}`, p.name]))
const withNames = (index: SearchEntry[]) =>
  index.map((e) => (names.has(e.url) ? { ...e, name: names.get(e.url) } : e))

const pageKinds: Record<string, string> = { guide: 'Guide', api: 'API' }

/** What a result row shows: the package or page it belongs to, then where in it. */
function describe(r: SearchEntry) {
  const [path = ''] = r.url.split('#')
  const [, root, name, sub] = path.split('/')
  const pkg = root === 'packages' && name ? findPackage(name) : undefined
  if (pkg)
    return {
      icon: <Tile pkg={pkg} size={32} />,
      title: pkg.title,
      kind: sub ? (pageKinds[sub] ?? 'Package') : 'Package',
    }
  const glyph = root === 'guides' ? BookOpen01Icon : r.section === 'Roadmap' ? MapsIcon : File02Icon
  return {
    icon: (
      <span className="search-icon">
        <Icon icon={glyph} size={17} />
      </span>
    ),
    title: r.title,
    kind: root === 'guides' ? 'Guide' : r.section === 'Roadmap' ? 'Roadmap' : 'Docs',
  }
}

/** The ⌘K palette. The index loads on first open, so pages don't pay for it. */
export function Search() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [entries, setEntries] = useState<SearchEntry[]>([])
  const [active, setActive] = useState(0)
  const dialog = useRef<HTMLDialogElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      } else if (e.key === '/' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    dialog.current?.showModal()
    void loadSearch().then((index) => setEntries(withNames(index)))
  }, [open])

  const results = search(entries, query)
  const close = () => {
    dialog.current?.close()
    setOpen(false)
    setQuery('')
    setActive(0)
  }
  const go = (entry?: SearchEntry) => {
    if (!entry) return
    close()
    void navigate({ href: entry.url })
  }

  return (
    <>
      <button
        type="button"
        className="search-button"
        aria-label="Search docs"
        onClick={() => setOpen(true)}
      >
        <Icon icon={icons.search} size={16} />
        <span className="search-label">Search docs</span>
        <kbd className="mono">⌘K</kbd>
      </button>
      {open && (
        <dialog ref={dialog} className="search-dialog" onClose={close} aria-label="Search">
          <div className="search-input">
            <Icon icon={icons.search} size={18} />
            <input
              autoFocus
              type="search"
              placeholder="Search packages and docs"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1))
                else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
                else if (e.key === 'Enter') go(results[active])
                else return
                e.preventDefault()
              }}
              aria-controls="search-results"
            />
            <kbd className="mono">esc</kbd>
          </div>
          <ul id="search-results" className="search-results">
            {results.map((r, i) => {
              const d = describe(r)
              return (
                <li key={r.url}>
                  <a
                    href={r.url}
                    className="search-result"
                    aria-current={i === active ? 'true' : undefined}
                    onMouseEnter={() => setActive(i)}
                    onClick={(e) => {
                      e.preventDefault()
                      go(r)
                    }}
                  >
                    {d.icon}
                    <span className="search-body">
                      <span className="search-title">
                        <strong>{d.title}</strong>
                        {r.heading && <span className="search-heading">{r.heading}</span>}
                      </span>
                      <span className="search-text">{r.text.slice(0, 160)}</span>
                    </span>
                    <span className="search-kind mono">{d.kind}</span>
                  </a>
                </li>
              )
            })}
            {query && !results.length && (
              <li className="search-empty">No results for “{query}”.</li>
            )}
            {!query && (
              <li className="search-empty">Try “persist”, “forms”, “sign in” or “deploy”.</li>
            )}
          </ul>
        </dialog>
      )}
    </>
  )
}
