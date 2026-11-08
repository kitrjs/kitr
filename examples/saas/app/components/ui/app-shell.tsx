import { Menu01Icon } from '@hugeicons/core-free-icons'
import { Link } from '@kitr/router'
import { cn } from '@kitr/tailwind'
import { type ReactNode, useState } from 'react'
import { Button } from '#components/ui/button'
import { Icon } from '#components/ui/icon'
import { ThemeToggle } from '#components/ui/theme-toggle'

export interface NavItem {
  to: string
  label: ReactNode
  icon?: ReactNode
}

export interface AppShellProps {
  brand: ReactNode
  nav: NavItem[]
  /** Right side of the top bar, e.g. a user menu. */
  user?: ReactNode
  children: ReactNode
  className?: string
}

/** The logged-in app layout. Collapses to a top bar with a menu button on small screens. */
export function AppShell({ brand, nav, user, children, className }: AppShellProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className={cn('flex min-h-screen bg-background text-foreground', className)}>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 -translate-x-full border-r border-border bg-background transition-transform md:static md:translate-x-0',
          open && 'translate-x-0',
        )}
      >
        <div className="flex h-14 items-center px-4 text-lg font-semibold">{brand}</div>
        <nav className="flex flex-col gap-1 p-2">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted [&.active]:bg-muted [&.active]:font-medium"
              activeProps={{ className: 'active' }}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      {open ? (
        // biome-ignore lint/a11y/noStaticElementInteractions: backdrop; the sidebar's own close button is keyboard-reachable
        // biome-ignore lint/a11y/useKeyWithClickEvents: same
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setOpen(false)} />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 border-b border-border px-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            <Icon icon={Menu01Icon} size={18} />
          </Button>
          <div className="flex-1" />
          <ThemeToggle />
          {user}
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
