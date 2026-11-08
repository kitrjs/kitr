---
title: Overview
description: Sign users in and out, protect pages, and check who can do what.
order: 0
---

# Auth

## What it is

`@kitr/auth` gives the app one session, guards for pages, middleware for API routes and permissions written once as plain functions. Tokens are stored where the platform keeps them safest.

`@kitr/auth/server` runs without React and brings the server half: `createCookieSession` (signed HttpOnly cookies over a memory, storage or Redis store), `hashPassword` and `verifyPassword`, a `UserProvider` you implement over your database (a memory one for demos), and `createSessionController` for sign-in, sign-out, sign-up, password reset and email verification. Or connect to [Better Auth](https://www.better-auth.com/docs) or any identity provider through an adapter; there is no hosted sign-in service to subscribe to.

## Install

```sh
kitr add auth
```

Adds `@kitr/auth`, its provider, `config/auth.ts` and `app/abilities.ts`. The guide's [Install](/packages/auth/guide#install) section lists the adapter flags.

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

Next in the guide: [Show who is signed in](/packages/auth/guide#show-who-is-signed-in).

## Built on

`@kitr/auth` has no identity provider of its own. It is built on three things kitr already has:

| Built on | Role |
| --- | --- |
| An auth adapter you choose | Signs in, signs out and refreshes. Better Auth and a generic token adapter are built in; the [Extend](/packages/auth/guide#extend) section shows a custom one. |
| [Storage](/packages/storage) and [Secure storage](/packages/secure-storage) | Cookies on the web, the device vault in native shells, so the session survives a reload. |
| [Router](/packages/router) and [API routes](/packages/api) | `requireAuth`, `can` and `guards` run in `beforeLoad`; `authMiddleware` runs in front of controllers. |

kitr adds the session store, abilities, the React hooks, the router guards, the server middleware and the token plumbing for [http](/packages/http).

## Problems it solves

- **Showing who is signed in.** [Show who is signed in](/packages/auth/guide#show-who-is-signed-in).
- **Sessions lost on reload.** [Keep users signed in across reloads](/packages/auth/guide#keep-users-signed-in-across-reloads).
- **Pages anyone can open.** [Protect pages](/packages/auth/guide#protect-pages).
- **Permission logic duplicated in UI and API.** [Define permissions](/packages/auth/guide#define-permissions).
- **Cookies on the web, tokens in apps.** [Cookies on the web, tokens in native shells](/packages/auth/guide#cookies-on-the-web-tokens-in-native-shells).
- **API routes without a user.** [Protect API routes](/packages/auth/guide#protect-api-routes).

## Further reading

- [Guide](/packages/auth/guide).
- [API reference](/packages/auth/api).
- [Better Auth documentation](https://www.better-auth.com/docs).
- [Router](/packages/router), [API routes](/packages/api) and [HTTP](/packages/http).
- [Add sign-in, end to end](/guides/authentication).
