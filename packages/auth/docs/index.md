---
title: Auth
description: Sign users in and out, protect pages, and check who can do what.
order: 1
---

# Auth

Almost every app has two questions to answer on every screen: *who is this?* and *are they allowed to do that?* `kitr/auth` answers both, in the browser and on the server, with the same rules in both places.

It doesn't store passwords or run a login server. It connects to whatever you already use, such as your own API's token endpoint or [Better Auth](https://www.better-auth.com), through an **adapter**, and gives the rest of the app one session to read.

## Install

```sh
kitr add auth
```

This installs `@kitr/auth`, registers its provider, and writes two files:

- `config/auth.ts`, with a token adapter pointed at your API's `/sign-in` and `/me` endpoints
- `app/abilities.ts`, where your permission rules live

## Pick an adapter

### Your own API with tokens

```ts
// config/auth.ts
import { defineConfig, localStorageTokens, tokenAdapter } from 'kitr/auth'
import { abilities, type User } from '#app/abilities'
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
    if (!res.ok) throw new Error('Invalid credentials')
    return (await res.json()) as { token: string; refreshToken?: string }
  },
})

export default defineConfig({ adapter, signInPath: '/sign-in' })
```

Tokens are kept in memory by default, which is safest but signs the user out on reload. `localStorageTokens()` keeps them across reloads. Add `refresh` to swap an expired token for a new one.

### Better Auth

```ts
import { createAuthClient } from 'better-auth/react'
import { betterAuthAdapter, defineConfig } from 'kitr/auth'

export default defineConfig({ adapter: betterAuthAdapter<User>(createAuthClient(), { abilities }) })
```

### Anything else

`customAdapter({ getSession, signIn, signOut, refresh, getToken })` accepts whichever of those functions you have. Only `getSession` is required.

## Sign in and out

```tsx
import { useAuth, useUser } from 'kitr/auth'

function AccountMenu() {
  const auth = useAuth()
  const user = useUser<User>()
  if (!user) return <Link to="/sign-in">Sign in</Link>
  return <button type="button" onClick={() => auth.signOut()}>Sign out {user.email}</button>
}
```

`auth.signIn(credentials)` resolves with the new session. Components using `useSession`, `useUser` or `useCan` re-render on every change.

## Protect pages

Put a guard on a layout route and every page under it requires a signed-in user:

```ts
// app/routes/_app.tsx
import { createFileRoute, requireAuth } from 'kitr/router'

export const Route = createFileRoute('/_app')({ beforeLoad: requireAuth() })
```

Anonymous visitors go to `/sign-in?redirect=<where they were going>`. After signing in, send them back with `router.history.push(search.redirect ?? '/')`.

## Permissions

Write each rule once, as a plain function:

```ts
// app/abilities.ts
import { defineAbilities } from 'kitr/auth'

export interface User { id: string; email: string; role: 'admin' | 'member' }

export const abilities = defineAbilities<User>({
  'projects.update': (user, project: { ownerId: string }) =>
    user.role === 'admin' || project.ownerId === user.id,
  'billing.view': (user) => user.role === 'admin',
})
```

Then check it wherever you need it:

```tsx
// Hide a button
const can = useCan()
{can('projects.update', project) && <EditButton />}

// Block a page: shows the route's error screen, or redirects with { to }
export const Route = createFileRoute('/_app/billing')({ beforeLoad: can('billing.view') })
```

Anonymous users never pass a check.

## On the server

The same abilities protect your [API](/packages/api). `authMiddleware` reads the token, finds the user and puts them on `ctx.locals`:

```ts
// start/routes.ts
import { KitrError } from 'kitr/app'
import { defineRoutes } from 'kitr/api'
import { authMiddleware, requireUser } from 'kitr/auth/server'
import { abilities } from '#app/abilities'

const auth = authMiddleware<User>({ verify: (token) => users.findByToken(token), abilities })

export const routes = defineRoutes((router) =>
  router.group({ prefix: '/api', middleware: [auth] }, (api) =>
    api.patch('/projects/:id', async (ctx) => {
      const user = requireUser<User>(ctx)
      const project = await projects.find(ctx.params.id)
      if (!abilities.can(user, 'projects.update', project)) throw KitrError.forbidden()
      return projects.update(project.id, ctx.body)
    }),
  ),
)
```

Read the token from a cookie instead with `from: { cookie: 'session' }`, or let anonymous requests through with `optional: true`. `kitr/auth/server` has no React dependency.

## With the HTTP client

Point [HTTP](/packages/http) at the session so every request carries the token and refreshes it once on a `401`:

```ts
// config/http.ts
import { defineConfig } from 'kitr/http'
import { app } from '#app/app'
import { env } from '#app/env'

export default defineConfig({
  baseUrl: env.VITE_API_URL,
  getToken: () => app.container.use('auth').getToken(),
  refresh: () => app.container.use('auth').refresh(),
})
```

## Next steps

- [API reference](/packages/auth/api)
