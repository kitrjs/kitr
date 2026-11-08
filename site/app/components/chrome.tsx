import { Link, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { CreatorMark } from './creator-marks'
import { Icon, icons } from './icons'
import { Logo } from './logo'
import { Search } from './search'
import { ThemeToggle } from './theme-toggle'

export const repoUrl = 'https://github.com/kitrjs/kitr'
export const platonUrl = 'https://platon.blue'

const navItems: Array<{
  label: string
  to: string
  params?: Record<string, string>
  /** Paths under this prefix mark the link as the current section. */
  section: string
}> = [
  { label: 'Platforms', to: '/platforms', section: '/platforms' },
  { label: 'Packages', to: '/packages', section: '/packages' },
  { label: 'Docs', to: '/docs/$slug', params: { slug: 'getting-started' }, section: '/docs' },
  { label: 'Guides', to: '/guides', section: '/guides' },
  { label: 'About', to: '/about', section: '/about' },
]

/**
 * On phones, on a page with the docs bar, the header slides away while you scroll down and comes
 * back as soon as you scroll up, so the bar has the top of the screen to itself. Other pages keep
 * the header: their own sticky bars (the package search) sit under it.
 */
function useHideOnScroll(paused: boolean) {
  useEffect(() => {
    const root = document.documentElement
    if (paused) {
      root.classList.remove('header-hidden')
      return
    }
    const phone = window.matchMedia('(max-width: 760px)')
    let last = window.scrollY
    let frame = 0
    const update = () => {
      frame = 0
      const y = window.scrollY
      if (!phone.matches || y < 120 || !document.querySelector('.docs-bar'))
        root.classList.remove('header-hidden')
      else if (y > last + 6) root.classList.add('header-hidden')
      else if (y < last - 6) root.classList.remove('header-hidden')
      else return
      last = y
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
      root.classList.remove('header-hidden')
    }
  }, [paused])
}

export function Header() {
  const [menu, setMenu] = useState(false)
  const path = useRouterState({ select: (s) => s.location.pathname })
  // biome-ignore lint/correctness/useExhaustiveDependencies: close whenever the page changes
  useEffect(() => setMenu(false), [path])
  const header = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(false)
    }
    const onPointer = (e: PointerEvent) => {
      if (!header.current?.contains(e.target as Node)) setMenu(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [menu])
  useHideOnScroll(menu)

  return (
    <header className="site-header" ref={header}>
      <nav className="container nav" aria-label="Main">
        <Link to="/" aria-label="kitr home" className="nav-logo">
          <Logo />
        </Link>
        <div className="nav-links">
          {navItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              params={item.params}
              aria-current={path.startsWith(item.section) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="nav-spacer" />
        <Search />
        <ThemeToggle />
        <a
          href={repoUrl}
          className="icon-button github-link"
          aria-label="kitr on GitHub"
          target="_blank"
          rel="noreferrer"
        >
          <Icon icon={icons.github} />
        </a>
        <button
          type="button"
          className="icon-button nav-menu-button"
          aria-label={menu ? 'Close menu' : 'Open menu'}
          aria-expanded={menu}
          aria-controls="nav-menu"
          onClick={() => setMenu((v) => !v)}
        >
          <Icon icon={menu ? icons.close : icons.menu} />
        </button>
      </nav>
      {menu && (
        <div id="nav-menu" className="nav-menu">
          <div className="container">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                params={item.params}
                aria-current={path.startsWith(item.section) ? 'page' : undefined}
              >
                {item.label}
                <Icon icon={icons.arrow} size={18} />
              </Link>
            ))}
            <a href={repoUrl} target="_blank" rel="noreferrer">
              GitHub
              <Icon icon={icons.external} size={18} />
            </a>
          </div>
        </div>
      )}
    </header>
  )
}

const footerLinks: Array<{ title: string; links: Array<{ label: string; to: string }> }> = [
  {
    title: 'Learn',
    links: [
      { label: 'Getting started', to: '/docs/getting-started' },
      { label: 'Guides', to: '/guides' },
      { label: 'Project structure', to: '/docs/project-structure' },
      { label: 'Platforms', to: '/docs/platforms' },
      { label: 'CLI reference', to: '/docs/cli' },
    ],
  },
  {
    title: 'Build',
    links: [
      { label: 'Platforms', to: '/platforms' },
      { label: 'All packages', to: '/packages' },
      { label: 'Forms', to: '/packages/forms' },
      { label: 'Build a package', to: '/docs/building-packages' },
    ],
  },
  {
    title: 'Project',
    links: [
      { label: 'About', to: '/about' },
      { label: 'GitHub', to: repoUrl },
      { label: 'npm', to: 'https://www.npmjs.com/package/kitr' },
      { label: 'llms.txt', to: '/llms.txt' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer">
        <div className="footer-brand">
          <Link to="/" aria-label="kitr home" className="footer-logo">
            <Logo />
          </Link>
          <p className="muted">One way to build everything. MIT licensed, built with kitr.</p>
          <a className="footer-maker" href={platonUrl} target="_blank" rel="noreferrer">
            <CreatorMark name="platon" size={16} />
            Made by Platon
          </a>
        </div>
        {footerLinks.map((group) => (
          <nav key={group.title} className="footer-col" aria-label={group.title}>
            <span className="label">{group.title}</span>
            {group.links.map((l) =>
              l.to.startsWith('http') || l.to.endsWith('.txt') ? (
                <a
                  key={l.label}
                  href={l.to}
                  {...(l.to.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
                >
                  {l.label}
                </a>
              ) : (
                <Link key={l.label} to={l.to}>
                  {l.label}
                </Link>
              ),
            )}
          </nav>
        ))}
      </div>
    </footer>
  )
}
