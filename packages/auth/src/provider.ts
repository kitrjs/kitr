import { createDefineConfig, defineProvider, type KitrProvider } from '@kitr/core'
import type { AuthAdapter, Session } from './session'
import { anonymousSession } from './session'

export interface AuthConfig<TUser = unknown, TCredentials = unknown> {
  adapter: AuthAdapter<TUser, TCredentials>
  /** Where `requireAuth()` sends anonymous users. Default `/sign-in`. */
  signInPath?: string
  /** Load the session during boot (default true). Set false to defer to the first guarded route. */
  eager?: boolean
}

export interface Auth<TUser = unknown, TCredentials = unknown> {
  readonly session: Session<TUser>
  readonly user: TUser | null
  readonly adapter: AuthAdapter<TUser, TCredentials>
  load(): Promise<Session<TUser>>
  signIn(credentials: TCredentials): Promise<Session<TUser>>
  signOut(): Promise<void>
  refresh(): Promise<boolean>
  getToken(): Promise<string | null>
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

export const defineConfig = createDefineConfig<AuthConfig<any, any>>()

export function createAuth<TUser, TCredentials>(
  adapter: AuthAdapter<TUser, TCredentials>,
): Auth<TUser, TCredentials> {
  let session: Session<TUser> = anonymousSession as Session<TUser>
  const listeners = new Set<(s: Session<TUser>) => void>()
  const set = (next: Session<TUser> | null) => {
    if (next === null && session.user === null) return
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
    if (config.eager !== false) await app.container.use('auth').load()
  },
})

export default authProvider
