---
title: API reference
description: Every export of kitr/auth and kitr/auth/server.
order: 2
---

# API reference

## Configuration

```ts
// config/auth.ts
defineConfig({
  adapter: AuthAdapter<TUser, TCredentials>, // required
  signInPath?: string,                       // where guards send anonymous users
  eager?: boolean,                           // load the session before first render; default true
})
```

The provider binds `auth` in the container and, unless `eager: false`, restores the session during boot.

## Session

```ts
interface Session<TUser> {
  user: TUser | null
  expiresAt?: number // epoch ms, when known
  can(ability: string, subject?: unknown): boolean
}
```

The router's `requireAuth()` and `can()` guards read `context.session`, which the provider supplies.

## Hooks

| Hook | Returns |
| --- | --- |
| `useAuth()` | The `Auth` object: `session`, `user`, `load()`, `signIn(credentials)`, `signOut()`, `refresh()`, `getToken()`, `subscribe(listener)`. |
| `useSession()` | The live `Session`. Re-renders on sign-in and sign-out. |
| `useUser()` | `session.user`. |
| `useCan()` | `session.can`. |

## Adapters

### tokenAdapter

```ts
tokenAdapter<TUser, TCredentials = { email: string; password: string }>({
  fetchUser: (token) => Promise<TUser | null>,                       // required
  signIn?: (credentials) => Promise<{ token; refreshToken?; user? }>,
  refresh?: (refreshToken) => Promise<{ token; refreshToken? } | null>,
  signOut?: (token) => Promise<void>,
  storage?: TokenStorage,        // default memoryStorage()
  refreshStorage?: TokenStorage, // default memoryStorage()
  abilities?: Abilities<TUser>,
})
```

`memoryStorage()` and `localStorageTokens(key = 'kitr:token')` are the built-in `TokenStorage`s. Write your own with `{ get(), set(token) }`.

### betterAuthAdapter

```ts
betterAuthAdapter<TUser>(client, { abilities?, signIn?: (client, credentials) => Promise<unknown> })
```

Uses `client.signIn.email` unless you pass `signIn`.

### customAdapter

```ts
customAdapter<TUser, TCredentials>({
  getSession: () => Promise<Session<TUser> | null>, // required
  signIn?, signOut?, refresh?, getToken?, onChange?,
})
```

Build sessions with `createSession(user, abilities?, { expiresAt? })`.

## defineAbilities

```ts
const abilities = defineAbilities<User>({ 'name': (user, subject?) => boolean })

abilities.can(user, 'name', subject) // false when user is null
abilities.for(user)('name', subject)
```

Checks return `false` for an anonymous user, an unknown ability and a rule that throws. Annotate `user` in each rule instead of passing `<User>` to keep the ability names typed.

## kitr/auth/server

No React. Works with any `@kitr/api` router.

```ts
authMiddleware<TUser>({
  verify: (token, ctx) => TUser | null | Promise<TUser | null>, // required
  from?: 'bearer' | { cookie: string }, // default 'bearer'
  optional?: boolean,                   // let anonymous requests through
  abilities?: Abilities<TUser>,
})

requireUser<TUser>(ctx): TUser        // throws 401 when anonymous
currentUser<TUser>(ctx): TUser | null
```

The middleware sets `ctx.locals.user` and `ctx.locals.can(ability, subject)`, and throws `401 UNAUTHORIZED` when there is no valid user and `optional` is off.

### Cookie sessions

```ts
createCookieSession({
  secret: string | string[],     // at least 32 characters; the first signs, all verify
  store: SessionStore,           // required
  cookie?: { name?: string; domain?: string; path?: string; sameSite?: 'lax' | 'strict'; secure?: boolean },
  maxAge?: number,               // idle seconds before expiry; default 7 days (sliding)
  absoluteMaxAge?: number,       // hard limit in seconds; default 30 days
}): CookieSessions

sessions.resolve(request, response?)   // the live SessionRecord or null; slides the expiry
sessions.create(userId, response)      // new session and Set-Cookie, replacing the request's session
sessions.rotate(request, response)     // new id for the same session
sessions.destroy(request, response)    // end the request's session and expire the cookie
sessions.revoke(id)                    // end one session
sessions.revokeAll(userId)             // end every session of a user; resolves how many were live
sessions.list(userId)                  // the user's live sessions
```

```ts
interface SessionStore {
  get(id: string): Promise<SessionRecord | null>
  set(record: SessionRecord, ttlMs: number): Promise<void>
  delete(id: string): Promise<void>
  deleteForUser(userId: string): Promise<void>
  listForUser(userId: string): Promise<SessionRecord[]>
}

createMemorySessionStore()
createStorageSessionStore(driver, { prefix? })
createRedisSessionStore(redis, { prefix? })
```

### Passwords and users

```ts
hashPassword(password): Promise<string>          // scrypt, or PBKDF2-SHA256 (600,000 rounds) without scrypt
hashPasswordWebCrypto(password): Promise<string> // always PBKDF2
verifyPassword(password, hash): Promise<boolean> // constant time; false for a malformed hash
needsRehash(hash): boolean

interface UserProvider<TUser> {
  findByEmail(email: string): Promise<StoredUser<TUser> | null>
  findById(id: string): Promise<StoredUser<TUser> | null>
  create(input: NewUser): Promise<StoredUser<TUser>>
  setPasswordHash?(id: string, hash: string): Promise<void>
  markEmailVerified?(id: string): Promise<void>
}
createMemoryUserProvider<TUser>({ build, seed? })
```

### Requests and the controller

```ts
runWithSession(auth, request, fn)   // render fn inside the request's session scope (app/server.ts)
sessionMiddleware(auth)             // API middleware: resolves the cookie, 401 without a session
getRequestSession() / getRequestUser()
createSessionController({ sessions, users, mail?, appUrl? })
```

`auth` is `{ sessions, users }`. The controller methods are `session` (`GET`, `Cache-Control: no-store`), `signIn`, `signUp`, `signOut`, `signOutAll`, `requestVerification`, `verifyEmail`, `requestPasswordReset` and `resetPassword`; each state-changing one verifies the CSRF token.

### kitr/auth additions

```ts
sessionAdapter<TUser>({ abilities?, fetchSession, signIn, signOut? }) // cookie-backed adapter; caches through the query layer
ensureSession(ctx)    // beforeLoad step: loads the session in the request's app (server) or the cache (browser)
```
