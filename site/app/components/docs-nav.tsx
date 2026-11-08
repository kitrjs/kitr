import { useNavigate, useRouterState } from '@tanstack/react-router'
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'
import type { Page } from '#app/lib/content'
import { closeThenFollow, exit, usePresence } from '#app/lib/motion'
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
 * sticky bar whose button opens the same navigation full-screen; the page's sections are listed
 * under the current page in there, so the bar needs no menu of its own for them.
 */
export function Sidebar({
  label,
  where,
  active,
  children,
}: {
  /** What the navigation is, for screen readers and the drawer's heading. */
  label: string
  /** The page you are on, shown in the phone bar. */
  where: ReactNode
  /** The heading being read, from useActiveHeading. */
  active?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const drawer = usePresence(open, exit.drawer)
  const nav = useRef<HTMLElement>(null)
  const path = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()

  // biome-ignore lint/correctness/useExhaustiveDependencies: close whenever the page changes
  useEffect(() => setOpen(false), [path])

  const menuButton = useRef<HTMLButtonElement>(null)
  // Closing from the keyboard or the close button hands focus back to the button that opened it;
  // otherwise it would drop to <body> when the drawer unmounts. Following a link closes it too,
  // without moving focus, because the page is about to change.
  const closeDrawer = () => {
    setOpen(false)
    menuButton.current?.focus({ preventScroll: true })
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: closeDrawer only touches state setters and refs
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer()
    }
    document.addEventListener('keydown', onKey)
    nav.current?.querySelector<HTMLElement>('[aria-current="page"], a')?.focus({
      preventScroll: true,
    })
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // The scroll lock holds until the drawer has finished sliding out.
  const locked = drawer.mounted
  useEffect(() => {
    if (!locked) return
    document.documentElement.classList.add('drawer-open')
    return () => document.documentElement.classList.remove('drawer-open')
  }, [locked])

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
      <div className="docs-bar">
        <button
          type="button"
          ref={menuButton}
          className="docs-bar-menu"
          aria-expanded={open}
          aria-controls="docs-sidebar"
          aria-label={`${label} navigation`}
          onClick={() => setOpen(true)}
        >
          <Icon icon={icons.menu} size={18} />
          <span className="docs-bar-where">{where}</span>
        </button>
      </div>
      <nav
        id="docs-sidebar"
        ref={nav}
        className={`sidebar${open ? ' is-open' : drawer.closing ? ' is-closing' : ''}`}
        // Each section's sidebar has its own transition name: between two docs pages it stays put,
        // between the docs and a guide it leaves and arrives with the page instead of overlapping.
        style={
          {
            '--sidebar-vt': `sidebar-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          } as CSSProperties
        }
        aria-label={label}
        // On phones the drawer slides away before the page changes under it.
        onClickCapture={
          drawer.mounted
            ? closeThenFollow(
                () => setOpen(false),
                exit.drawer,
                (href) => navigate({ href }),
              )
            : undefined
        }
      >
        <div className="drawer-head">
          <span className="label">{label}</span>
          <button
            type="button"
            className="icon-button"
            aria-label="Close navigation"
            onClick={closeDrawer}
          >
            <Icon icon={icons.close} size={18} />
          </button>
        </div>
        {children}
      </nav>
    </>
  )
}
