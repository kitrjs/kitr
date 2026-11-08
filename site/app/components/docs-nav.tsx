import { useRouterState } from '@tanstack/react-router'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import type { Page } from '#app/lib/content'
import { Icon, icons } from './icons'

type TocEntry = Page['toc'][number]

/** The id of the heading the reader is in: the last one whose top has scrolled past the header, if any. */
export function useActiveHeading(toc: TocEntry[]): string | undefined {
  const [active, setActive] = useState<string | undefined>()
  useEffect(() => {
    if (!toc.length) return
    let frame = 0
    const update = () => {
      frame = 0
      let current: string | undefined
      for (const t of toc) {
        const el = document.getElementById(t.id)
        if (el && el.getBoundingClientRect().top < 140) current = t.id
        else if (el) break
      }
      // At the very bottom the last short sections can never reach the top; mark the last one.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2)
        current = toc.at(-1)?.id
      setActive(current)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('hashchange', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('hashchange', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [toc])
  return active
}

/** The h2 a heading belongs to: itself for an h2, the h2 above it for an h3. */
export function sectionOf(toc: TocEntry[], id: string | undefined): TocEntry | undefined {
  const index = toc.findIndex((t) => t.id === id)
  for (let i = index; i >= 0; i--) if (toc[i]?.depth === 2) return toc[i]
  return undefined
}

/**
 * A page's sections as a list of links: every h2, plus the h3s of the section being read,
 * so a long guide reads as a short outline that opens where you are.
 */
export function SectionList({
  toc,
  active,
  className = '',
}: {
  toc: TocEntry[]
  active: string | undefined
  className?: string
}) {
  if (!toc.length) return null
  const open = sectionOf(toc, active)?.id
  const groups: Array<{ h2: TocEntry; h3: TocEntry[] }> = []
  for (const t of toc) {
    if (t.depth === 2) groups.push({ h2: t, h3: [] })
    else groups.at(-1)?.h3.push(t)
  }
  return (
    <ul className={`sidebar-sections ${className}`}>
      {groups.map(({ h2, h3 }) => (
        <li key={h2.id}>
          <a href={`#${h2.id}`} aria-current={h2.id === open ? 'location' : undefined}>
            {h2.text}
          </a>
          {h2.id === open && h3.length > 0 && (
            <ul>
              {h3.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} aria-current={t.id === active ? 'location' : undefined}>
                    {t.text}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}

/**
 * The left-hand navigation. On wide screens it is a sticky column. On phones it collapses into a
 * sticky bar: the left button opens the same navigation full-screen, the right one names the
 * section being read and drops down the page's sections to jump to.
 */
export function Sidebar({
  label,
  where,
  toc = [],
  active,
  children,
}: {
  /** What the navigation is, for screen readers and the drawer's heading. */
  label: string
  /** The page you are on, shown in the phone bar. */
  where: ReactNode
  /** The page's headings: the phone bar's "On this page" menu lists them. */
  toc?: TocEntry[]
  /** The heading being read, from useActiveHeading. */
  active?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [sections, setSections] = useState(false)
  const nav = useRef<HTMLElement>(null)
  const path = useRouterState({ select: (s) => s.location.pathname })
  const section = sectionOf(toc, active)?.text

  // biome-ignore lint/correctness/useExhaustiveDependencies: close whenever the page changes
  useEffect(() => {
    setOpen(false)
    setSections(false)
  }, [path])

  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!sections) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSections(false)
    }
    const onPointer = (e: PointerEvent) => {
      if (!bar.current?.contains(e.target as Node)) setSections(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    // Open the list at the section being read.
    const list = document.getElementById('docs-sections')
    const current = list?.querySelector<HTMLElement>('[aria-current="location"]')
    if (list && current) list.scrollTop = current.offsetTop - list.clientHeight / 3
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [sections])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.documentElement.classList.add('drawer-open')
    nav.current?.querySelector<HTMLElement>('[aria-current="page"], a')?.focus({
      preventScroll: true,
    })
    return () => {
      document.removeEventListener('keydown', onKey)
      document.documentElement.classList.remove('drawer-open')
    }
  }, [open])

  // Keep the link for the section being read inside the sidebar's own scroll area.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when the reader moves
  useEffect(() => {
    const box = nav.current
    if (!box) return
    const current =
      box.querySelector<HTMLElement>('.sidebar-sections ul [aria-current="location"]') ??
      box.querySelector<HTMLElement>('[aria-current="location"]') ??
      box.querySelector<HTMLElement>('[aria-current="page"]')
    if (!current || box.scrollHeight <= box.clientHeight) return
    const top = current.offsetTop - box.offsetTop
    if (top < box.scrollTop + 40 || top > box.scrollTop + box.clientHeight - 80)
      box.scrollTop = top - box.clientHeight / 3
  }, [active, open])

  return (
    <>
      <div className="docs-bar" ref={bar}>
        <div className="docs-bar-row">
          <button
            type="button"
            className="docs-bar-menu"
            aria-expanded={open}
            aria-controls="docs-sidebar"
            aria-label={`${label} navigation`}
            onClick={() => {
              setSections(false)
              setOpen(true)
            }}
          >
            <Icon icon={icons.menu} size={18} />
            <span className="docs-bar-where">{where}</span>
          </button>
          {toc.length > 0 && (
            <button
              type="button"
              className="docs-bar-toc"
              aria-expanded={sections}
              aria-controls="docs-sections"
              onClick={() => setSections((v) => !v)}
            >
              <span className="docs-bar-section">{section ?? 'On this page'}</span>
              <Icon icon={icons.chevronDown} size={16} className="docs-bar-chevron" />
            </button>
          )}
        </div>
        {sections && (
          <>
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: closes the menu after a link inside it is followed; links handle their own keys */}
            <nav
              id="docs-sections"
              className="docs-sections"
              aria-label="On this page"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('a')) setSections(false)
              }}
            >
              <span className="label">On this page</span>
              <SectionList toc={toc} active={active} />
            </nav>
          </>
        )}
      </div>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: closes the drawer after a link inside it is followed; links handle their own keys */}
      <nav
        id="docs-sidebar"
        ref={nav}
        className={`sidebar${open ? ' is-open' : ''}`}
        aria-label={label}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a')) setOpen(false)
        }}
      >
        <div className="drawer-head">
          <span className="label">{label}</span>
          <button
            type="button"
            className="icon-button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <Icon icon={icons.close} size={18} />
          </button>
        </div>
        {children}
      </nav>
    </>
  )
}
