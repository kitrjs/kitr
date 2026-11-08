---
title: API reference
description: Every export of @kitr/auth and @kitr/auth/server.
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

## @kitr/auth/server

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
