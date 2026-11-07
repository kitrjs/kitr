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

/** What an adapter implements: load the session, and optionally sign in, sign out, refresh and hand out tokens. */
export interface AuthAdapter<TUser = unknown, TCredentials = unknown> {
  /** Load the current session (from cookie, storage, token...). Null when anonymous. */
  getSession(): Promise<Session<TUser> | null>
  /** Sign in and resolve the new session. */
  signIn?(credentials: TCredentials): Promise<Session<TUser>>
  /** End the session at the provider. */
  signOut?(): Promise<void>
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
