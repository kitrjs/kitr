import { KitrError } from '@kitr/core'
import type { Abilities } from './abilities'
import { type AuthAdapter, createSession, type Session } from './session'

export interface TokenStorage {
  get(): string | null | Promise<string | null>
  set(token: string | null): void | Promise<void>
}

export const memoryStorage = (): TokenStorage => {
  let value: string | null = null
  return {
    get: () => value,
    set: (t) => {
      value = t
    },
  }
}

export const localStorageTokens = (key = 'kitr:token'): TokenStorage => ({
  get: () => {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set: (t) => {
    try {
      if (t === null) localStorage.removeItem(key)
      else localStorage.setItem(key, t)
    } catch {}
  },
})

export interface TokenAdapterOptions<TUser, TCredentials> {
  /** Where the access token lives. Default: memory (safest); use `localStorageTokens()` to survive reloads. */
  storage?: TokenStorage
  /** Fetch the current user with the token. Return null for 401. */
  fetchUser: (token: string) => Promise<TUser | null>
  /** Exchange credentials for tokens. */
  signIn?: (
    credentials: TCredentials,
  ) => Promise<{ token: string; refreshToken?: string; user?: TUser }>
  /** Exchange a refresh token for a new access token. */
  refresh?: (refreshToken: string) => Promise<{ token: string; refreshToken?: string } | null>
  signOut?: (token: string) => Promise<void>
  refreshStorage?: TokenStorage
  abilities?: Abilities<TUser, any>
}

/**
 * Bearer-token sessions against any backend (an Adonis API, a JWT service...).
 * Pairs with `@kitr/http`'s `createHttpClient({ getToken: auth.getToken, refresh: auth.refresh })`.
 */
export function tokenAdapter<TUser, TCredentials = { email: string; password: string }>(
  options: TokenAdapterOptions<TUser, TCredentials>,
): AuthAdapter<TUser, TCredentials> {
  const storage = options.storage ?? memoryStorage()
  const refreshStorage = options.refreshStorage ?? memoryStorage()
  const listeners = new Set<(s: Session<TUser> | null) => void>()
  const notify = (s: Session<TUser> | null) => {
    for (const l of listeners) l(s)
  }
  return {
    async getSession() {
      const token = await storage.get()
      if (!token) return null
      const user = await options.fetchUser(token)
      return user ? createSession(user, options.abilities) : null
    },
    getToken: () => storage.get(),
    async signIn(credentials) {
      if (!options.signIn) throw new KitrError('INTERNAL', 'tokenAdapter: signIn not configured')
      const result = await options.signIn(credentials)
      await storage.set(result.token)
      if (result.refreshToken) await refreshStorage.set(result.refreshToken)
      const user = result.user ?? (await options.fetchUser(result.token).catch(() => null))
      if (!user) {
        // Don't leave a token behind that getSession() would keep trying.
        await storage.set(null)
        await refreshStorage.set(null)
        throw KitrError.unauthorized('Sign-in succeeded but no user was returned')
      }
      const session = createSession(user, options.abilities)
      notify(session)
      return session
    },
    async signOut() {
      const token = await storage.get()
      if (token) await options.signOut?.(token).catch(() => {})
      await storage.set(null)
      await refreshStorage.set(null)
      notify(null)
    },
    async refresh() {
      if (!options.refresh) return false
      const refreshToken = await refreshStorage.get()
      if (!refreshToken) return false
      const result = await options.refresh(refreshToken).catch(() => null)
      if (!result) {
        await storage.set(null)
        await refreshStorage.set(null)
        notify(null)
        return false
      }
      await storage.set(result.token)
      if (result.refreshToken) await refreshStorage.set(result.refreshToken)
      return true
    },
    onChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** Minimal surface of a Better Auth client we rely on; keeps `better-auth` out of our dependencies. */
export interface BetterAuthLikeClient<TUser> {
  getSession(): Promise<{ data: { user: TUser; session?: { expiresAt?: string | Date } } | null }>
  signOut(): Promise<unknown>
  signIn?: Record<string, (...args: any[]) => Promise<unknown>>
}

/** Cookie-session adapter for Better Auth's client (`createAuthClient()`). */
export function betterAuthAdapter<TUser, TCredentials = { email: string; password: string }>(
  client: BetterAuthLikeClient<TUser>,
  options: {
    abilities?: Abilities<TUser, any>
    signIn?: (client: BetterAuthLikeClient<TUser>, credentials: TCredentials) => Promise<unknown>
  } = {},
): AuthAdapter<TUser, TCredentials> {
  return {
    async getSession() {
      const { data } = await client.getSession()
      if (!data?.user) return null
      const expiresAt = data.session?.expiresAt
        ? new Date(data.session.expiresAt).getTime()
        : undefined
      return createSession(data.user, options.abilities, { expiresAt })
    },
    async signIn(credentials) {
      if (options.signIn) await options.signIn(client, credentials)
      else if (client.signIn?.email) await client.signIn.email(credentials)
      else throw new KitrError('INTERNAL', 'betterAuthAdapter: no signIn configured')
      const { data } = await client.getSession()
      if (!data?.user) throw KitrError.unauthorized('Sign-in failed')
      return createSession(data.user, options.abilities)
    },
    async signOut() {
      await client.signOut()
    },
  }
}

/** Any custom shape: pass the functions you have. */
export function customAdapter<TUser, TCredentials = unknown>(
  adapter: AuthAdapter<TUser, TCredentials>,
): AuthAdapter<TUser, TCredentials> {
  return adapter
}
