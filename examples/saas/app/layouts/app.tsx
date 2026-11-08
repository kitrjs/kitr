import { Folder01Icon, Home01Icon, Logout01Icon } from '@hugeicons/core-free-icons'
import { useAuth, useUser } from '@kitr/auth'
import { useQueryClient } from '@kitr/query'
import { Outlet, useNavigate } from '@kitr/router'
import type { User } from '#app/abilities'
import { AppShell } from '#components/ui/app-shell'
import { Button } from '#components/ui/button'
import { Icon } from '#components/ui/icon'

/** The signed-in shell around every page of the `_app` layout (the guard is in app/routes.ts). */
export default function AppLayout() {
  const auth = useAuth<User>()
  const user = useUser<User>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  return (
    <AppShell
      brand="Saas"
      nav={[
        { to: '/', label: 'Overview', icon: <Icon icon={Home01Icon} /> },
        { to: '/projects', label: 'Projects', icon: <Icon icon={Folder01Icon} /> },
      ]}
      user={
        <div className="flex items-center gap-2 text-sm">
          <span className="hidden text-muted-foreground sm:inline">{user?.email}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await auth.signOut()
              // The next person on this browser must not see this user's cached data.
              queryClient.removeQueries({ queryKey: ['api'] })
              await navigate({ to: '/sign-in', search: { redirect: undefined } })
            }}
          >
            <Icon icon={Logout01Icon} />
            Sign out
          </Button>
        </div>
      }
    >
      <Outlet />
    </AppShell>
  )
}
