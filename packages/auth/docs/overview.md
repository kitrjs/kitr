---
title: Overview
description: Sign users in and out, protect pages, and check who can do what.
order: 0
---

# Auth

Almost every screen in an app asks two questions: who is this, and are they allowed to do that? The answers tend to be scattered: a session hook here, a route guard there, a permission check in the API written differently from the one in the component. When they disagree, a page shows a button the server then refuses.

`@kitr/auth` answers both questions once, in the browser and on the server, with the same rules in both places.

## What it is

`@kitr/auth` gives the app one session to read, guards for pages, middleware for API routes and permission checks written once as plain functions. A component asks the session hooks or `useCan()`; a route asks `requireAuth()` or `can()`; a controller asks the same ability, defined once with `defineAbilities`. Tokens are stored where the platform keeps them safest and refreshed when they expire.

It does not store passwords or run a login server. It connects to what you already have through an adapter: your own API's token endpoint, [Better Auth](https://www.better-auth.com/docs), or any identity provider that returns a session. The session, hooks and adapters run in the browser. `@kitr/auth/server` runs on the server with no React dependency, so a pure backend can protect its routes with it alone.

## Install

```sh
kitr add auth
```

This installs `@kitr/auth`, registers the provider in `kitrrc.ts`, writes `config/auth.ts` with the token adapter and `app/abilities.ts` for your permissions. The guide's [Install](/packages/auth/guide#install) section lists every change and the adapter flags.

## Quick start

Every component can read the session. Show the signed-in user and a sign-out button:

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

Before sign-in it shows "Sign in"; after Ada signs in it shows "Sign out ada@acme.com", and it re-renders on every sign-in and sign-out anywhere in the app. Protect a page with one line in the route table:

```ts
// app/routes.ts
r.page('/settings', { beforeLoad: requireAuth(), lazy: () => import('./pages/settings') })
```

The guide continues from here: [Show who is signed in](/packages/auth/guide#show-who-is-signed-in).

## Built on

`@kitr/auth` has no identity provider of its own. It is built on three things kitr already has:

| Built on | Role |
| --- | --- |
| An auth adapter you choose | Signs in, signs out and refreshes. Better Auth and a generic token adapter are built in; the [Extend](/packages/auth/guide#extend) section shows a custom one. |
| [Storage](/packages/storage) and [Secure storage](/packages/secure-storage) | Cookies on the web, the device vault in native shells, so the session survives a reload. |
| [Router](/packages/router) and [API routes](/packages/api) | `requireAuth`, `can` and `guards` run in `beforeLoad`; `authMiddleware` runs in front of controllers. |

kitr adds the session store, the permission model (abilities as functions of user and record), the React hooks, the router guards, the server middleware and the token plumbing for [http](/packages/http).

## Problems it solves

- **Showing who is signed in.** The session hooks give every component the user, loading state and sign-in status. See [Show who is signed in](/packages/auth/guide#show-who-is-signed-in).
- **Sessions lost on reload.** The session is saved and restored, and expired tokens refresh once before a request fails. See [Keep users signed in across reloads](/packages/auth/guide#keep-users-signed-in-across-reloads).
- **Pages anyone can open.** `requireAuth()` redirects to sign-in and back again afterwards. See [Protect pages](/packages/auth/guide#protect-pages).
- **Permission logic duplicated in UI and API.** Abilities are plain functions, checked in components, routes and controllers alike. See [Define permissions](/packages/auth/guide#define-permissions).
- **Cookies on the web, tokens in apps.** The same code uses an httpOnly cookie in the browser and a token in the device vault in native shells. See [Cookies on the web, tokens in native shells](/packages/auth/guide#cookies-on-the-web-tokens-in-native-shells).
- **API routes without a user.** `authMiddleware` reads the session from a cookie or bearer token and puts the user on the request. See [Protect API routes](/packages/auth/guide#protect-api-routes).

## Further reading

- [Guide](/packages/auth/guide): install, configure and every task.
- [API reference](/packages/auth/api): every export with its signature.
- [Better Auth documentation](https://www.better-auth.com/docs): the sign-in server the built-in adapter talks to.
- [Router](/packages/router), [API routes](/packages/api) and [HTTP](/packages/http): where the guards, middleware and token headers plug in.
- [Add sign-in, end to end](/guides/authentication): the guide that wires auth into a full app.
