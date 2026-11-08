import { KitrError } from '@kitr/core'
import type { Abilities } from './abilities'
import {
  type AdapterContext,
  type AuthAdapter,
  createSession,
  getServerSessionResolver,
  type Session,
} from './session'

/** Where `tokenAdapter` keeps a token. Both methods may be async. */
export interface TokenStorage {
  /** The stored token, or `null`. */
  get(): string | null | Promise<string | null>
  /** Store a token; `null` clears it. */
  set(token: string | null): void | Promise<void>
}

/** Token storage in a variable: safest, but lost on reload. The default for `tokenAdapter`. */
export const memoryStorage = (): TokenStorage => {
  let value: string | null = null
  return {
    get: () => value,
    set: (t) => {
      value = t
    },
  }
}

/** Token storage in `localStorage` under `key` (default `kitr:token`), so sessions survive reloads. Errors read as `null`. */
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

/** Options for `tokenAdapter`. */
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
  /** Tell the backend to revoke the token. Errors are ignored. */
  signOut?: (token: string) => Promise<void>
  /** Where the refresh token lives. Default: memory. */
  refreshStorage?: TokenStorage
  /** Abilities for `session.can`. Without them, `can` is true for any signed-in user. */
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
  /** Resolves the current user and session, or `data: null`. */
  getSession(): Promise<{ data: { user: TUser; session?: { expiresAt?: string | Date } } | null }>
  /** Ends the Better Auth session. */
  signOut(): Promise<unknown>
  /** Sign-in methods by name; `email` is used by default. */
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

/** What the session endpoint answers and what sign-in resolves with: the user (or `null`) and when the session ends. */
export interface SessionPayload<TUser> {
  /** The signed-in user, or `null` when anonymous. */
  user: TUser | null
  /** When the session ends (epoch ms). */
  expiresAt?: number
}

/** The query key the cookie-session adapter caches the session under. Invalidate it to force a reload. */
export const sessionQueryKey = ['auth', 'session'] as const

/** Options for `sessionAdapter`. */
export interface SessionAdapterOptions<TUser, TCredentials> {
  /** Abilities for `session.can`. Without them `can` is true for any signed-in user. */
  abilities?: Abilities<TUser, any>
  /** Call `GET /auth/session`. With the typed client: `() => api.auth.session()`. The browser sends the cookie. */
  fetchSession: () => Promise<SessionPayload<TUser>>
  /** Call `POST /auth/sign-in`. With the typed client: `(body) => api.auth.signIn({ body })`. The response sets the cookie. */
  signIn: (credentials: TCredentials) => Promise<SessionPayload<TUser> & { user: TUser }>
  /** Call `POST /auth/sign-out`. The response expires the cookie. */
  signOut?: () => Promise<unknown>
  /** How long the cached session counts as fresh, in ms. Default 30 seconds. */
  staleTime?: number
}

/**
 * Cookie sessions for the browser and for server rendering: the session lives in an HttpOnly
 * cookie (see `createCookieSession` in `@kitr/auth/server`), so the client never holds a token.
 * In the browser the session comes from `GET /auth/session`, cached in the query client and
 * replaced on sign-in and sign-out. During SSR it comes from the request being rendered, with no
 * HTTP call: `runWithSession` in the server entry puts it in scope.
 */
export function sessionAdapter<TUser, TCredentials = { email: string; password: string }>(
  options: SessionAdapterOptions<TUser, TCredentials>,
): AuthAdapter<TUser, TCredentials> {
  const toSession = (payload: SessionPayload<TUser> | null | undefined) =>
    payload?.user
      ? createSession(payload.user, options.abilities, { expiresAt: payload.expiresAt })
      : null
  return {
    async getSession(context?: AdapterContext) {
      // Rendering on the server: the session of this request, no HTTP call.
      const server = getServerSessionResolver()
      if (server) {
        const found = await server()
        if (found !== undefined) return toSession(found as SessionPayload<TUser> | null)
      }
      const cache = context?.queryClient
      const payload = cache
        ? await cache.fetchQuery({
            queryKey: sessionQueryKey,
            queryFn: options.fetchSession,
            staleTime: options.staleTime ?? 30_000,
          })
        : await options.fetchSession()
      return toSession(payload as SessionPayload<TUser>)
    },
    async signIn(credentials, context) {
      const payload = await options.signIn(credentials)
      context?.queryClient?.setQueryData(sessionQueryKey, {
        user: payload.user,
        expiresAt: payload.expiresAt,
      })
      return toSession(payload)!
    },
    async signOut(context) {
      try {
        await options.signOut?.()
      } finally {
        context?.queryClient?.setQueryData(sessionQueryKey, { user: null })
      }
    },
  }
}
