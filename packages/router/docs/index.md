---
title: Router
description: Pages on the kitr route table, rendered by TanStack Router: typed links, loaders and guards. Web, desktop and mobile apps get it free.
order: 1
---

# Router

Every app has pages: a dashboard, a list of projects, one project, a sign-in screen. With `@kitr/router` the pages are links on one chain in `app/routes.ts`. Add `.page('/projects/$id', { lazy: () => import('./pages/project') })` and `/projects/42` exists, with `id` typed in the component, the loader and every `<Link>` that points at it.

> [!SUMMARY]
> Pages on one route table, with typed links, loaders and guards. Add it with `kitr add router`; the overview is at [/packages/router](/packages/router).

`@kitr/router` is [TanStack Router](https://tanstack.com/router/latest), re-exported unchanged, rendered by [TanStack Start](https://tanstack.com/start/latest). On top it adds the `router` route-table extension (`.root`, `.page`, `.layout`), `createKitrRouter`, default loading, error and not-found screens, and the `beforeLoad` guards `requireAuth`, `can` and `guards`.

The route table only has the methods of the extensions you list: pages from `@kitr/router/routes`, endpoints from `@kitr/api/routes`, sockets from `@kitr/realtime/routes`. It runs in the browser, and on the server when the web platform renders pages.

This guide follows Acme's project tracker at `app.acme.com`: a projects list, one page per project, a signed-in area for Ada's team, and a settings page only admins can open.

## Install

The web, desktop and mobile [platforms](/docs/platforms) require the router, so `kitr new` and `kitr add web` install it, and every UI kit has it. To add it to a project by hand:

```sh
kitr add router
```

<details>
<summary>Everything kitr add changes</summary>

What `kitr add` does:

- Adds [react](/packages/react) first if the project does not have it, because the router requires it.
- Installs `@kitr/router`, `@tanstack/react-router` and `@tanstack/react-start`, and as dev dependencies `@tanstack/router-plugin` and `@tanstack/react-router-devtools`.
- Adds `'@kitr/router'` to `packages` in `kitrrc.ts`. The router registers no provider; `createKitrRouter` does its wiring.
- Writes `app/routes.ts`, the route table, with `router` from `@kitr/router/routes` in its extension list, a root and two pages (shown under Add your first page). When another package created the table first, it only adds `router` to the list.
- Writes `app/document.tsx`, the HTML document around every page, with a two-link nav and `@kitr/theme/styles.css`.
- Writes `app/pages/home.tsx` (`/`) and `app/pages/about.tsx` (`/about`).
- Writes `app/router.tsx`, which creates the router from the table (shown under Configure).
- Writes `app/client.tsx`, Start's client entry, which boots the app before it hydrates the page.
- Adds a `router` section to `AGENTS.md`: routes are code in `app/routes.ts`, components live in `app/pages/`, loaders and guards go on the route options, and the document stays platform-neutral.
</details>

`kitr add` skips any of these files that already exists. `--no-install` skips the package manager and `--dry-run` prints the plan.

```sh
kitr add router --dry-run
```

<details>
<summary>What kitr remove does</summary>

`kitr remove router` removes the packages, the `kitrrc.ts` entry, the `AGENTS.md` section and `router` from the table's extension list. It leaves `app/routes.ts`, `app/document.tsx`, `app/pages/`, `app/router.tsx` and `app/client.tsx` in place, because they are your pages now.

</details>

## Configure

`@kitr/router` has no config file; you configure it where it is created, in `app/router.tsx`, which `kitr add router` writes:

```tsx
// app/router.tsx
import { createKitrRouter } from '@kitr/router'
import { app } from './app'
import { routes } from './routes'

export function getRouter() {
  return createKitrRouter({ routes, app })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
```

TanStack Start calls `getRouter()` once in the browser and once per request on the server. The `Register` block type-checks every `<Link to>`, `useParams` and `useSearch` against your pages; nothing is generated.

`createKitrRouter` accepts every [`createRouter` option](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType) except `context` and `routeTree`, and sets different defaults for some of them:

| Option | Default | Description |
| --- | --- | --- |
| `routes` | required | The table from `app/routes.ts`. Compiled to a route tree for this platform. Pass `routeTree` instead to hand it a tree you built yourself. |
| `app` | required | The kitr app from `app/app.ts`. Put in every route's context as `context.app`, forked per request on the server. |
| `platform` | `import.meta.env.KITR_PLATFORM` | The platform whose tree to build: pages with `platforms` that leave it out are dropped. Set by `kitr dev|build <name>`. |
| `queryClient` | the container's `queryClient` | The [query](/packages/query) client put in context as `context.queryClient`. Read from the container the first time a loader asks, so it works before boot. |
| `context` | `{}` | Extra fields merged into every route's context, such as `session`. |
| `defaultPreload` | `'intent'` | Links load their page's code and data on hover or focus. |
| `defaultPreloadStaleTime` | `0` | Preloads always run the loader, so the query cache decides what is fresh. |
| `scrollRestoration` | `true` | Back and forward restore the scroll position. |
| `defaultPendingComponent` | `DefaultPending` | What a route shows while its loader runs. |
| `defaultErrorComponent` | `DefaultError` | What a route shows when its loader or component throws. |
| `defaultNotFoundComponent` | `DefaultNotFound` | What shows for an unknown URL or a thrown `notFound()`. |
| `defaultStructuralSharing` | `true` | Search params and loader data keep their identity when unchanged, so memoised components do not re-render. |
| `history` | browser history | Pass `createMemoryHistory()` in tests. |

`createKitrRouter` also sets `Wrap` to render `KitrProvider`, so the app's providers wrap every page. A `Wrap` you pass is replaced; wrap the tree from a provider's `wrap()` instead.

## Add your first page

Every page is a link on the chain in `app/routes.ts`. `kitr add router` writes the table with a root and two pages:

```ts
// app/routes.ts
import { defineRoutes } from 'kitr/app'
import router from '@kitr/router/routes'
import { head, RootDocument } from './document'

export const routes = defineRoutes([router], (r) =>
  r
    .root({ head, component: RootDocument })
    .page('/', { lazy: () => import('./pages/home') })
    .page('/about', { lazy: () => import('./pages/about') }),
)

export type AppRoutes = typeof routes.$types
```

Add a page with `kitr make:page projects`, or by hand. The command writes `app/pages/projects.tsx` and appends `.page('/projects', { lazy: () => import('./pages/projects') })` to the chain:

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

Run `kitr dev` and open `/projects`. You see the two projects as links (the `/projects/$id` link is a type error until the next section adds that page).

`lazy` loads the page module on first visit, so each page has its own bundle. Its default export is the component, or `definePage({ component, pendingComponent, errorComponent })` for its own loading and error screens. Loaders, `beforeLoad` and `head` stay in `app/routes.ts`. Pass `component` instead of `lazy` to put a page in the first bundle.

## Map links to URLs

| Link | URL |
| --- | --- |
| `.page('/')` | `/` |
| `.page('/about')` | `/about` |
| `.group('/projects', (g) => g.page('/'))` | `/projects/`, inside the group |
| `.page('/projects/$id')` | `/projects/:id`, with `params.id` |
| `.page('/projects/$id/settings')` | `/projects/:id/settings` |
| `.layout('_app', options, (app) => ...)` | A layout with no URL segment; wraps every page inside the callback |
| `.layout('_app', ..., (app) => app.page('/dashboard'))` | `/dashboard`, inside the `_app` layout |
| `.page('/files/$')` | `/files/*`, the rest of the path in `params._splat` |
| `.root({ head, component })` | The HTML document around every page |

Route ids include layouts: the dashboard above is `/_app/dashboard`, which is what `getRouteApi('/_app/dashboard')` takes. Path syntax is TanStack's, in its [routing guide](https://tanstack.com/router/latest/docs/framework/react/routing/routing-concepts).

## Read path params

A `$name` segment becomes a typed param. Read it with `getRouteApi(id).useParams()`:

```ts
// app/routes.ts
r.page('/projects/$id', { lazy: () => import('./pages/project') })
```

```tsx
// app/pages/project.tsx
import { getRouteApi, Link } from '@kitr/router'

const route = getRouteApi('/projects/$id')

export default function ProjectPage() {
  const { id } = route.useParams() // '/projects/apollo' → { id: 'apollo' }
  return (
    <main>
      <h1>Project {id}</h1>
      <Link to="/projects">All projects</Link>
    </main>
  )
}
```

`<Link to="/projects/$id">` without `params` is a type error, and so is a `to` that matches no page or a wrong `getRouteApi` id.

## Read and write search params

Declare what the query string may hold with `validateSearch` on the link. The result is typed in the component and in every link to the page:

```ts
// app/routes.ts
type ProjectsSearch = { team?: string; page: number }

r.page('/projects', {
  validateSearch: (search: Record<string, unknown>): ProjectsSearch => ({
    team: typeof search.team === 'string' ? search.team : undefined,
    page: Number(search.page ?? 1) || 1,
  }),
  lazy: () => import('./pages/projects'),
})
```

```tsx
// app/pages/projects.tsx
import { getRouteApi, Link } from '@kitr/router'

const route = getRouteApi('/projects')

export default function ProjectsPage() {
  const { team, page } = route.useSearch() // '/projects?team=Billing' → { team: 'Billing', page: 1 }
  return (
    <main>
      <h1>{team ? `${team} projects` : 'All projects'}</h1>
      <Link to="/projects" search={{ team, page: page + 1 }}>
        Next page
      </Link>
    </main>
  )
}
```

A [Zod](https://zod.dev) schema's `parse` works as `validateSearch` too.

## Navigate from code

After a form submits or an action finishes, navigate with `useNavigate`:

```tsx
// app/components/projects/archive-button.tsx
import { useNavigate } from '@kitr/router'

export function ArchiveButton({ id }: { id: string }) {
  const navigate = useNavigate()
  async function archive() {
    await fetch(`/api/projects/${id}/archive`, { method: 'POST' })
    await navigate({ to: '/projects', search: { page: 1 } })
  }
  return (
    <button type="button" onClick={archive}>
      Archive
    </button>
  )
}
```

`navigate` takes the same typed `to`, `params` and `search` as `<Link>`. Use `<Link>` for anything the user clicks (it preloads and renders a real `<a>`); keep `navigate` for moves that follow an action.

## Load data before the page renders

A loader runs before the page renders, on the server during server rendering and in the browser on every navigation. With [query](/packages/query), the loader fills the cache and the component reads the same entry, so the page never shows a spinner on first load:

```ts
// app/queries/projects.ts
import { createKeys } from 'kitr/app'
import { queryFrom } from '@kitr/query'

export interface Project {
  id: string
  name: string
  team: string
}

export const projectKeys = createKeys('projects')

export const projectQuery = queryFrom({
  key: (id: string) => projectKeys.detail(id),
  fetch: async (id, { signal }): Promise<Project> => {
    const res = await fetch(`https://api.acme.com/projects/${id}`, { signal })
    return (await res.json()) as Project
  },
})
```

```ts
// app/routes.ts
import { projectQuery } from '#app/queries/projects'

r.page('/projects/$id', {
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(projectQuery.options(params.id)),
  lazy: () => import('./pages/project'),
})
```

```tsx
// app/pages/project.tsx
import { useSuspenseQuery } from '@kitr/query'
import { getRouteApi, Link } from '@kitr/router'
import { projectQuery } from '#app/queries/projects'

const route = getRouteApi('/projects/$id')

export default function ProjectPage() {
  const { id } = route.useParams()
  const { data: project } = useSuspenseQuery(projectQuery.options(id))
  return (
    <main>
      <h1>{project.name}</h1>
      <p>Team: {project.team}</p>
      <Link to="/projects">All projects</Link>
    </main>
  )
}
```

`context.queryClient` comes from `createKitrRouter`; on the server it belongs to this request alone. Links preload on intent, so hovering "Apollo" already runs this loader.

Without query, return data from the loader and read it with `route.useLoaderData()`. Prefer the query version: the cache is shared and mutations can refresh it.

## Use services in loaders

Loaders and guards are not components, so they cannot call `useService`. Read services from `context.app`:

```ts
// app/routes.ts
r.page('/teams/$team', {
  loader: async ({ context, params }) => {
    const http = context.app.container.use('http')
    return http.get(`teams/${params.team}`).json<{ name: string; members: string[] }>()
  },
  lazy: () => import('./pages/team'),
})
```

```tsx
// app/pages/team.tsx
import { getRouteApi } from '@kitr/router'

const route = getRouteApi('/teams/$team')

export default function TeamPage() {
  const team = route.useLoaderData()
  return (
    <p>
      {team.name}: {team.members.join(', ')}
    </p>
  )
}
// /teams/platform → "Platform: Ada, Grace, Linus"
```

> [!WARNING]
> Don't import `app` from `#app/app` in a loader. On the server `context.app` is a per-request fork; the shared app would leak one visitor's services into another's page.

## Add a layout

`.layout(id, options, callback)` wraps the pages in its callback in a component without adding a URL segment. The component renders `<Outlet />` where the child page goes:

```ts
// app/routes.ts
r.layout('_app', { lazy: () => import('./layouts/app') }, (app) =>
  app
    .page('/dashboard', { lazy: () => import('./pages/dashboard') })
    .page('/projects', { lazy: () => import('./pages/projects') }),
)
```

```tsx
// app/layouts/app.tsx
import { Link, Outlet } from '@kitr/router'

export default function AppLayout() {
  return (
    <div className="app-layout">
      <nav>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/projects">Projects</Link>
      </nav>
      <Outlet />
    </div>
  )
}
```

`/dashboard` and `/projects` now render inside this layout. Navigating between them keeps the layout mounted and replaces only the outlet. A `beforeLoad` on a layout runs for every page inside it.

## Show loading, error and not-found states

`createKitrRouter` gives every route three screens without you writing them:

| Component | Shows | Markup |
| --- | --- | --- |
| `DefaultPending` | A spinner with "Loading…" for screen readers, while a loader runs. | `role="status"`, `data-kitr="pending"` |
| `DefaultError` | The error's title and message, a "Try again" button and a "Go home" link. | `role="alert"`, `data-kitr="error"`, `data-code` set to the error code |
| `DefaultNotFound` | "Page not found" and a "Go home" link. | `data-kitr="not-found"` |

`@kitr/theme/styles.css` styles them through `.kitr-pending`, `.kitr-error` and `.kitr-not-found`. The pending screen shows only after `defaultPendingMs` (one second), so fast pages never flash it.

Override one page by exporting `definePage` from its module:

```tsx
// app/pages/project.tsx
import { toKitrError } from 'kitr/app'
import { definePage, type ErrorComponentProps, Link } from '@kitr/router'

export default definePage({
  pendingComponent: () => <p>Loading project…</p>,
  errorComponent: ProjectError,
  component: () => <p>Project</p>,
})

function ProjectError({ error }: ErrorComponentProps) {
  const err = toKitrError(error)
  return (
    <div role="alert">
      <p>Could not open this project ({err.code}).</p>
      <Link to="/projects">Back to projects</Link>
    </div>
  )
}
```

Override them for the whole app in `app/router.tsx`:

```tsx
// app/router.tsx
import { createKitrRouter } from '@kitr/router'
import { app } from './app'
import { AcmeError, AcmeNotFound, AcmeSpinner } from './components/route-states'
import { routes } from './routes'

export function getRouter() {
  return createKitrRouter({
    routes,
    app,
    defaultPendingComponent: AcmeSpinner,
    defaultErrorComponent: AcmeError,
    defaultNotFoundComponent: AcmeNotFound,
  })
}
```

The defaults are exported, so a custom screen can render one inside its own layout: `import { DefaultError } from '@kitr/router'`.

## Throw errors from loaders

Throw a `KitrError` from a loader and `DefaultError` shows its message as the title, with its code in `data-code`:

```ts
// app/routes.ts
import { KitrError } from 'kitr/app'

r.page('/projects/$id/archive', {
  loader: ({ params }) => {
    if (params.id === 'apollo') throw new KitrError('CONFLICT', 'Already archived')
    return { id: params.id }
  },
  lazy: () => import('./pages/archive'),
})
// /projects/apollo/archive renders:
// <div role="alert" data-kitr="error" data-code="CONFLICT"><h2>Already archived</h2>…
```

| What was thrown | Title | Body |
| --- | --- | --- |
| A `KitrError` | The error's message | The error's message |
| A `KitrError` with code `FORBIDDEN` | The error's message | "You don't have access to this page." |
| Anything else | "Something went wrong" | The error's message |

"Try again" reruns the loader. Errors from [http](/packages/http), [actions](/packages/actions) and [query](/packages/query) are already `KitrError`s.

For a missing record, throw TanStack's `notFound()` instead. The page's not-found screen renders, not the error screen:

```ts
// app/routes.ts
import { notFound } from '@kitr/router'

const projects: Record<string, { name: string }> = { apollo: { name: 'Apollo' } }

r.page('/projects/$id', {
  loader: ({ params }) => {
    const project = projects[params.id]
    if (!project) throw notFound()
    return project
  },
  lazy: () => import('./pages/project'),
})
// /projects/zeus → "Page not found"
```

## Protect pages behind sign-in

`requireAuth()` is a `beforeLoad` guard. Put it on a layout and every page under it needs a signed-in user:

```ts
// app/routes.ts
import { requireAuth } from '@kitr/router'

r.layout('_app', { beforeLoad: requireAuth(), lazy: () => import('./layouts/app') }, (app) =>
  app.page('/dashboard', { lazy: () => import('./pages/dashboard') }),
)
```

The guard reads `context.session`. Without `session?.user` it redirects to `/sign-in`, carrying the wanted page in `redirect`: Linus, signed out, opening `/projects/apollo?tab=tasks` lands on `/sign-in` with `redirect=/projects/apollo?tab=tasks`. Otherwise it returns `{ session }` into the context of every page inside the layout.

| Option | Default | Description |
| --- | --- | --- |
| `to` | `'/sign-in'` | Where anonymous visitors go. |
| `redirectParam` | `'redirect'` | The search param that carries the original URL. `false` sends no param. |

```ts
// app/routes.ts
r.layout('_app', { beforeLoad: requireAuth({ to: '/login', redirectParam: 'next' }) }, (app) =>
  app.page('/dashboard', { lazy: () => import('./pages/dashboard') }),
)
// signed out at /dashboard → /login, with search { next: '/dashboard' }
```

After sign-in, send the visitor back:

```ts
// app/routes.ts
r.page('/sign-in', {
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : '/dashboard',
  }),
  lazy: () => import('./pages/sign-in'),
})
```

```tsx
// app/pages/sign-in.tsx
import { getRouteApi, useNavigate } from '@kitr/router'

const route = getRouteApi('/sign-in')

export default function SignInPage() {
  const { redirect } = route.useSearch()
  const navigate = useNavigate()
  async function signIn() {
    // ... sign in with @kitr/auth
    await navigate({ to: redirect })
  }
  return (
    <button type="button" onClick={signIn}>
      Sign in as ada@acme.com
    </button>
  )
}
```

The guard only sees a session you put in the router context (see "Add fields to the router context").

> [!WARNING] Guards are not security
> Guards decide what the browser shows; anyone can call your API without loading the page. Check the session again in the API route or action that returns the data.

## Check a permission

`can(permission)` asks `context.session.can(permission, subject)`. Without permission it throws a `FORBIDDEN` `KitrError` (status 403), which the page's error screen shows as "You don't have access to this page.":

```ts
// app/routes.ts
import { can } from '@kitr/router'

app.page('/settings', { beforeLoad: can('teams.manage'), lazy: () => import('./pages/settings') })
// Grace (member) opening /settings: the error screen, title 'Missing permission "teams.manage"'
```

Pass `to` to redirect instead of showing the error:

```ts
// app/routes.ts
app.page('/billing', {
  beforeLoad: can('invoices.view', { to: '/upgrade' }),
  lazy: () => import('./pages/billing'),
})
```

`subject` is fixed when the table is built. For a check that depends on the URL, call the guard inside `beforeLoad` with the subject you build from the params:

```ts
// app/routes.ts
app.page('/projects/$id/edit', {
  beforeLoad: (ctx) => can('projects.update', { subject: { id: ctx.params.id } })(ctx),
  lazy: () => import('./pages/edit-project'),
})
```

A session without a `can` function, or no session, fails every check. Declare `session` on `KitrRouterContext` so the guards type-check. In components, [auth](/packages/auth)'s `useCan()` hides buttons; the guard stops the page.

## Combine guards

`guards(a, b, ...)` runs several `beforeLoad` functions in order, awaits each one and merges the objects they return. The first one that throws stops the rest:

```ts
// app/routes.ts
import { can, guards, requireAuth } from '@kitr/router'

app.page('/admin', {
  beforeLoad: guards(requireAuth(), can('admin.access')),
  lazy: () => import('./pages/admin'),
})
```

Your own guards fit in the list; return an object to add it to the route context. When a guard needs the page's params, build the list inside `beforeLoad`:

```ts
// app/routes.ts
const loadTeam = async (slug: string) => ({
  team: { slug, name: slug === 'platform' ? 'Platform' : 'Billing' },
})

app.page('/teams/$team', {
  beforeLoad: (ctx) => guards(requireAuth(), () => loadTeam(ctx.params.team))(ctx),
  lazy: () => import('./pages/team'),
})
```

```tsx
// app/pages/team.tsx
import { getRouteApi } from '@kitr/router'

const route = getRouteApi('/_app/teams/$team')

export default function TeamPage() {
  const { team } = route.useRouteContext()
  return <h1>{team.name}</h1>
}
// /teams/platform → beforeLoad returns { session, team }, and the page shows "Platform"
```

When two guards return the same key, the later one wins.

## Add fields to the router context

Pass extra context with `context` and declare its type once, so every `beforeLoad` and loader sees it. With `@kitr/auth` installed, `createKitrRouter` already puts the live session in `context.session`; the example below is for a session service of your own:

```tsx
// app/router.tsx
import { createKitrRouter } from '@kitr/router'
import { app } from './app'
import { routes } from './routes'

interface AcmeSession {
  user: { id: string; email: string; role: 'admin' | 'member' } | null
  can: (permission: string, subject?: unknown) => boolean
}

export function getRouter() {
  return createKitrRouter({
    routes,
    app,
    context: {
      // A getter, so guards read the session the app restored during boot, not the one at creation.
      get session(): AcmeSession | null {
        return app.container.has('session') ? (app.container.use('session') as AcmeSession) : null
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
    session: AcmeSession | null
  }
}
```

With [auth](/packages/auth), read the session from its `auth` service the same way:

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
      // A live getter, so `requireAuth()` sees the session the auth provider restores during boot.
      get session() {
        return app.container.has('auth') ? (app.container.use('auth').session as Session<User>) : null
      },
    },
  })
}

declare module '@kitr/router' {
  interface KitrRouterContext {
    session: Session<User> | null
  }
}
```

`KitrRouterContext` starts with `app` and `queryClient`; augment `'@kitr/router'` to add fields.

> [!WARNING] Use a getter
> TanStack Start builds the router before the app boots, so a plain `session: app.container.use('session')` reads too early and throws `No binding named "session"`.

## Stack pages like a native app

In a phone app a tap on a list row pushes the detail over the list, which stays mounted and scrolled. A browser unmounts the list instead. `<StackOutlet>` from `@kitr/router/stack` gives the router the native model; put it where a layout renders its children instead of `<Outlet>`:

```ts
// app/routes.ts
import { requireAuth } from '@kitr/router'

r.layout('_app', { beforeLoad: requireAuth(), lazy: () => import('./pages/app-layout') }, (app) =>
  app
    .page('/chats', { lazy: () => import('./pages/chats') })
    .page('/chats/$id', { lazy: () => import('./pages/chat') }),
)
```

```tsx
// app/pages/app-layout.tsx
import { StackOutlet } from '@kitr/router/stack'

export default function AppLayout() {
  return <StackOutlet />
}
```

Every page inside the `_app` layout is now a page in the stack. Navigating deeper pushes; the page beneath keeps its state and scroll; history back pops it. Links, loaders and guards work unchanged, and the server renders plain pages.

```ts
// app/routes.ts (inside the _app layout)
r.page('/chats', {
  loader: ({ context }) => context.app.container.use('http').get<{ id: string; name: string }[]>('/chats'),
  lazy: () => import('./pages/chats'),
})
```

```tsx
// app/pages/chats.tsx
import { getRouteApi, Link } from '@kitr/router'

const route = getRouteApi('/_app/chats')

export default function ChatsPage() {
  const chats = route.useLoaderData()
  return (
    <ul>
      {chats.map((chat) => (
        <li key={chat.id}>
          <Link to="/chats/$id" params={{ id: chat.id }}>{chat.name}</Link>
        </li>
      ))}
    </ul>
  )
}
```

Opening `/chats/9` from inside chat 7 pushes a second chat page with its own params and data; back pops to chat 7, then the list, still scrolled.

| Prop | What it does |
| --- | --- |
| `keepAlive` | How many covered pages stay mounted per tab. Default `5`; `false` remounts every page on back, like a plain outlet. |
| `motion` | `ios`, `android`, `plain` or `none`. Default: detected from the device; `none` when the user prefers reduced motion. |
| `gestures` | Edge swipe back and drag to dismiss. Default: on for touch devices. Pass `{ edge, commitAt, velocity }` to tune. |
| `onRootBack` | Back pressed with nothing to pop. Default: Android exits the app. |

The stack fills its parent: give the parent a height (`100dvh` for a full-screen app). Pages are `<div data-kitr-stack-page>` elements with `data-presentation` and `data-active` attributes; `--kitr-stack-page-bg` sets their background.

## Choose how a page arrives

A page says how it is presented through the options on its link, which land in `staticData`. The stack reads `presentation`, `keepAlive` and `stackParent`:

```ts
// app/routes.ts (inside the _app layout)
r.page('/compose', {
  presentation: 'cover',
  stackParent: '/',
  lazy: () => import('./pages/compose'),
})
```

| Presentation | Arrives | Leaves |
| --- | --- | --- |
| `push` (default) | Slides in from the right (iOS), fades up (Android), cross-fades elsewhere. | Edge swipe, back button, `pop()`. |
| `cover` | Rises over the whole screen. For a composer, a player, a checkout. | Drag down, back, `dismiss()`. |
| `sheet` | Rises over the dimmed page beneath, which stays visible. For a picker, a menu, a share sheet. | Drag down, tap the scrim, back. |
| `fullscreen` | Like `push`, with no swipe gesture. For a video, a camera, a map. | Back button, `pop()`. |

`keepAlive: false` unmounts a page as soon as it is covered, so a camera or heavy map stops running.

`stackParent` is for cold starts: when a notification opens `/chats/7` directly, `stackParent: '/chats'` puts the list under the chat so back has somewhere to go. It applies only when the app started on that page.

```ts
// app/routes.ts (inside the _app layout)
r.page('/chats/$id', { stackParent: '/chats', lazy: () => import('./pages/chat') })
```

## Swipe back and the back button

On iOS, drag from the left edge to go back, and drag a sheet down to close it. Android gets the same gestures, and its back button closes things in this order:

1. Handlers registered with `useBackHandler()`, newest first. A dialog registers one while it is open so back closes it.
2. The stack pops a page when the current tab holds more than one.
3. `<StackTabs>` switches to the first tab when another tab is at its root.
4. `onRootBack`, then the browser's history when it has entries, then `platform.exit()` on Android.

```tsx
// app/components/confirm-dialog.tsx
import { useBackHandler } from '@kitr/router/stack'

export function ConfirmDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useBackHandler(() => {
    onClose()
    return true // handled: the stack does not pop
  }, open)
  return open ? <dialog open>Discard the draft?</dialog> : null
}
```

Inside a page, `useStack()` tells it where it stands and how to leave:

```tsx
// app/components/page-header.tsx
import { useStack } from '@kitr/router/stack'

export function PageHeader({ title }: { title: string }) {
  const stack = useStack()
  return (
    <header>
      {stack.canPop ? <button type="button" onClick={stack.pop}>Back</button> : null}
      <h1>{title}</h1>
    </header>
  )
}
```

| `useStack()` field | Meaning |
| --- | --- |
| `depth` | Pages in the current tab. |
| `canPop` | `depth > 1`. |
| `pop()` / `dismiss()` | Go back one page (history back). |
| `presentation` | How the current page arrived. |
| `entry` | The current page's stack entry (id, href, route ids). |

The hardware back button needs the `platform` service from [`@kitr/platform`](/packages/platform); gestures and `useStack()` work without it.

## Tabs that keep their stacks

Tab bars in native apps keep a stack per tab: leave Home three pages deep, visit Search, come back and Home is still three pages deep. `<StackTabs>` does this over the same route tree, deciding which tab a URL belongs to by path:

```tsx
// app/pages/app-layout.tsx (the component of the _app layout)
import { StackTabs } from '@kitr/router/stack'

export default function AppLayout() {
  return (
    <StackTabs
      tabs={[
        { id: 'home', to: '/', match: ['/', '/chats'] },
        { id: 'search', to: '/search' },
        { id: 'me', to: '/me' },
      ]}
    >
      {({ tabs, current, select }) => (
        <nav aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              aria-current={current?.id === tab.id ? 'page' : undefined}
              onClick={() => select(tab)}
            >
              {tab.id}
            </button>
          ))}
        </nav>
      )}
    </StackTabs>
  )
}
```

`select(tab)` opens the tab's last page, or its `to` the first time; selecting the current tab pops it to its root. `match` lists the paths a tab owns (default: `to`). The render prop draws the bar, so a phone gets a bottom bar and a desktop a sidebar.

## Show a list beside the detail

On a tablet or a desktop window the list and the detail fit side by side. `<SplitStack>` shows the list pane when the viewport is at least `minWidth` pixels wide and only the stack below that, so the phone keeps pushing the detail over the list:

```tsx
// app/pages/chats-layout.tsx (the component of a `chats` layout)
import { SplitStack, StackOutlet } from '@kitr/router/stack'
import { ChatList } from '#app/components/chat-list'

export default function ChatsLayout() {
  return (
    <SplitStack master={<ChatList />} minWidth={768}>
      <StackOutlet />
    </SplitStack>
  )
}
```

```ts
// app/routes.ts (inside the _app layout)
r.layout('chats', { lazy: () => import('./pages/chats-layout') }, (chats) =>
  chats
    .page('/chats', { lazy: () => import('./pages/chats') })
    .page('/chats/$id', { lazy: () => import('./pages/chat') }),
)
```

The `/chats` page is the list on a phone and a placeholder on a wide screen, because the list already shows on the left. `useSplitPane()` tells it which:

```tsx
// app/pages/chats.tsx
import { useSplitPane } from '@kitr/router/stack'
import { ChatList } from '#app/components/chat-list'

export default function ChatsPage() {
  const { split } = useSplitPane()
  return split ? <p>Pick a chat</p> : <ChatList />
}
```

`useSplitPane()` is `false` on the server and in the first client render, so phones never see a shift.

## Limit a route to some platforms

Apps that share one route tree across a marketing site, a web app and a phone app need some routes on one platform only. `onlyPlatform()` is a `beforeLoad` guard that renders not-found (or redirects) elsewhere:

```ts
// app/routes.ts
import { guards, onlyPlatform, requireAuth } from '@kitr/router'

r.page('/pricing', {
  beforeLoad: onlyPlatform('www'),
  lazy: () => import('./pages/pricing'),
})

// inside the _app layout
r.page('/billing', {
  beforeLoad: guards(requireAuth(), onlyPlatform(['web', 'desktop'], { to: '/' })),
  lazy: () => import('./pages/billing'),
})
```

Keys are platform names (`www`, `phone`), types (`web`, `mobile`), OS names (`ios`) or `native`.

| Guard | Where the route exists |
| --- | --- |
| `onlyPlatform('www')` | The `www` build only. |
| `onlyPlatform(['web', 'desktop'])` | Every web and desktop build; a 404 on phones. |
| `onlyPlatform('native', { to: '/download' })` | Native shells; the web redirects to the download page. |



## Set the page title and meta tags

Each page can add tags to the document head with `head` on its link. The document renders them through `<HeadContent />`:

```ts
// app/routes.ts
r.page('/projects/$id', {
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(projectQuery.options(params.id)),
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.name ?? 'Project'} · Acme` }],
  }),
  lazy: () => import('./pages/project'),
})
```

For canonical URLs, Open Graph tags and sitemaps, use [seo](/packages/seo).

## Choose where a page ships and how it moves

The link takes a few options of kitr's own next to TanStack's. They land in the route's `staticData`, where the platform shells read them:

| Option | Description |
| --- | --- |
| `lazy` | The page module, loaded on first visit. |
| `platforms` | The platforms that ship this page, by name. Others leave it out. Default: all. |
| `render` | Render mode on the web platform, overriding its `mode`: `'ssr'`, `'client'` or `'static'`. Native platforms always render on the client. |
| `presentation` | How the page enters a stack outlet on desktop and mobile: `'push'` (default), `'cover'`, `'sheet'` or `'fullscreen'`. |
| `keepAlive` | Keep the page mounted (state, scroll, media) when another page covers it. |
| `stackParent` | The page a cold deep link stacks under this one (`/chats/$id` under `/chats`). |

```ts
// app/routes.ts
r.page('/scan', {
  platforms: ['ios', 'android'],
  presentation: 'fullscreen',
  lazy: () => import('./pages/scan'),
})
```

`<Link to="/scan">` stays type-checked on every platform; only the compiled tree differs.

## Render on the server

`.root(...)` is the HTML document around every page. `kitr add router` writes its component in `app/document.tsx`:

```tsx
// app/document.tsx
import { HeadContent, Link, Outlet, Scripts } from '@kitr/router'
import css from '@kitr/theme/styles.css?url'

/** Head tags for every page. Pages add their own through `head` in their route options. */
export function head() {
  return {
    meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    links: [{ rel: 'stylesheet', href: css }],
  }
}

/** The HTML shell. Start streams it on the server and hydrates it on the client. */
export function RootDocument() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <nav style={{ display: 'flex', gap: 12, padding: 12 }}>
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
        </nav>
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
```

```ts
// app/routes.ts
r.root({ head, component: RootDocument })
```

`.root` takes TanStack's root route options (`head`, `component`, `beforeLoad`, `loader`, `errorComponent`) and may be called once per table, before any page. Without it, kitr renders a default document.

On the web platform, [`mode`](/docs/platforms) decides what happens with the document: `ssr` streams it on every request, `static` prerenders it at build time, and `spa` ships one browser shell. Write the document once; don't branch on the platform inside it.

<details>
<summary>Requests and the server platform</summary>

Each server request gets its own router and fork of the app (`app.fork()`), so request-scoped services such as the query cache never leak between visitors. With a [server](/packages/server) platform, `app/server.ts` is Start's server entry: paths the kitr server has routes for (endpoints, sockets, the health check) go to it, everything else renders a page.

</details>

## Reach the router from a service

`createKitrRouter` binds the router in the container as `router`, so code that is not a component can navigate without importing the table:

```ts
// app/lib/projects/open-project.ts
import { app } from '#app/app'

export function openProject(id: string) {
  const router = app.container.use('router')
  return router.navigate({ to: '/projects/$id', params: { id } })
}
```

`to` is not type-checked here; inside components prefer `useNavigate()`, which is.

## Keep file routes

To use TanStack's file routes instead of the table, add `app/routes/__root.tsx`; `@kitr/vite` then builds `app/routeTree.gen.ts`, and `createKitrRouter({ routeTree, app })` takes that tree. Route files import `createFileRoute` from `@tanstack/react-router`, which `kitr doctor` allows. Use the table or file routes, not both.

## Commands

| Command | What it does |
| --- | --- |
| `kitr make:page <path>` | Writes `app/pages/<path>.tsx` with a component, and appends `.page('<path>', { lazy })` to `app/routes.ts`. |
| `kitr make:layout <name>` | Writes `app/layouts/<name>.tsx`, a component around `<Outlet />`, and appends `.layout('_<name>', { lazy }, (<name>) => <name>)` to `app/routes.ts`. |

```sh
kitr make:page 'projects/$id'
```

This writes `app/pages/projects/id.tsx` and adds `.page('/projects/$id', { lazy: () => import('./pages/projects/id') })` to the chain:

```tsx
// app/pages/projects/id.tsx
// Route options (loader, beforeLoad, head) go on the `.page('/projects/$id', ...)` link in app/routes.ts.
// Read what the loader returned: `const route = getRouteApi('/projects/$id')` from '@kitr/router', then `route.useLoaderData()`.

export default function ProjectsIdPage() {
  return (
    <div>
      <h1>ProjectsId</h1>
    </div>
  )
}
```

`projects/:id` is accepted for `projects/$id`; quote the argument in shells that expand `$`. `--force` overwrites an existing page, and `kitr eject stub page` copies the template to `stubs/page.ts`.

> [!WARNING]
> Import from `@kitr/router`, not `@tanstack/react-router`; `kitr doctor` warns about the latter in app code.

## Errors

| Code | When | What to do |
| --- | --- | --- |
| `FORBIDDEN` (403) | `can(permission)` failed and no `to` was given. Message: `Missing permission "<permission>"`. | Give the user the permission, hide the link with `useCan()`, or pass `to` to redirect. |
| redirect | `requireAuth()` found no `session.user`. Not an error: TanStack follows it. | Put a session in context with `createKitrRouter({ context })`. |
| not found | No page matches, or a loader threw `notFound()`. | Add the page to `app/routes.ts`, or check the id. |
| `[@kitr/router] routes.root() may only be called once` | Two `.root(...)` links on one table. | Keep one; a merged table brings its own root only when yours has none. |
| `[kitr] No binding named "session"` | The router context read a service before the app booted. | Read it through a getter, as in "Add fields to the router context". |
| `Something went wrong` | A loader threw something that is not a `KitrError`. | Throw a `KitrError` with a code and message the user can act on. |

## Testing

Build a small table in a test, create the router from it with a test app and a memory history, then render it with `RouterProvider`:

```tsx
// app/pages/project.test.tsx
import { defineRoutes } from 'kitr/app'
import { createKitrRouter, createMemoryHistory, getRouteApi, RouterProvider } from '@kitr/router'
import pages from '@kitr/router/routes'
import { createTestApp } from '@kitr/testing'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

const routes = defineRoutes([pages], (r) =>
  r.page('/projects/$id', {
    loader: ({ params }) => ({ id: params.id, name: params.id === 'apollo' ? 'Apollo' : 'Hermes' }),
    component: function ProjectPage() {
      return <h1>{getRouteApi('/projects/$id').useLoaderData().name}</h1>
    },
  }),
)

async function visit(path: string) {
  const app = await createTestApp()
  const router = createKitrRouter({
    routes,
    app,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  await act(async () => {
    render(<RouterProvider router={router} />)
    await router.load()
  })
  return router
}

describe('project page', () => {
  it('renders the project from the loader', async () => {
    await visit('/projects/apollo')
    expect(await screen.findByRole('heading', { name: 'Apollo' })).toBeTruthy()
  })

  it('shows the not-found page for an unknown URL', async () => {
    await visit('/teams')
    expect(await screen.findByText('Page not found')).toBeTruthy()
  })
})
```

Guards are plain functions, so test them without rendering. A redirect is thrown, and `isRedirect` recognises it:

```ts
// app/guards.test.ts
import { can, isRedirect, requireAuth } from '@kitr/router'
import { describe, expect, it } from 'vitest'

const location = { href: '/projects/apollo?tab=tasks' }

describe('guards', () => {
  it('sends Linus to sign-in when signed out', () => {
    try {
      requireAuth()({ context: { session: null }, location })
      expect.unreachable()
    } catch (redirect: any) {
      expect(isRedirect(redirect)).toBe(true)
      expect(redirect.options.to).toBe('/sign-in')
      expect(redirect.options.search).toEqual({ redirect: '/projects/apollo?tab=tasks' })
    }
  })

  it('lets Ada in and keeps her session in context', () => {
    const session = { user: { id: 'ada' } }
    expect(requireAuth()({ context: { session }, location })).toEqual({ session })
  })

  it('refuses Grace without teams.manage', () => {
    const session = { user: { id: 'grace' }, can: (permission: string) => permission !== 'teams.manage' }
    expect(() => can('teams.manage')({ context: { session } })).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN', status: 403 }),
    )
  })
})
```

A component that uses `Link` or `getRouteApi` needs a router around it: put it on a page in a small table like the one above.

## Devtools

With [devtools](/packages/devtools) installed, each resolved navigation is logged under the `router` source: `navigated /projects/apollo` when the path changed, `resolved /projects/apollo` when only the search did.

## Next steps

- [API reference](/packages/router/api): `createKitrRouter`, the guards and the default screens.
- [Query](/packages/query): the cache that loaders fill and components read.
- [Auth](/packages/auth): the session the guards read.
