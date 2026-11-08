import { useApp } from '@kitr/react'
import { useSyncExternalStore } from 'react'
import type { Auth } from './provider'
import type { Session } from './session'

/** The `auth` service from the nearest kitr app: sign in and out, refresh, read the session. */
export function useAuth<TUser = unknown, TCredentials = unknown>(): Auth<TUser, TCredentials> {
  return useApp().container.use('auth') as Auth<TUser, TCredentials>
}

/** The live session; re-renders on sign-in/out. */
export function useSession<TUser = unknown>(): Session<TUser> {
  const auth = useAuth<TUser>()
  return useSyncExternalStore(
    auth.subscribe,
    () => auth.session,
    () => auth.session,
  )
}

/** The signed-in user, or `null`. Re-renders on sign-in and sign-out. */
export function useUser<TUser = unknown>(): TUser | null {
  return useSession<TUser>().user
}

/** `const can = useCan(); can('projects.update', project)` */
export function useCan(): (ability: string, subject?: unknown) => boolean {
  const session = useSession()
  return session.can
}
