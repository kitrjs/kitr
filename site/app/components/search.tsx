import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { loadSearch, type SearchEntry, search } from '#app/lib/content'
import { Icon, icons } from './icons'

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
    void loadSearch().then(setEntries)
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
      <button type="button" className="search-button" onClick={() => setOpen(true)}>
        <Icon d={icons.search} size={16} />
        <span className="search-label">Search docs</span>
        <kbd className="mono">⌘K</kbd>
      </button>
      {open && (
        <dialog ref={dialog} className="search-dialog" onClose={close} aria-label="Search">
          <div className="search-input">
            <Icon d={icons.search} size={18} />
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
            {results.map((r, i) => (
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
                  <span className="label">{r.section}</span>
                  <span className="search-title">
                    {r.title}
                    {r.heading && <span className="search-heading"> › {r.heading}</span>}
                  </span>
                  <span className="search-text">{r.text.slice(0, 140)}</span>
                </a>
              </li>
            ))}
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
