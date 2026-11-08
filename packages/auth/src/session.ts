import type { Abilities } from './abilities'

/**
 * The one session interface every adapter produces. `@kitr/router`'s
 * `requireAuth()` and `can()` read `session.user` and `session.can`.
 */
export interface Session<TUser = unknown> {
  /** The signed-in user, or `null` when anonymous. */
  user: TUser | null
  /** Expiry as epoch ms, when known. */
  expiresAt?: number
  /** Check an ability for this session's user. */
  can: (ability: string, subject?: unknown) => boolean
}

/**
 * The query cache the cookie-session adapter keeps the session in. A TanStack `QueryClient`
 * fits as it is; it is the app's `queryClient` binding when `@kitr/query` is installed.
 */
export interface SessionQueryCache {
  fetchQuery(options: {
    queryKey: readonly unknown[]
    queryFn: () => Promise<unknown>
    staleTime?: number
  }): Promise<any>
  setQueryData(queryKey: readonly unknown[], data: unknown): unknown
}

/** What the `auth` service hands an adapter on each call: the services of the app it runs in. */
export interface AdapterContext {
  /** The app's query cache, when `@kitr/query` is installed. The cookie-session adapter caches the session in it. */
  queryClient?: SessionQueryCache
}

/** What an adapter implements: load the session, and optionally sign in, sign out, refresh and hand out tokens. */
export interface AuthAdapter<TUser = unknown, TCredentials = unknown> {
  /** Load the current session (from cookie, storage, token...). Null when anonymous. */
  getSession(context?: AdapterContext): Promise<Session<TUser> | null>
  /** Sign in and resolve the new session. */
  signIn?(credentials: TCredentials, context?: AdapterContext): Promise<Session<TUser>>
  /** End the session at the provider. */
  signOut?(context?: AdapterContext): Promise<void>
  /** Refresh tokens; true when the session is still valid. Called by the HTTP client on 401. */
  refresh?(): Promise<boolean>
  /** A bearer token for API calls, if the adapter has one. */
  getToken?(): Promise<string | null> | string | null
  /** Subscribe to session changes from other tabs or the adapter's own events. */
  onChange?(listener: (session: Session<TUser> | null) => void): () => void
}

/** Build a session for a user, with `can` backed by `abilities` (or true for any user without them). Adapters use it. */
export function createSession<TUser>(
  user: TUser | null,
  abilities?: Abilities<TUser, any>,
  extra: { expiresAt?: number } = {},
): Session<TUser> {
  return {
    user,
    expiresAt: extra.expiresAt,
    can: (ability, subject) => (abilities ? abilities.can(user, ability, subject) : !!user),
  }
}

/** The session for nobody: no user, every check false. */
export const anonymousSession: Session<null> = { user: null, can: () => false }

/** What a server-side session lookup resolves with: the user and when the session ends. `null` is anonymous. */
export type ServerSessionResult = { user: unknown; expiresAt?: number } | null

/**
 * Reads the session of the request being rendered. `@kitr/auth/server` installs it (through
 * `runWithSession` and `sessionMiddleware`) so this client-safe module never imports server code.
 * Resolves `undefined` when no request is in scope.
 */
export type ServerSessionResolver = () => Promise<ServerSessionResult | undefined>

const SERVER_SESSION = Symbol.for('kitr.auth.serverSession')

/** Install the server-side session reader. Kept on `globalThis` so duplicated module instances (SSR bundles) share it. */
export function setServerSessionResolver(resolver: ServerSessionResolver | undefined): void {
  ;(globalThis as Record<symbol, unknown>)[SERVER_SESSION] = resolver
}

/** The installed server-side session reader, or `undefined` (always, in a browser). */
export function getServerSessionResolver(): ServerSessionResolver | undefined {
  return (globalThis as Record<symbol, unknown>)[SERVER_SESSION] as ServerSessionResolver | undefined
}
