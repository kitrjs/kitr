import { createDefineConfig, defineProvider, getDevtools, type KitrProvider } from '@kitr/core'
import type { AuthAdapter, Session } from './session'
import { anonymousSession } from './session'

/** Options in `config/auth.ts`. */
export interface AuthConfig<TUser = unknown, TCredentials = unknown> {
  /** Where sessions come from: `tokenAdapter`, `betterAuthAdapter` or `customAdapter`. */
  adapter: AuthAdapter<TUser, TCredentials>
  /** Your sign-in page. Documentation only: `requireAuth()` takes its own `to` (default `/sign-in`). */
  signInPath?: string
  /** Load the session during boot (default true). Set false to defer to the first guarded route. */
  eager?: boolean
}

/** The `auth` service bound in the container: the live session and the actions that change it. */
export interface Auth<TUser = unknown, TCredentials = unknown> {
  /** The current session; anonymous when nobody is signed in. */
  readonly session: Session<TUser>
  /** The signed-in user, or `null`. */
  readonly user: TUser | null
  /** The adapter from the config. */
  readonly adapter: AuthAdapter<TUser, TCredentials>
  /** Ask the adapter for the session again. Errors become an anonymous session. */
  load(): Promise<Session<TUser>>
  /** Sign in through the adapter and resolve the new session. */
  signIn(credentials: TCredentials): Promise<Session<TUser>>
  /** Sign out through the adapter and clear the session. */
  signOut(): Promise<void>
  /** Refresh tokens. Resolves false, and clears the session, when that is not possible. */
  refresh(): Promise<boolean>
  /** The bearer token for API calls, or `null`. */
  getToken(): Promise<string | null>
  /** Listen for session changes, once per change. Returns an unsubscribe function. */
  subscribe(listener: (session: Session<TUser>) => void): () => void
  /** Router context slice: `createKitrRouter({ context: auth.toContext() })`. */
  toContext(): { session: Session<TUser> }
}

declare module '@kitr/core' {
  interface ConfigRegistry {
    auth: AuthConfig<any, any>
  }
  interface ContainerBindings {
    auth: Auth<any, any>
  }
}

/** Type the `config/auth.ts` export. Returns the object unchanged. */
export const defineConfig = createDefineConfig<AuthConfig<any, any>>()

/** Build the `auth` service around an adapter. The provider does this from `config/auth.ts`; call it directly in tests. */
export function createAuth<TUser, TCredentials>(
  adapter: AuthAdapter<TUser, TCredentials>,
): Auth<TUser, TCredentials> {
  let session: Session<TUser> = anonymousSession as Session<TUser>
  const listeners = new Set<(s: Session<TUser>) => void>()
  const set = (next: Session<TUser> | null) => {
    if (next === null && session.user === null) return
    // The adapter's onChange and our own call can report the same session: notify once.
    if (next === session) return
    session = next ?? (anonymousSession as Session<TUser>)
    for (const l of listeners) l(session)
  }
  adapter.onChange?.(set)
  const auth: Auth<TUser, TCredentials> = {
    adapter,
    get session() {
      return session
    },
    get user() {
      return session.user
    },
    async load() {
      set(await adapter.getSession().catch(() => null))
      return session
    },
    async signIn(credentials) {
      if (!adapter.signIn) throw new Error('[kitr/auth] adapter has no signIn')
      set(await adapter.signIn(credentials))
      return session
    },
    async signOut() {
      await adapter.signOut?.()
      set(null)
    },
    async refresh() {
      const ok = (await adapter.refresh?.()) ?? false
      if (!ok) set(null)
      return ok
    },
    async getToken() {
      return (await adapter.getToken?.()) ?? null
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    toContext: () => ({
      get session() {
        return session
      },
    }),
  }
  return auth
}

/** Binds `auth` from `config/auth.ts` and restores the session before the first render. */
export const authProvider: KitrProvider = defineProvider({
  name: 'auth',
  register(app) {
    app.container.singleton('auth', () => createAuth(app.config.get('auth').adapter))
  },
  async boot(app) {
    const config = app.config.get('auth')
    const auth = app.container.use('auth')
    const hub = getDevtools(app)
    if (hub) {
      auth.subscribe((session) => {
        hub.log('auth', session.user ? 'signed in' : 'signed out', session.user ?? undefined)
        hub.notify()
      })
    }
    if (config.eager !== false) await auth.load()
  },
  devtools: () => import('./devtools').then((m) => m.panels()),
})

export default authProvider
