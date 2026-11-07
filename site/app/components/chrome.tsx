import { Link } from '@tanstack/react-router'
import { Icon, icons } from './icons'
import { Logo } from './logo'
import { Search } from './search'
import { ThemeToggle } from './theme-toggle'

export const repoUrl = 'https://github.com/kitrjs/kit'

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

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer">
        <img src="/favicon.svg" alt="" width={24} height={24} />
        <span>MIT licensed. Built with kitr.</span>
        <div className="nav-spacer" />
        <a href={repoUrl} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a href="https://www.npmjs.com/package/kitr" target="_blank" rel="noreferrer">
          npm
        </a>
        <a href="/llms.txt">llms.txt</a>
      </div>
    </footer>
  )
}
