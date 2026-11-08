---
title: Overview
description: Pages on the kitr route table, rendered by TanStack Router: typed links, loaders and guards. Web, desktop and mobile apps get it free.
order: 0
---

# Router

Every app has pages: a dashboard, a list of projects, one project, a sign-in screen. The router decides what the URL means, what loads before a page shows, who may open it, and how it moves in and out on a phone. Most routers cover the first and leave the rest to each page, so links break silently when a path changes and every guard is written by hand.

`@kitr/router` puts the pages on kitr's one route table and types everything that points at them.

## What it is

With `@kitr/router` the pages are links on one chain in `app/routes.ts`. Add `.page('/projects/$id', { lazy: () => import('./pages/project') })` and `/projects/42` exists, with `id` typed in the component, the loader and every `<Link>` that points at it. `createKitrRouter` builds the router from that table with kitr's defaults and the app in context. Loaders read services and fill the [query](/packages/query) cache before the page renders. Three guards, `requireAuth`, `can` and `guards`, protect pages. On phones, pages stack and swipe back like a native app.

It runs in the browser, and on the server when the web platform renders pages there. A server-only project never installs it; its HTTP routes come from [API routes](/packages/api).

## Install

```sh
kitr add router
```

This installs `@kitr/router` with TanStack Router and Start, adds the package to `kitrrc.ts`, and writes `app/routes.ts` (the route table), `app/document.tsx`, `app/router.tsx`, `app/client.tsx` and two starter pages. It adds [react](/packages/react) first when the project does not have it. Every UI kit includes it. The guide's [Install](/packages/router/guide#install) section lists every change.

## Quick start

Every page is a link on the chain in `app/routes.ts`:

```ts
// app/routes.ts
import { defineRoutes } from 'kitr/app'
import router from '@kitr/router/routes'
import { head, RootDocument } from './document'

export const routes = defineRoutes([router], (r) =>
  r
    .root({ head, component: RootDocument })
    .page('/', { lazy: () => import('./pages/home') })
    .page('/about', { lazy: () => import('./pages/about') })
    .page('/projects', { lazy: () => import('./pages/projects') }),
)

export type AppRoutes = typeof routes.$types
```

`kitr make:page projects` appends that last line and writes the page. Its default export is the component:

```tsx
// app/pages/projects.tsx
import { Link } from '@kitr/router'

const projects = [
  { id: 'apollo', name: 'Apollo', team: 'Platform' },
  { id: 'hermes', name: 'Hermes', team: 'Billing' },
]

export default function ProjectsPage() {
  return (
    <main>
      <h1>Projects</h1>
      <ul>
        {projects.map((project) => (
          <li key={project.id}>
            <Link to="/projects/$id" params={{ id: project.id }}>
              {project.name}
            </Link>{' '}
            ({project.team})
          </li>
        ))}
      </ul>
    </main>
  )
}
```

Run `kitr dev` and open `/projects`. You see the two projects as links. The `/projects/$id` link is a type error until you add that page, because `routes.$types` names every page. `lazy` loads the page module on first visit, so no page weighs on another's bundle. The guide continues from here: [Add your first page](/packages/router/guide#add-your-first-page).

## Built on

`@kitr/router` is [TanStack Router](https://tanstack.com/router/latest), re-exported unchanged, rendered by [TanStack Start](https://tanstack.com/start/latest). Typed paths, search params, loaders, `beforeLoad`, layouts and devtools work exactly as TanStack documents them.

| What kitr adds | Why |
| --- | --- |
| The `router` extension for the route table (`.root`, `.page`, `.layout`) | Pages, endpoints and sockets live in one table, so one file says what the app is. |
| `createKitrRouter` | TanStack's router with the app in context, the query client wired in and kitr's defaults. |
| Default loading, error and not-found screens | Every route has sensible screens until you write your own. |
| `requireAuth`, `can`, `guards` | `beforeLoad` guards that read the [auth](/packages/auth) session. |
| Stacks, tabs and split panes | Native-style navigation on phones and tablets: push, pop, swipe back, tabs that keep their stacks. |
| Platform-limited routes and per-platform presentation | A route can ship to some platforms only and arrive differently on each. |

## Problems it solves

- **Links that break when a path changes.** Paths and params are typed from the route table. See [Map links to URLs](/packages/router/guide#map-links-to-urls).
- **Pages that render before their data.** Loaders run first, using the app's services and the query cache. See [Load data before the page renders](/packages/router/guide#load-data-before-the-page-renders).
- **Guards written per page.** `requireAuth()` and `can()` go in `beforeLoad` and redirect or 403 consistently. See [Protect pages behind sign-in](/packages/router/guide#protect-pages-behind-sign-in).
- **Search params as untyped strings.** `validateSearch` gives filters and paging a schema. See [Read and write search params](/packages/router/guide#read-and-write-search-params).
- **Web navigation on a phone.** Pages push and pop, swipe back works, tabs keep their stacks. See [Stack pages like a native app](/packages/router/guide#stack-pages-like-a-native-app).
- **Pages that should not ship everywhere.** Limit a route to some platforms and choose how it arrives on each. See [Limit a route to some platforms](/packages/router/guide#limit-a-route-to-some-platforms).

## Further reading

- [Guide](/packages/router/guide): install, configure and every task.
- [API reference](/packages/router/api): `createKitrRouter`, the `router` extension, the guards and the default screens.
- [TanStack Router documentation](https://tanstack.com/router/latest/docs/framework/react/overview): routing, search params, loaders and everything re-exported here.
- [TanStack Start documentation](https://tanstack.com/start/latest): server rendering and the build.
- [Query](/packages/query) and [Auth](/packages/auth): the cache loaders fill, and the session guards read.
- [Platforms](/docs/platforms): `ssr`, `static` and `spa` modes, and the desktop and mobile shells.
