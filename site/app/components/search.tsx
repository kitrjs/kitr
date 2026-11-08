import { BookOpen01Icon, File02Icon, MapsIcon } from '@hugeicons/core-free-icons'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { findPackage, packages } from '#app/lib/catalog'
import { loadSearch, type SearchEntry, search } from '#app/lib/content'
import { exit, usePresence } from '#app/lib/motion'
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
  const button = useRef<HTMLButtonElement>(null)
  // Unmounting a modal dialog drops focus to <body>, so remember where it was to put it back.
  const returnTo = useRef<Element | null>(null)
  const presence = usePresence(open, exit.popover)
  const navigate = useNavigate()

  const show = useCallback(() => {
    // Reopened while it fades out: focus is inside the dialog, so keep the original target.
    if (!dialog.current) returnTo.current = document.activeElement
    setOpen(true)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        show()
      } else if (e.key === '/' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault()
        show()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [show])

  useEffect(() => {
    if (!open) return
    const el = dialog.current
    if (el && !el.open) el.showModal()
    void loadSearch().then((index) => setEntries(withNames(index)))
  }, [open])

  // Once the exit has played and the dialog is gone, hand focus back.
  const mounted = presence.mounted
  const wasMounted = useRef(false)
  useEffect(() => {
    if (mounted) {
      wasMounted.current = true
      const el = dialog.current
      return () => {
        try {
          if (el?.open) el.close()
        } catch {}
      }
    }
    if (!wasMounted.current) return
    wasMounted.current = false
    setQuery('')
    setActive(0)
    const target = returnTo.current
    const back =
      target instanceof HTMLElement && target.isConnected && target !== document.body
        ? target
        : button.current
    back?.focus({ preventScroll: true })
    returnTo.current = null
  }, [mounted])

  const results = search(entries, query)
  // The dialog stays open (and modal) while it fades out and unmounts when the exit is done. The
  // query is cleared then too, so the results don't collapse to the empty state mid-fade.
  const close = () => setOpen(false)
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
        ref={button}
        onClick={show}
      >
        <Icon icon={icons.search} size={16} />
        <span className="search-label">Search docs</span>
        <kbd className="mono">⌘K</kbd>
      </button>
      {presence.mounted && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: a backdrop click is a mouse shortcut; Escape closes it from the keyboard
        <dialog
          ref={dialog}
          className="search-dialog"
          data-closing={presence.closing || undefined}
          onClose={close}
          onCancel={(e) => {
            // Escape: run our own close so it animates too.
            e.preventDefault()
            close()
          }}
          onClick={(e) => {
            if (e.target === dialog.current) close()
          }}
          aria-label="Search"
        >
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
            <button
              type="button"
              className="search-close mono"
              onClick={close}
              aria-label="Close search"
            >
              esc
            </button>
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
