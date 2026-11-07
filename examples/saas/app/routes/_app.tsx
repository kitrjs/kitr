import { createFileRoute } from '@tanstack/react-router'
import { type Session, useAuth, useUser } from 'kitr/auth'
import { Outlet, requireAuth, useNavigate } from 'kitr/router'
import { ssrRoute } from 'kitr/ssr'
import type { User } from '#app/abilities'
import { AppShell } from '#components/ui/app-shell'
import { Button } from '#components/ui/button'

/**
 * Pathless layout: everything under it needs a session. The guard runs on the client only
 * (the token lives in localStorage), so the layout opts out of SSR.
 */
export const Route = createFileRoute('/_app')({
  ...ssrRoute(false),
  beforeLoad: async ({ context, location }) => {
    // Read the live session from the container: the router copies its context object,
    // so a value captured at creation time would be stale after sign-in.
    await context.app.boot()
    const session = context.app.container.use('auth').session as Session<User>
    return requireAuth()({ context: { session }, location })
  },
  component: AppLayout,
})

function AppLayout() {
  const auth = useAuth<User>()
  const user = useUser<User>()
  const navigate = useNavigate()
  return (
    <AppShell
      brand="Saas"
      nav={[
        { to: '/', label: 'Overview' },
        { to: '/projects', label: 'Projects' },
      ]}
      user={
        <div className="flex items-center gap-2 text-sm">
          <span className="hidden text-muted-foreground sm:inline">{user?.email}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await auth.signOut()
              await navigate({ to: '/sign-in', search: { redirect: undefined } })
            }}
          >
            Sign out
          </Button>
        </div>
      }
    >
      <Outlet />
    </AppShell>
  )
}
