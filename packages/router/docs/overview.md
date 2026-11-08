---
title: Overview
description: Pages on the kitr route table, rendered by TanStack Router: typed links, loaders and guards. Web, desktop and mobile apps get it free.
order: 0
---

# Router

## What it is

`@kitr/router` is TanStack Router with kitr's defaults. Pages are links on one chain in `app/routes.ts`, with params typed everywhere. Loaders fill the [query](/packages/query) cache before a page renders, three guards protect pages, and on phones pages stack like a native app.

Runs in the browser and on the server. A server-only project uses [API routes](/packages/api) instead.

## Install

```sh
kitr add router
```

Adds `@kitr/router` with TanStack Router and Start, `app/routes.ts`, `app/document.tsx`, `app/router.tsx` and two starter pages. Adds [react](/packages/react) first if missing. Every UI kit includes it. [Every change](/packages/router/guide#install).

## Quick start

Every page is a link on the chain:

```ts
// app/routes.ts
import { defineRoutes } from '@kitr/kitr/app'
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

Open `/projects` and you see the two projects. The `/projects/$id` link is a type error until that page exists. `lazy` loads each page on first visit. Next in the guide: [Add your first page](/packages/router/guide#add-your-first-page).

## Built on

| What kitr adds | Why |
| --- | --- |
| The `router` extension for the route table (`.root`, `.page`, `.layout`) | Pages, endpoints and sockets live in one table, so one file says what the app is. |
| `createKitrRouter` | TanStack's router with the app in context, the query client wired in and kitr's defaults. |
| Default loading, error and not-found screens | Every route has sensible screens until you write your own. |
| `requireAuth`, `can`, `guards` | `beforeLoad` guards that read the [auth](/packages/auth) session. |
| Stacks, tabs and split panes | Native-style navigation on phones and tablets: push, pop, swipe back, tabs that keep their stacks. |
| Platform-limited routes and per-platform presentation | A route can ship to some platforms only and arrive differently on each. |

kitr adds `createKitrRouter`, the route table, the guards, the default screens and the native-style page stack.

## Problems it solves

- **Links that break when a path changes.** [Map links to URLs](/packages/router/guide#map-links-to-urls).
- **Pages that render before their data.** [Load data before the page renders](/packages/router/guide#load-data-before-the-page-renders).
- **Guards written per page.** [Protect pages behind sign-in](/packages/router/guide#protect-pages-behind-sign-in).
- **Search params as untyped strings.** [Read and write search params](/packages/router/guide#read-and-write-search-params).
- **Web navigation on a phone.** [Stack pages like a native app](/packages/router/guide#stack-pages-like-a-native-app).
- **Pages that should not ship everywhere.** [Limit a route to some platforms](/packages/router/guide#limit-a-route-to-some-platforms).

## Further reading

- [Guide](/packages/router/guide).
- [API reference](/packages/router/api).
- [TanStack Router documentation](https://tanstack.com/router/latest/docs/framework/react/overview).
- [TanStack Start documentation](https://tanstack.com/start/latest).
- [Query](/packages/query) and [Auth](/packages/auth).
- [Platforms](/docs/platforms).
