---
title: Auth
description: Sign users in and out, protect pages, and check who can do what.
order: 1
---

# Auth

Almost every screen in an app asks two questions: who is this, and are they allowed to do that? `@kitr/auth` answers both, in the browser and on the server, with the same rules in both places. It gives the app one session to read, guards for pages, and permission checks written once as plain functions.

By default it doesn't store passwords or run a login server: it connects to what you already have, such as your own API's token endpoint or [Better Auth](https://www.better-auth.com/docs), through an adapter. When your app has a kitr server, it can also run the sign-in itself with [cookie sessions](#cookie-sessions-with-a-server). On top it adds React hooks, router guards for [Router](/packages/router), and middleware for [API routes](/packages/api).

The session, hooks and adapters run in the browser. `@kitr/auth/server` runs on the server and has no React dependency. If all you need is to protect API routes with a token your server checks, use `@kitr/auth/server` alone.

The examples on this page follow Acme's project tracker at `app.acme.com`. Ada is an admin, Grace and Linus are members, and members can edit only the projects they own.

## Install

```sh
kitr add auth
```

What `kitr add auth` does:

- Installs `@kitr/auth` and adds it to `packages` in `kitrrc.ts`.
- Registers `() => import('@kitr/auth/provider')` in `providers` in `kitrrc.ts`.
- Writes `app/abilities.ts`, with a `User` type and one permission rule.
- Writes `config/auth.ts` (shown under Configure) and adds it to `config/index.ts`.
- Declares `VITE_API_URL: e.url({ default: 'http://localhost:3333' })` in the `public` block of `app/env.ts`, and adds `VITE_API_URL=http://localhost:3333` to `.env.example` (and `.env` when it exists). The generated config calls that URL.
- Edits `app/router.tsx` to put the live session in the router context and type it on `KitrRouterContext`, so `requireAuth()` works without more wiring ([Protect pages](#protect-pages)). A router file you have already changed from the generated one is left alone.
- Adds a `kitr: auth` section to `AGENTS.md`: guard routes with `requireAuth()` and `can()`, read the session with `useSession()` and `useUser()`, and keep abilities in `app/abilities.ts`.

The generated permissions file:

```ts
// app/abilities.ts
import { defineAbilities } from '@kitr/auth'

export interface User {
  id: string
  email: string
  role: 'admin' | 'member'
}

export const abilities = defineAbilities({
  'projects.update': (user: User, project: { ownerId: string }) => user.role === 'admin' || project.ownerId === user.id,
})
```

`@kitr/auth` is a client package: in a server-only project, `kitr add auth` skips it. It asks how users sign in: `--provider token` (the default, described on this page), `session` ([cookie sessions](#cookie-sessions-with-a-server)) or `better-auth`; `--no-emails` skips the verification and reset emails of `session`. Use `@kitr/auth/server` from `@kitr/auth` there by installing the package yourself. The `app`, `fullstack`, `saas`, `desktop` and `mobile` kits include auth already.

`kitr remove auth` takes the session back out of `app/router.tsx`, unregisters the provider, removes `@kitr/auth` from `package.json` and `kitrrc.ts`, deletes `config/auth.ts` and drops the `AGENTS.md` section. It keeps `app/abilities.ts` and `VITE_API_URL`, and lists the files that still import `@kitr/auth`.

## Configure

`kitr add auth` writes this file:

```ts
// config/auth.ts
import { defineConfig, localStorageTokens, tokenAdapter } from '@kitr/auth'
import { type User, abilities } from '#app/abilities'
import { env } from '#app/env'

// Swap for betterAuthAdapter(createAuthClient()) or a customAdapter({...}).
const adapter = tokenAdapter<User>({
  abilities,
  storage: localStorageTokens(),
  fetchUser: async (token) => {
    const res = await fetch(`${env.VITE_API_URL}/me`, { headers: { authorization: `Bearer ${token}` } })
    return res.ok ? ((await res.json()) as User) : null
  },
  signIn: async (credentials) => {
    const res = await fetch(`${env.VITE_API_URL}/sign-in`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(credentials) })
    if (!res.ok) throw new Error('Invalid credentials')
    return (await res.json()) as { token: string; refreshToken?: string }
  },
})

export default defineConfig({ adapter, signInPath: '/sign-in' })
```

| Option | Default | Description |
| --- | --- | --- |
| `adapter` | required | Where sessions come from: `tokenAdapter`, `betterAuthAdapter` or `customAdapter`. See "Adapters". |
| `signInPath` | `'/sign-in'` | Your sign-in page. `requireAuth()` sends anonymous visitors here, unless you pass it its own `to`. |
| `eager` | `true` | Restore the session while the app boots, before the first render. `false` waits until you call `auth.load()`. |

| Variable | Used for |
| --- | --- |
| `VITE_API_URL` | The API that answers `/me` and `/sign-in` in the generated config. |

`kitr add auth` declares `VITE_API_URL` in `app/env.ts` (default `http://localhost:3333`) and adds the session to the router context in `app/router.tsx`, so `requireAuth()` works without more wiring.

## Show who is signed in

With the provider registered, every component can read the session. Show Ada her name and a sign-out button:

```tsx
// app/components/account_menu.tsx
import { useAuth, useUser } from '@kitr/auth'
import { Link } from '@kitr/router'
import type { User } from '#app/abilities'

export function AccountMenu() {
  const auth = useAuth()
  const user = useUser<User>()
  if (!user) return <Link to="/sign-in">Sign in</Link>
  return (
    <button type="button" onClick={() => auth.signOut()}>
      Sign out {user.email}
    </button>
  )
}
```

Render `<AccountMenu />` in your layout. Before sign-in it shows "Sign in"; after Ada signs in it shows "Sign out ada@acme.com". The component re-renders on every sign-in and sign-out, in any part of the app.

| Hook | Returns |
| --- | --- |
| `useAuth()` | The `auth` service: `signIn`, `signOut`, `refresh`, `load`, `getToken`, `session`, `user`. |
| `useSession()` | The current session: `{ user, expiresAt, can }`. |
| `useUser()` | The signed-in user, or `null`. |
| `useCan()` | The session's `can(ability, subject)` function. |

## Sign users in

Call `auth.signIn(credentials)` with whatever your adapter expects. It resolves with the new session and throws when the credentials are wrong:

```ts
// app/routes.ts
r.page('/sign-in', {
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  lazy: () => import('./pages/sign-in'),
})
```

```tsx
// app/pages/sign-in.tsx
import { useAuth } from '@kitr/auth'
import { getRouteApi, useNavigate } from '@kitr/router'
import { type FormEvent, useState } from 'react'
import type { User } from '#app/abilities'

const route = getRouteApi('/sign-in')

export default function SignInPage() {
  const { redirect } = route.useSearch()
  const navigate = useNavigate()
  const auth = useAuth<User, { email: string; password: string }>()
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    try {
      await auth.signIn({ email: String(data.get('email')), password: String(data.get('password')) })
      await navigate({ to: redirect ?? '/' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {error && <p role="alert">{error}</p>}
      <input name="email" type="email" autoComplete="email" placeholder="ada@acme.com" />
      <input name="password" type="password" autoComplete="current-password" />
      <button type="submit">Sign in</button>
    </form>
  )
}
```

`redirect` is the page the visitor tried to open before the guard sent them here. With the generated config, wrong credentials throw `Invalid credentials`. With [Forms](/packages/forms), pass `auth.signIn` to the form's `onSubmit` and the error shows at the top of the form.

## Sign users out

```tsx
// app/components/sign_out_button.tsx
import { useAuth } from '@kitr/auth'
import { useNavigate } from '@kitr/router'

export function SignOutButton() {
  const auth = useAuth()
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={async () => {
        await auth.signOut()
        await navigate({ to: '/sign-in' })
      }}
    >
      Sign out
    </button>
  )
}
```

`signOut()` calls the adapter's `signOut` (for tokens, your API's sign-out endpoint when you configure one), clears stored tokens and sets the session to anonymous. `tokenAdapter` ignores a failing sign-out endpoint, so the user is always signed out locally. With `customAdapter` and `betterAuthAdapter`, an error from the adapter's `signOut` rejects and leaves the session as it was.

## Adapters

An adapter turns your backend into a session. Every adapter produces the same `Session`, so hooks, guards and permissions work the same with any of them.

### Your own API with tokens

`tokenAdapter` works with any backend that issues bearer tokens: an Acme API built with [API routes](/packages/api), a JWT service, or another framework. It needs `fetchUser`; `signIn`, `refresh` and `signOut` are optional:

```ts
// config/auth.ts
import { defineConfig, localStorageTokens, tokenAdapter } from '@kitr/auth'
import { type User, abilities } from '#app/abilities'
import { env } from '#app/env'

const adapter = tokenAdapter<User>({
  abilities,
  storage: localStorageTokens(),
  fetchUser: async (token) => {
    const res = await fetch(`${env.VITE_API_URL}/me`, { headers: { authorization: `Bearer ${token}` } })
    return res.ok ? ((await res.json()) as User) : null
  },
  signIn: async (credentials) => {
    const res = await fetch(`${env.VITE_API_URL}/sign-in`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(credentials),
    })
    if (!res.ok) throw new Error('Wrong email or password')
    return (await res.json()) as { token: string; refreshToken?: string; user?: User }
  },
  signOut: async (token) => {
    await fetch(`${env.VITE_API_URL}/sign-out`, { method: 'POST', headers: { authorization: `Bearer ${token}` } })
  },
})

export default defineConfig({ adapter })
```

| Option | Default | Description |
| --- | --- | --- |
| `fetchUser` | required | `(token) => user or null`. Called on boot and after sign-in. Return `null` for an invalid token. |
| `signIn` | none | `(credentials) => { token, refreshToken?, user? }`. When it returns `user`, `fetchUser` is skipped. |
| `refresh` | none | `(refreshToken) => { token, refreshToken? } or null`. See "Refresh expired tokens". |
| `signOut` | none | `(token) => void`. Tells your API to revoke the token. |
| `storage` | memory | Where the access token lives. See "Keep users signed in across reloads". |
| `refreshStorage` | memory | Where the refresh token lives. |
| `abilities` | none | Your `defineAbilities` result, for `session.can`. Without it, `can()` is true for any signed-in user. |

The second type parameter types the credentials: `tokenAdapter<User, { email: string; code: string }>` for a one-time-code sign-in. The default is `{ email: string; password: string }`.

### Better Auth

`betterAuthAdapter` wraps a [Better Auth client](https://www.better-auth.com/docs/concepts/client). The session lives in Better Auth's cookie, so nothing is stored in the browser:

```sh
pnpm add better-auth
```

```ts
// config/auth.ts
import { createAuthClient } from 'better-auth/react'
import { betterAuthAdapter, defineConfig } from '@kitr/auth'
import { type User, abilities } from '#app/abilities'

const client = createAuthClient({ baseURL: 'https://app.acme.com' })

export default defineConfig({
  adapter: betterAuthAdapter<User>(client, { abilities }),
})
```

`signIn({ email, password })` calls `client.signIn.email()` and then reads the session. Pass your own `signIn` to use another method, such as a social provider:

```ts
// config/auth.ts
import { createAuthClient } from 'better-auth/react'
import { betterAuthAdapter, defineConfig } from '@kitr/auth'
import { type User, abilities } from '#app/abilities'

const client = createAuthClient({ baseURL: 'https://app.acme.com' })

export default defineConfig({
  adapter: betterAuthAdapter<User, { provider: 'github' | 'google' }>(client, {
    abilities,
    signIn: (c, { provider }) => c.signIn!.social({ provider }),
  }),
})
```

The session's `expiresAt` comes from Better Auth's session. Better Auth runs its own server; see [its installation guide](https://www.better-auth.com/docs/installation).

### Any other backend

`customAdapter` takes the functions you have. Only `getSession` is required. Build the session with `createSession(user, abilities)`:

```ts
// config/auth.ts
import { createSession, customAdapter, defineConfig } from '@kitr/auth'
import { type User, abilities } from '#app/abilities'

const adapter = customAdapter<User, { email: string; password: string }>({
  async getSession() {
    const res = await fetch('https://app.acme.com/api/session', { credentials: 'include' })
    if (!res.ok) return null
    return createSession((await res.json()) as User, abilities)
  },
  async signIn(credentials) {
    const res = await fetch('https://app.acme.com/api/session', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(credentials),
    })
    if (!res.ok) throw new Error('Wrong email or password')
    return createSession((await res.json()) as User, abilities)
  },
  async signOut() {
    await fetch('https://app.acme.com/api/session', { method: 'DELETE', credentials: 'include' })
  },
})

export default defineConfig({ adapter })
```

For a reusable adapter, such as one for Firebase or Clerk, see "Extend".

## Keep users signed in across reloads

`tokenAdapter` keeps tokens in memory by default. That is the safest place, but the user is signed out when the page reloads. `localStorageTokens()` keeps the access token across reloads, under the key `kitr:token`:

```ts
// config/auth.ts
import { defineConfig, localStorageTokens, memoryStorage, tokenAdapter } from '@kitr/auth'
import { type User, abilities } from '#app/abilities'
import { env } from '#app/env'

const adapter = tokenAdapter<User>({
  abilities,
  storage: localStorageTokens('acme:token'),
  refreshStorage: memoryStorage(),
  fetchUser: async (token) => {
    const res = await fetch(`${env.VITE_API_URL}/me`, { headers: { authorization: `Bearer ${token}` } })
    return res.ok ? ((await res.json()) as User) : null
  },
})

export default defineConfig({ adapter })
```

> **Warning**
> Any script on your page can read `localStorage`, so an XSS bug exposes the token. Keep access tokens short-lived, keep refresh tokens in memory, or use a cookie session (Better Auth or `customAdapter`) for sensitive apps.

Storage that throws, such as in a private window, is ignored: reads return `null`. To store tokens elsewhere, such as [Secure storage](/packages/secure-storage) in a mobile app, pass any object with `get()` and `set(token)`:

```ts
// app/auth/secure_tokens.ts
import type { TokenStorage } from '@kitr/auth'
import { app } from '#app/app'

export const secureTokens: TokenStorage = {
  get: () => app.container.use('secureStorage').get('acme.token'),
  set: (token) =>
    token === null
      ? app.container.use('secureStorage').remove('acme.token')
      : app.container.use('secureStorage').set('acme.token', token),
}
```

Both methods may return a promise.

## Refresh expired tokens

Give `tokenAdapter` a `refresh` function, and `auth.refresh()` swaps the stored refresh token for a new access token:

```ts
// config/auth.ts
import { defineConfig, localStorageTokens, tokenAdapter } from '@kitr/auth'
import { type User, abilities } from '#app/abilities'
import { env } from '#app/env'

const adapter = tokenAdapter<User>({
  abilities,
  storage: localStorageTokens(),
  fetchUser: async (token) => {
    const res = await fetch(`${env.VITE_API_URL}/me`, { headers: { authorization: `Bearer ${token}` } })
    return res.ok ? ((await res.json()) as User) : null
  },
  signIn: async (credentials) => {
    const res = await fetch(`${env.VITE_API_URL}/sign-in`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(credentials),
    })
    if (!res.ok) throw new Error('Wrong email or password')
    return (await res.json()) as { token: string; refreshToken: string }
  },
  refresh: async (refreshToken) => {
    const res = await fetch(`${env.VITE_API_URL}/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    return res.ok ? ((await res.json()) as { token: string; refreshToken?: string }) : null
  },
})

export default defineConfig({ adapter })
```

`auth.refresh()` resolves `true` when a new token was stored. It resolves `false`, and signs the user out, when there is no refresh token, when `refresh` returns `null` or throws, or when the adapter has no `refresh` at all. Don't call `refresh()` to check whether a user is signed in; read `auth.user`.

You rarely call it yourself. Point the HTTP client at it, and a `401` triggers one refresh and a retry (next section).

## Send the token with every request

[HTTP](/packages/http) takes the token and the refresh function from the `auth` service:

```ts
// config/http.ts
import { defineConfig } from '@kitr/http'
import { app } from '#app/app'
import { env } from '#app/env'

export default defineConfig({
  baseUrl: env.VITE_API_URL,
  getToken: () => app.container.use('auth').getToken(),
  refresh: () => app.container.use('auth').refresh(),
})
```

Every request sends `Authorization: Bearer <token>`. On a `401`, the client calls `refresh()` once and retries; when refresh fails, the user is signed out and the request rejects with `UNAUTHORIZED`. The typed [API client](/packages/api) takes the same `getToken` option.

`auth.getToken()` resolves `null` for adapters without tokens, such as Better Auth, whose cookie the browser sends for you.

## Protect pages

Pages are guarded in `beforeLoad` with `requireAuth()` from [Router](/packages/router). It reads `session` from the router context and redirects anonymous visitors.

`kitr add auth` puts the live session in the router context for you. This is `app/router.tsx` after it runs:

```tsx
// app/router.tsx
import type { Session } from '@kitr/auth'
import { createKitrRouter } from '@kitr/router'
import type { User } from '#app/abilities'
import { app } from './app'
import { routes } from './routes'

export function getRouter() {
  return createKitrRouter({
    routes,
    app,
    context: {
      // A live getter, so requireAuth() sees the session the auth provider restores during boot.
      get session() {
        const auth = app.container.has('auth') ? app.container.use('auth') : null
        return (auth?.session ?? null) as Session<User> | null
      },
    },
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}

declare module '@kitr/router' {
  interface KitrRouterContext {
    session: Session<User> | null
  }
}
```

Then guard a layout route. Every page under `_app` needs a signed-in user:

```ts
// app/routes.ts
import { requireAuth } from '@kitr/router'

r.layout('_app', {
  beforeLoad: requireAuth(),
}, (app) => app.page('/projects', { lazy: () => import('./pages/projects') }))
```

An anonymous visitor to `/projects` goes to `/sign-in`, with the `redirect` search parameter set to `/projects`. The sign-in page above sends them back after they sign in. `requireAuth({ to: '/login', redirectParam: 'next' })` changes the path and the parameter name; `redirectParam: false` leaves the parameter off.

The router may copy its context object when it is created, which reads the getter once. When the session changes after the router exists, read it from the container in the guard so it is always current:

```ts
// app/routes.ts
import type { Session } from '@kitr/auth'
import { requireAuth } from '@kitr/router'
import type { User } from '#app/abilities'

r.layout('_app', {
  beforeLoad: async ({ context, location }) => {
    await context.app.boot()
    const session = context.app.container.use('auth').session as Session<User>
    return requireAuth()({ context: { session }, location })
  },
}, (app) => app.page('/projects', { lazy: () => import('./pages/projects') }))
```

The `saas` kit uses this form. With tokens in `localStorage` the server can't see the session, so run guarded routes on the client only, for example with `ssrRoute(false)` from [SEO](/packages/seo).

## Render by auth state on one URL

Some pages exist for everyone but look different signed in: the home page is a landing for guests and a feed for members. A redirect to `/sign-in` is the wrong tool there; `<Authed>`, `<Guest>` and `authBranch()` render by the live session instead, on the same URL, so deep links, the back button and crawlers see one route:

```ts
// app/routes.ts
r.page('/', { lazy: () => import('./pages/home') })
```

```tsx
// app/pages/home.tsx
import { authBranch } from '@kitr/auth'
import { Feed } from '#app/components/feed'
import { Landing } from '#app/components/landing'

export default authBranch({ authed: Feed, guest: Landing })
```

```tsx
// app/components/comment-box.tsx
import { Authed, Guest } from '@kitr/auth'
import { Link } from '@tanstack/react-router'

export function CommentBox() {
  return (
    <>
      <Authed>
        <textarea placeholder="Write a comment" />
      </Authed>
      <Guest>
        <Link to="/sign-in">Sign in to comment</Link>
      </Guest>
    </>
  )
}
```

Both components take a `fallback` for the other state. They re-render on sign-in and sign-out, so a guest who signs in from a sheet sees the member view behind it at once. Keep `requireAuth()` for pages that must not render at all without a user; use these for pages that serve both.

## Cookies on the web, tokens in native shells

An SSR web app wants a cookie session: the server reads it on the first request and the page renders signed in. A phone or desktop shell has no cookie jar worth trusting across restarts and wants a bearer token in secure storage. One config serves both by picking the adapter per platform at build time:

```ts
// config/auth.ts
import { betterAuthAdapter, defineConfig, localStorageTokens, tokenAdapter } from '@kitr/auth'
import { forPlatform } from '@kitr/platform'
import { authClient } from '#app/auth-client'

export default defineConfig({
  adapter: forPlatform({
    // Web builds: the Better Auth cookie session, read on the server too.
    web: betterAuthAdapter(authClient),
    // Native shells: a bearer token the API issues, kept across restarts.
    default: tokenAdapter({
      storage: localStorageTokens('acme:token'),
      fetchUser: async (token) => {
        const response = await fetch('https://api.acme.com/me', {
          headers: { authorization: `Bearer ${token}` },
        })
        return response.ok ? response.json() : null
      },
      signIn: async (credentials) => {
        const response = await fetch('https://api.acme.com/sign-in', {
          method: 'POST',
          body: JSON.stringify(credentials),
        })
        return response.json()
      },
    }),
  }),
})
```

`forPlatform()` resolves from `KITR_PLATFORM_TYPE` when the bundle is built, so the phone bundle never contains the cookie adapter and the web bundle never contains the token one. On the server side, `@kitr/auth/server` middleware accepts both a cookie and a bearer header, so the same API serves every build. Swap `localStorageTokens()` for a storage backed by `@kitr/secure-storage` to keep the token in the OS keychain.

## Define permissions

Write each rule once, as a function of the user and an optional subject, in `app/abilities.ts`:

```ts
// app/abilities.ts
import { defineAbilities } from '@kitr/auth'

export interface User {
  id: string
  email: string
  role: 'admin' | 'member'
  teamId: string
}

export interface Project {
  id: string
  ownerId: string
  teamId: string
}

export const abilities = defineAbilities({
  'projects.update': (user: User, project: Project) => user.role === 'admin' || project.ownerId === user.id,
  'projects.view': (user: User, project: Project) => project.teamId === user.teamId,
  'invoices.view': (user: User) => user.role === 'admin',
  'teams.invite': (user: User) => user.role === 'admin',
})
```

Annotate `user` in each rule and leave off the type argument. TypeScript then knows the ability names, so `abilities.can(user, 'projects.updte')` fails to compile. `defineAbilities<User>({...})` also works, but the names widen to `string`.

Check a rule anywhere, on the client or the server:

```ts
// app/lib/projects/permissions.ts
import { abilities, type Project, type User } from '#app/abilities'

const ada: User = { id: 'u_ada', email: 'ada@acme.com', role: 'admin', teamId: 't_core' }
const grace: User = { id: 'u_grace', email: 'grace@acme.com', role: 'member', teamId: 't_core' }
const roadmap: Project = { id: 'p_roadmap', ownerId: 'u_ada', teamId: 't_core' }

abilities.can(ada, 'projects.update', roadmap)
// => true
abilities.can(grace, 'projects.update', roadmap)
// => false
abilities.can(null, 'projects.view', roadmap)
// => false

const graceCan = abilities.for(grace)
graceCan('projects.view', roadmap)
// => true
```

Three rules hold for every check: an anonymous user (`null` or `undefined`) never passes, an ability that doesn't exist returns `false`, and a rule that throws returns `false`.

## Check permissions in components

`useCan()` returns the session's `can`, bound to the signed-in user. Use it to hide what the user can't do:

```tsx
// app/components/projects/project-header.tsx
import { useCan } from '@kitr/auth'
import type { Project } from '#app/abilities'

export function ProjectHeader({ project }: { project: Project }) {
  const can = useCan()
  return (
    <header>
      <h1>Roadmap</h1>
      {can('projects.update', project) && <button type="button">Edit project</button>}
      {can('teams.invite') && <button type="button">Invite to team</button>}
    </header>
  )
}
```

Grace sees "Edit project" on her own projects only; Ada sees both buttons everywhere. Hiding a button is not security: check the same ability on the server too (see "Protect API routes").

## Check permissions on routes

`can()` from [Router](/packages/router) blocks a page for users without an ability. It reads `context.session` like `requireAuth()`:

```ts
// app/routes.ts
import { can } from '@kitr/router'

app.page('/invoices', {
  beforeLoad: can('invoices.view'),
  lazy: () => import('./pages/invoices'),
})
```

```tsx
// app/pages/invoices.tsx
export default () => <h1>Invoices</h1>
```

Grace gets the route's error screen with a `FORBIDDEN` error, `Missing permission "invoices.view"`. Pass `{ to: '/' }` to redirect instead, or `{ subject }` to check against one record. Don't confuse it with `can` from `@kitr/auth/server`, which is API middleware.

## Use the session outside components

The provider binds the `auth` service in the container. Use it in loaders, stores and services:

```ts
// app/lib/projects/loaders.ts
import { app } from '#app/app'

const auth = app.container.use('auth')

auth.user
// => { id: 'u_ada', email: 'ada@acme.com', role: 'admin', teamId: 't_core' }
auth.session.can('invoices.view')
// => true

const stop = auth.subscribe((session) => {
  console.log(session.user ? `signed in as ${(session.user as { email: string }).email}` : 'signed out')
})
await auth.signOut()
// logs: signed out
stop()
```

| Member | Description |
| --- | --- |
| `session` | The current session; anonymous is `{ user: null, can: () => false }`. |
| `user` | `session.user`. |
| `load()` | Asks the adapter for the session again. Errors become an anonymous session. |
| `signIn(credentials)` | Signs in and resolves with the session. |
| `signOut()` | Signs out and clears the local session. |
| `refresh()` | Refreshes tokens; resolves `false` and signs out when it can't. |
| `getToken()` | The bearer token, or `null`. |
| `subscribe(listener)` | Calls `listener(session)` on every change, once per change. Returns an unsubscribe function. |
| `toContext()` | `{ session }` with a live getter, for router context. |
| `adapter` | The adapter from the config. |

With `eager: false`, the session stays anonymous until something calls `auth.load()`, such as a guard on the first protected route. Use it when the session check is slow and most pages are public.

## Protect API routes

On the server, `authMiddleware` from `@kitr/auth/server` reads the token, finds the user and puts them on `ctx.locals`. It works with any [API routes](/packages/api) router:

```ts
// server/routes.ts
import { defineRoutes } from '@kitr/api'
import { authMiddleware } from '@kitr/auth/server'
import { abilities, type User } from '#app/abilities'
import ProjectsController from '#server/controllers/projects-controller'
import { findUserByToken } from '#server/services/sessions'

const auth = authMiddleware<User>({ verify: (token) => findUserByToken(token), abilities })

export const routes = defineRoutes((router) =>
  router.group({ prefix: '/api', middleware: [auth] }, (api) =>
    api.resource('projects', ProjectsController),
  ),
)

export type AppRoutes = typeof routes.$types
```

A request without a token, or with one `verify` rejects, answers `401`:

```json
{ "code": "UNAUTHORIZED", "message": "Authentication required", "status": 401 }
```

| Option | Default | Description |
| --- | --- | --- |
| `verify` | required | `(token, ctx) => user or null`. Look the token up, or verify a JWT. May be async. |
| `from` | `'bearer'` | `'bearer'` reads `Authorization: Bearer <token>`; `{ cookie: 'name' }` reads a cookie. |
| `optional` | `false` | Let anonymous requests through with `ctx.locals.user = null`. |
| `abilities` | none | Your abilities, for `ctx.locals.can`. Without it, `can()` is true for any signed-in user. |

Import the same `abilities` from `app/abilities.ts` on both sides, so the browser and the API agree on every rule.

## Read the user in a controller

`requireUser(ctx)` returns the user `authMiddleware` set, typed, or throws `401`. `currentUser(ctx)` returns `null` instead, for routes with `optional: true`:

```ts
// server/controllers/projects-controller.ts
import type { HttpContext } from '@kitr/api'
import { KitrError } from 'kitr/app'
import { currentUser, requireUser } from '@kitr/auth/server'
import { abilities, type Project, type User } from '#app/abilities'

const projects = new Map<string, Project>([['p_roadmap', { id: 'p_roadmap', ownerId: 'u_ada', teamId: 't_core' }]])

export default class ProjectsController {
  async index(ctx: HttpContext) {
    const user = currentUser<User>(ctx)
    return [...projects.values()].filter((project) => abilities.can(user, 'projects.view', project))
  }

  async update(ctx: HttpContext<{ id: string }>) {
    const user = requireUser<User>(ctx)
    const project = projects.get(ctx.params.id)
    if (!project) throw KitrError.notFound('Project')
    if (!abilities.can(user, 'projects.update', project)) throw KitrError.forbidden()
    return { ...project, updatedBy: user.id }
  }
}
```

`authMiddleware` also sets `ctx.locals.can(ability, subject)`, bound to the request's user, for code that has the context but not the user.

## Require a permission on an API route

`can()` from `@kitr/auth/server` is middleware. It loads the subject from the context, checks the ability, and answers `403` before the handler runs:

```ts
// server/routes.ts
import { defineRoutes } from '@kitr/api'
import { authMiddleware, can } from '@kitr/auth/server'
import { abilities, type User } from '#app/abilities'
import InvoicesController from '#server/controllers/invoices-controller'
import ProjectsController from '#server/controllers/projects-controller'
import { findProject } from '#server/services/projects'
import { findUserByToken } from '#server/services/sessions'

const auth = authMiddleware<User>({ verify: (token) => findUserByToken(token), abilities })

export const routes = defineRoutes((router) =>
  router.group({ prefix: '/api', middleware: [auth] }, (api) =>
    api
      .get('/invoices', [InvoicesController, 'index'], {
        name: 'invoices.index',
        middleware: [can('invoices.view')],
      })
      .patch('/projects/:id', [ProjectsController, 'update'], {
        name: 'projects.update',
        middleware: [can('projects.update', (ctx) => findProject(ctx.params.id))],
      }),
  ),
)

export type AppRoutes = typeof routes.$types
```

Grace calling `GET /api/invoices` gets:

```json
{ "code": "FORBIDDEN", "message": "Missing permission \"invoices.view\"", "status": 403 }
```

Put `can()` after `authMiddleware`; on its own it finds no user and answers `403` for everyone.

## Read the session from a cookie

For cookie sessions, such as a cookie your sign-in endpoint sets, read the token from the cookie by name:

```ts
// server/middleware/auth.ts
import { authMiddleware } from '@kitr/auth/server'
import { abilities, type User } from '#app/abilities'
import { findUserBySession } from '#server/services/sessions'

export const auth = authMiddleware<User>({
  from: { cookie: 'acme_session' },
  verify: (sessionId) => findUserBySession(sessionId),
  abilities,
})

export const optionalAuth = authMiddleware<User>({
  from: { cookie: 'acme_session' },
  optional: true,
  verify: (sessionId) => findUserBySession(sessionId),
  abilities,
})
```

The cookie value is URL-decoded before `verify` sees it. A malformed value counts as no cookie, not as a server error. Use `optionalAuth` on public pages that show more to signed-in users, such as a project page with an edit link for its owner.

> **Warning**
> Cookie sessions need CSRF protection on writes, because the browser sends the cookie with requests other sites trigger. Turn on CSRF in [Shield](/packages/shield).

## Cookie sessions with a server

Bearer tokens suit a single-page app in front of an API that issues them. When the app has a kitr server and renders pages on the server, use cookie sessions instead: the session is an HttpOnly cookie the browser cannot read, guarded pages render on the server with the signed-in user's data in the first response, and no token sits in `localStorage` for a script to steal.

```sh
kitr add auth --provider session
```

| Use | When |
| --- | --- |
| `--provider token` (the default) | A single-page app or native shell talking to an API that issues tokens. |
| `--provider session` | The app has a kitr server (`kitr add server`) and server-rendered pages. The `saas` kit uses it. |
| `--provider better-auth` | You want Better Auth's server, plugins and social sign-in. Its guards run in the browser only. |

`--provider session` writes `server/auth.ts` (the session service and the user provider), `server/controllers/auth_controller.ts`, the `/api/auth/*` routes in `server/routes.ts`, a sign-in page, `config/auth.ts` over `sessionAdapter`, and wraps page rendering in `app/server.ts` with `runWithSession`. With `@kitr/mail` installed it also writes the verification and reset emails (`--no-emails` skips them). Set `SESSION_SECRET` (at least 32 random characters, `openssl rand -base64 32`) and `APP_URL`; production refuses to boot without the secret.

### Sessions and stores

```ts
// server/auth.ts
import { createCookieSession, createMemorySessionStore } from '@kitr/auth/server'

export const sessions = createCookieSession({
  secret: process.env.SESSION_SECRET!,
  store: createMemorySessionStore(),
})
```

The cookie holds a signed random session id. It is `HttpOnly`, `SameSite=Lax`, and `Secure` in production. A session lasts seven days without use (`maxAge`) and thirty days at most (`absoluteMaxAge`). Signing in issues a new id.

`sessions.revoke(id)` ends one session and `sessions.revokeAll(userId)` ends all of a user's. To rotate the secret, pass an array: the first signs, all verify.

Where sessions live is a `SessionStore`:

| Store | For |
| --- | --- |
| `createMemorySessionStore()` | One process, development and tests. Lost on restart. |
| `createStorageSessionStore(driver)` | Any `@kitr/storage` driver (`get`, `set`, `remove`, `keys`). Drivers have no expiry, so an expired record is dropped when read. |
| `createRedisSessionStore(redis)` | Several instances. Takes an `ioredis` client; keys expire with the session. |

### Passwords and users

`hashPassword(password)` returns a self-describing string (scrypt through `node:crypto`, with a PBKDF2-SHA256 600,000 round fallback on runtimes without scrypt). `verifyPassword(password, hash)` compares in constant time and never throws on a malformed hash. `needsRehash(hash)` says when to upgrade a stored hash after a successful sign-in.

Users come from a `UserProvider`: `findByEmail`, `findById`, `create`, and optionally `setPasswordHash` and `markEmailVerified`. `createMemoryUserProvider` is the demo implementation (the kit seeds `admin@example.com` and `member@example.com`, password `password`). Implement the interface over your database and swap it in `server/auth.ts`.

### The controller

`createSessionController({ sessions, users, mail, appUrl })` returns a controller with `session`, `signIn`, `signUp`, `signOut`, `signOutAll`, `requestVerification`, `verifyEmail`, `requestPasswordReset` and `resetPassword`. Every state-changing method checks the CSRF token (the `kitr-csrf` cookie echoed in `x-csrf-token`, which [Shield](/packages/shield) sets and the typed `api` client sends), unknown emails and wrong passwords take the same time and give the same answer, and links in emails point at `appUrl`, never at the `Host` header. A reset link works once and ends every session of the account.

### Guards on the server

In a route that renders on the server, load the session first:

```ts
// app/routes.ts
import { ensureSession } from '@kitr/auth'
import { requireAuth } from '@kitr/router'

.layout('_app', {
  beforeLoad: async (ctx) => {
    await ensureSession(ctx)
    await requireAuth()(ctx)
  },
  lazy: () => import('./pages/app-layout'),
})
```

On the server, `ensureSession` reads the session of the request being rendered. In the browser it asks `GET /api/auth/session` once and caches the answer. Don't return the guard's result from `beforeLoad` in a server-rendered route: it holds functions, which cannot be sent to the page.

For API routes, `sessionMiddleware(auth)` answers `401` without a session, and `getRequestUser()` reads the user anywhere in the request.

## Errors

| Code | When | What to do |
| --- | --- | --- |
| `UNAUTHORIZED` (401) | `authMiddleware` found no token or `verify` returned `null`; `requireUser()` found no user. Message: `Authentication required`. | Sign in, or send the token with `getToken`. |
| `FORBIDDEN` (403) | `can()` middleware or the router's `can()` guard failed. Message: `Missing permission "<ability>"`. | Check the user's role, or hide the action with `useCan()`. |
| `UNAUTHORIZED` (401) | `tokenAdapter`'s `signIn` returned a token, but neither it nor `fetchUser` returned a user. Message: `Sign-in succeeded but no user was returned`. Stored tokens are cleared. | Make `/me` accept the new token, or return `user` from `signIn`. |
| `UNAUTHORIZED` (401) | `betterAuthAdapter` signed in but Better Auth has no session. Message: `Sign-in failed`. | Check Better Auth's cookie settings and base URL. |
| `INTERNAL` (500) | `signIn()` on a `tokenAdapter` without `signIn` (`tokenAdapter: signIn not configured`), or a `betterAuthAdapter` with no email sign-in (`betterAuthAdapter: no signIn configured`). | Configure `signIn` on the adapter. |

`auth.signIn()` on a custom adapter without `signIn` throws a plain `Error`: `[@kitr/auth] adapter has no signIn`. Errors your own `signIn` throws, such as `Invalid credentials` in the generated config, reach the caller unchanged. Throw `KitrError.unauthorized('Wrong email or password')` from `kitr/app` instead to get a kitr error with a `401` status.

## Testing

Test with a fake adapter: `customAdapter` with an in-memory user, booted with `createTestApp` from [Testing](/packages/testing). No network, no storage:

```tsx
// test/auth.test.tsx
import { act, screen } from '@testing-library/react'
import { createSession, customAdapter, useCan, useUser } from '@kitr/auth'
import authProvider from '@kitr/auth/provider'
import { createTestApp } from '@kitr/testing'
import { renderWithKitr } from '@kitr/testing/react'
import { describe, expect, it } from 'vitest'
import { abilities, type User } from '#app/abilities'

const ada: User = { id: 'u_ada', email: 'ada@acme.com', role: 'admin', teamId: 't_core' }
const grace: User = { id: 'u_grace', email: 'grace@acme.com', role: 'member', teamId: 't_core' }

function fakeAdapter(start: User | null) {
  let current = start
  const people: Record<string, User> = { 'ada@acme.com': ada, 'grace@acme.com': grace }
  return customAdapter<User, { email: string }>({
    getSession: async () => (current ? createSession(current, abilities) : null),
    signIn: async ({ email }) => {
      current = people[email] ?? null
      if (!current) throw new Error('Wrong email or password')
      return createSession(current, abilities)
    },
    signOut: async () => {
      current = null
    },
  })
}

function InvoicesLink() {
  const user = useUser<User>()
  const can = useCan()
  if (!user) return <p>Signed out</p>
  return <p>{can('invoices.view') ? `${user.email} sees invoices` : `${user.email} has no invoices`}</p>
}

describe('auth', () => {
  it('restores the session on boot', async () => {
    const app = await createTestApp({ providers: [authProvider], config: { auth: { adapter: fakeAdapter(ada) } } })
    expect(app.container.use('auth').user).toEqual(ada)
  })

  it('follows sign-in and sign-out in components', async () => {
    const app = await createTestApp({ providers: [authProvider], config: { auth: { adapter: fakeAdapter(null) } } })
    renderWithKitr(<InvoicesLink />, { app })
    expect(screen.getByText('Signed out')).toBeTruthy()

    await act(() => app.container.use('auth').signIn({ email: 'grace@acme.com' }))
    expect(screen.getByText('grace@acme.com has no invoices')).toBeTruthy()

    await act(() => app.container.use('auth').signOut())
    await act(() => app.container.use('auth').signIn({ email: 'ada@acme.com' }))
    expect(screen.getByText('ada@acme.com sees invoices')).toBeTruthy()
  })

  it('rejects unknown people', async () => {
    const app = await createTestApp({ providers: [authProvider], config: { auth: { adapter: fakeAdapter(null) } } })
    await expect(app.container.use('auth').signIn({ email: 'linus@acme.com' })).rejects.toThrow('Wrong email or password')
    expect(app.container.use('auth').user).toBeNull()
  })
})
```

Test the server middleware by calling it with a minimal context. It needs only `request.header()` and `locals`:

```ts
// test/auth-middleware.test.ts
import { authMiddleware, can, requireUser } from '@kitr/auth/server'
import { describe, expect, it } from 'vitest'
import { abilities, type User } from '#app/abilities'

const grace: User = { id: 'u_grace', email: 'grace@acme.com', role: 'member', teamId: 't_core' }
const auth = authMiddleware<User>({ verify: (token) => (token === 'tok_grace' ? grace : null), abilities })

const ctx = (authorization: string | null) => ({
  request: { header: (name: string) => (name === 'authorization' ? authorization : null) },
  locals: {} as Record<string, unknown>,
})

describe('auth middleware', () => {
  it('rejects a request without a token', async () => {
    await expect(auth(ctx(null), async () => 'handler')).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 })
  })

  it('sets the user for a valid token', async () => {
    const request = ctx('Bearer tok_grace')
    expect(await auth(request, async () => 'handler')).toBe('handler')
    expect(requireUser<User>(request).email).toBe('grace@acme.com')
  })

  it('blocks members from invoices', async () => {
    const request = ctx('Bearer tok_grace')
    await auth(request, async () => null)
    await expect(can('invoices.view')(request, async () => 'handler')).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Missing permission "invoices.view"',
    })
  })
})
```

For full request tests through the server, send `authorization: Bearer <token>` with `createTestClient(server, { headers })` from [Testing](/packages/testing).

## Extend

Write an adapter when your identity provider has its own client, such as Firebase, Clerk or a company SSO. An adapter implements the `AuthAdapter` interface; see [`AuthAdapter`](/packages/auth/api) in the API reference:

| Member | Required | Description |
| --- | --- | --- |
| `getSession()` | yes | Resolves the current session, or `null` when anonymous. Called on boot and by `auth.load()`. |
| `signIn(credentials)` | no | Signs in and resolves the new session. |
| `signOut()` | no | Ends the session at the provider. |
| `refresh()` | no | Renews tokens; resolves `true` when the session is still valid. |
| `getToken()` | no | A bearer token for API calls, or `null`. |
| `onChange(listener)` | no | Reports changes from elsewhere, such as another tab. Returns an unsubscribe function. |

An adapter for Acme's single sign-on service, which keeps the session in another tab-aware client:

```ts
// app/auth/acme_sso_adapter.ts
import { type Abilities, type AuthAdapter, createSession } from '@kitr/auth'

interface AcmeSsoClient {
  currentUser(): Promise<{ id: string; email: string; role: 'admin' | 'member'; teamId: string } | null>
  login(options: { email: string }): Promise<void>
  logout(): Promise<void>
  accessToken(): Promise<string | null>
  onAuthStateChanged(listener: (user: unknown) => void): () => void
}

export function acmeSsoAdapter<TUser>(
  client: AcmeSsoClient,
  abilities?: Abilities<TUser, any>,
): AuthAdapter<TUser, { email: string }> {
  const toSession = (user: unknown) => (user ? createSession(user as TUser, abilities) : null)
  return {
    getSession: async () => toSession(await client.currentUser()),
    async signIn({ email }) {
      await client.login({ email })
      const session = toSession(await client.currentUser())
      if (!session) throw new Error('Single sign-on did not return a user')
      return session
    },
    signOut: () => client.logout(),
    getToken: () => client.accessToken(),
    onChange: (listener) => client.onAuthStateChanged((user) => listener(toSession(user))),
  }
}
```

Register it in the config like any adapter:

```ts
// config/auth.ts
import { defineConfig } from '@kitr/auth'
import { type User, abilities } from '#app/abilities'
import { acmeSsoAdapter } from '#app/auth/acme_sso_adapter'
import { ssoClient } from '#app/auth/sso_client'

export default defineConfig({ adapter: acmeSsoAdapter<User>(ssoClient, abilities) })
```

Use `createSession(user, abilities, { expiresAt })` to build sessions, so `can()` follows your abilities. When `onChange` and `signIn` report the same session, listeners still run once.

## Devtools

With [Devtools](/packages/devtools) installed, the Auth panel shows the session status (authenticated or anonymous), the user as JSON and `expiresAt`. Its badge reads `in` or `out`. Three actions run against the live app: Reload session (`auth.load()`), Refresh token (`auth.refresh()`) and Sign out. Every sign-in and sign-out is logged on the timeline as `signed in` or `signed out`, with the user.

## Next steps

- [API reference](/packages/auth/api)
- [Router](/packages/router): `requireAuth()`, `can()` and route context
- [API routes](/packages/api): the routes `authMiddleware` protects
- [HTTP](/packages/http): sending the token and refreshing on `401`
- [Better Auth documentation](https://www.better-auth.com/docs)
- [Build a full-stack app](/guides/fullstack-app)
