import type { ComponentType, ReactNode } from 'react'
import { useSession } from './hooks'

/**
 * Render children only for a signed-in user. `fallback` shows for guests (a sign-in prompt, a
 * teaser). Re-renders on sign-in and sign-out, so a page can hold both states without a route
 * change: the same `/` serves the guest landing and the authed home.
 */
export function Authed({
  children,
  fallback = null,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  const session = useSession()
  return <>{session.user ? children : fallback}</>
}

/** Render children only for guests. `fallback` shows for signed-in users. */
export function Guest({
  children,
  fallback = null,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  const session = useSession()
  return <>{session.user ? fallback : children}</>
}

/**
 * A route component that picks a page by auth state:
 *
 *   export const Route = createFileRoute('/')({ component: authBranch({ authed: Home, guest: Landing }) })
 *
 * Both pages share the route (its loader, its URL), so the browser's back button, deep links and
 * SEO see one `/`. A guest who signs in sees `Home` at once; no redirect dance.
 */
export function authBranch(pages: { authed: ComponentType; guest: ComponentType }): ComponentType {
  const Branch = () => {
    const session = useSession()
    const Page = session.user ? pages.authed : pages.guest
    return <Page />
  }
  Branch.displayName = 'AuthBranch'
  return Branch
}
