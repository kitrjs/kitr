---
title: Router
description: Turn files in app/routes into pages, with links, loaders and guards. Web, desktop and mobile apps get it automatically.
order: 1
---

# Router

Every page in a kitr app is a file in `app/routes`. Add `app/routes/projects/$id.tsx` and `/projects/42` exists, with `id` typed as a string in the component, the loader and every `<Link>` that points at it.

`kitr/router` is [TanStack Router](https://tanstack.com/router), re-exported unchanged, plus `createKitrRouter` (the router with kitr's defaults), default pending, error and not-found screens, and three guards for signed-in and permission checks.

## Install

The web, desktop and mobile [platforms](/docs/platforms) add the router for you. A server-only project has no pages, so it has no router. To add it by hand:

```sh
kitr add router
```

This installs `@kitr/router`, `@tanstack/react-router` and `@tanstack/react-start`, and writes `app/router.tsx`, `app/client.tsx` and three starter routes: `__root.tsx`, `index.tsx` and `about.tsx`.

## Files become routes

| File | URL |
| --- | --- |
| `app/routes/index.tsx` | `/` |
| `app/routes/about.tsx` | `/about` |
| `app/routes/projects/index.tsx` | `/projects` |
| `app/routes/projects/$id.tsx` | `/projects/:id` |
| `app/routes/_app.tsx` | A layout with no URL segment that wraps its children |
| `app/routes/__root.tsx` | The HTML document around every page |

`app/routeTree.gen.ts` is generated from these files while `kitr dev` runs. Never edit it.

`kitr make:route projects/$id` writes a new route file with a loader and a component.

## A page with a loader

```tsx
// app/routes/projects/$id.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Link } from 'kitr/router'
import { useSuspenseQuery } from 'kitr/query'
import { projectQuery } from '#app/features/projects/queries'

export const Route = createFileRoute('/projects/$id')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(projectQuery.options({ id: params.id })),
  component: ProjectPage,
})

function ProjectPage() {
  const { id } = Route.useParams()
  const { data: project } = useSuspenseQuery(projectQuery.options({ id }))
  return (
    <main>
      <h1>{project.name}</h1>
      <Link to="/projects">All projects</Link>
    </main>
  )
}
```

The loader fills the [query](/packages/query) cache before the page renders, so the component never shows a spinner on first load. On the server the same loader runs during server rendering.

Route files import `createFileRoute` from `@tanstack/react-router` because the route generator manages that line. Everything else, like `Link`, `useNavigate` and `Outlet`, comes from `kitr/router`.

## What createKitrRouter adds

`app/router.tsx` builds the router once per request on the server and once in the browser:

```tsx
import { createKitrRouter } from 'kitr/router'
import { app } from './app'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createKitrRouter({ routeTree, app })
}
```

Compared with a plain `createRouter`, you get:

- `context.app` and `context.queryClient` in every `beforeLoad` and `loader`.
- Links preload their page on hover or focus (`defaultPreload: 'intent'`).
- Scroll restoration.
- Default pending, error and not-found screens. Pass your own as `defaultPendingComponent`, `defaultErrorComponent` and `defaultNotFoundComponent`.
- Your app's providers wrapped around the whole tree.
- The app boots before the first loader runs, so services are always ready.
- On the server, each request gets its own copy of the app, so one visitor's cache never leaks into another's page.

Any other `createRouter` option passes straight through.

## Guards

Guards run in `beforeLoad`, before the page or its loader:

```tsx
// app/routes/_app.tsx: everything under this layout needs a signed-in user
import { createFileRoute } from '@tanstack/react-router'
import { Outlet, requireAuth } from 'kitr/router'

export const Route = createFileRoute('/_app')({
  beforeLoad: requireAuth(),
  component: () => <Outlet />,
})
```

| Guard | What it does |
| --- | --- |
| `requireAuth({ to, redirectParam })` | Sends anonymous visitors to `to` (default `/sign-in`) with `?redirect=` set to where they were going. |
| `can(permission, { subject, to })` | Checks `session.can(permission, subject)`. Without `to` it throws a 403 that the route's error screen shows. |
| `guards(a, b, ...)` | Runs several guards in order and merges what they return into the route context. |

The guards read `context.session`. [Auth](/packages/auth) provides one, or you can pass your own through `createKitrRouter({ context: { session } })`.

## Typing the router context

Packages and apps add fields to the router context with declaration merging:

```ts
declare module '@kitr/router' {
  interface KitrRouterContext {
    session: Session | null
  }
}
```

## Server rendering

The root route renders the whole HTML document. On the web platform, [`mode`](/docs/platforms) decides what happens with it: `ssr` streams it from the server on every request, `static` prerenders it at build time, and `spa` ships one shell that renders in the browser. Desktop and mobile apps always use the shell. Write the root route once and it works in all of them.
