import { Link } from '@tanstack/react-router'
import { Icon, icons } from './icons'
import { Logo } from './logo'
import { Search } from './search'
import { ThemeToggle } from './theme-toggle'

export const repoUrl = 'https://github.com/kitrjs/kitr'

export function Header() {
  return (
    <header className="site-header">
      <nav className="container nav" aria-label="Main">
        <Link to="/" aria-label="kitr home" className="nav-logo">
          <Logo />
        </Link>
        <div className="nav-links">
          <Link to="/packages" activeProps={{ 'aria-current': 'page' }}>
            Packages
          </Link>
          <Link
            to="/docs/$slug"
            params={{ slug: 'getting-started' }}
            activeOptions={{ includeSearch: false }}
            activeProps={{ 'aria-current': 'page' }}
          >
            Docs
          </Link>
          <Link to="/about" activeProps={{ 'aria-current': 'page' }}>
            About
          </Link>
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
      </nav>
    </header>
  )
}

const footerLinks: Array<{ title: string; links: Array<{ label: string; to: string }> }> = [
  {
    title: 'Learn',
    links: [
      { label: 'Getting started', to: '/docs/getting-started' },
      { label: 'Project structure', to: '/docs/project-structure' },
      { label: 'Platforms', to: '/docs/platforms' },
      { label: 'CLI reference', to: '/docs/cli' },
    ],
  },
  {
    title: 'Build',
    links: [
      { label: 'All packages', to: '/packages' },
      { label: 'Data and caching', to: '/packages/query' },
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
