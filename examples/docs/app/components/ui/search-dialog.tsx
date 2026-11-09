import { Search01Icon } from '@hugeicons/core-free-icons'
import { type SearchEntry, search } from '@kitr/content'
import { useNavigate } from '@kitr/router'
import { cn } from '@kitr/tailwind'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '#components/ui/icon'

export interface SearchDialogProps {
  /** Loads the index on first open: `loadSearch` from `#kitr/content`. */
  load: () => Promise<SearchEntry[]>
  placeholder?: string
  className?: string
}

/**
 * A search button and its Cmd/Ctrl+K dialog over the docs. The index loads on first open, so
 * pages don't pay for it. Arrow keys move through the results, Enter opens one, Escape closes.
 */
export function SearchDialog({ load, placeholder = 'Search docs', className }: SearchDialogProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [entries, setEntries] = useState<SearchEntry[]>([])
  const [active, setActive] = useState(0)
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const show = useCallback(() => setOpen(true), [])
  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setActive(0)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        show()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [show])

  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (open && !el.open) {
      el.showModal()
      input.current?.focus()
      void load().then(setEntries)
    }
    if (!open && el.open) el.close()
  }, [open, load])

  const results = search(entries, query)
  const go = (entry: SearchEntry | undefined) => {
    if (!entry) return
    close()
    void navigate({ href: entry.url })
  }

  return (
    <>
      <button
        type="button"
        aria-label={placeholder}
        onClick={show}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-muted-foreground hover:bg-muted',
          className,
        )}
      >
        <Icon icon={Search01Icon} size={16} />
        <span className="hidden sm:inline">{placeholder}</span>
        <kbd className="hidden rounded border border-border px-1.5 font-mono text-xs sm:inline">
          ⌘K
        </kbd>
      </button>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: a backdrop click is a mouse shortcut; Escape closes it from the keyboard */}
      <dialog
        ref={dialog}
        aria-label="Search"
        onClose={close}
        onClick={(e) => {
          if (e.target === dialog.current) close()
        }}
        className="mx-auto mt-[12vh] w-[min(40rem,calc(100vw-2rem))] rounded-lg border border-border bg-background p-0 text-foreground shadow-md backdrop:bg-black/50"
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Icon icon={Search01Icon} size={18} className="text-muted-foreground" />
          <input
            ref={input}
            type="search"
            aria-label={placeholder}
            value={query}
            placeholder={placeholder}
            aria-controls="search-results"
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
            className="h-12 flex-1 bg-transparent text-base outline-none"
          />
        </div>
        <ul id="search-results" className="max-h-[60vh] overflow-y-auto p-2">
          {results.map((r, i) => (
            <li key={r.url}>
              <a
                href={r.url}
                aria-current={i === active ? 'true' : undefined}
                onMouseEnter={() => setActive(i)}
                onClick={(e) => {
                  e.preventDefault()
                  go(r)
                }}
                className="block rounded-md px-3 py-2 aria-[current=true]:bg-muted"
              >
                <span className="flex items-baseline gap-2">
                  <strong className="font-medium">{r.title}</strong>
                  {r.heading && (
                    <span className="text-sm text-muted-foreground">› {r.heading}</span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">{r.section}</span>
                </span>
                <span className="line-clamp-2 text-sm text-muted-foreground">
                  {r.text.slice(0, 160)}
                </span>
              </a>
            </li>
          ))}
          {query && !results.length && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              No results for “{query}”.
            </li>
          )}
          {!query && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              Type to search every page.
            </li>
          )}
        </ul>
      </dialog>
    </>
  )
}
