---
title: Router
description: Pages on the kitr route table, rendered by TanStack Router: typed links, loaders and guards. Web, desktop and mobile apps get it free.
order: 1
---

# Router

Every app has pages: a dashboard, a list of projects, one project, a sign-in screen. With `@kitr/router` the pages are links on one chain in `app/routes.ts`. Add `.page('/projects/$id', { lazy: () => import('./pages/project') })` and `/projects/42` exists, with `id` typed in the component, the loader and every `<Link>` that points at it.

`@kitr/router` is [TanStack Router](https://tanstack.com/router/latest), re-exported unchanged, rendered by [TanStack Start](https://tanstack.com/start/latest). On top it adds the `router` extension for kitr's route table (`.root`, `.page`, `.layout`), `createKitrRouter` (the router built from that table, with kitr's defaults and the app in context), default loading, error and not-found screens, and three `beforeLoad` guards: `requireAuth`, `can` and `guards`.

The route table itself comes from the core (`defineRoutes` in `kitr/app`). It only has the methods of the extensions you list: pages from `@kitr/router/routes`, endpoints from `@kitr/api/routes`, sockets from `@kitr/realtime/routes`. A server-only project never installs this package, so its table has no `.page` and no React; its HTTP routes come from [api](/packages/api).

It runs in the browser, and on the server when the web platform renders pages there.

This guide follows Acme's project tracker at `app.acme.com`: a projects list, one page per project, a signed-in area for Ada's team, and a settings page only admins can open.

## Install

The web, desktop and mobile [platforms](/docs/platforms) require the router, so `kitr new` and `kitr add web` install it, and every UI kit has it. To add it to a project by hand:

```sh
kitr add router
```

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
- Adds no config file, no environment variables and no scripts.

`kitr add` skips any of these files that already exists. It asks no questions; `--no-install` skips the package manager and `--dry-run` prints the plan.

```sh
kitr add router --dry-run
```

`kitr remove router` removes the packages, the `kitrrc.ts` entry, the `AGENTS.md` section and `router` from the table's extension list. It leaves `app/routes.ts`, `app/document.tsx`, `app/pages/`, `app/router.tsx` and `app/client.tsx` in place, because they are your pages now.

## Configure

`@kitr/router` has no config file. You configure it where it is created, in `app/router.tsx`, which `kitr add router` writes:

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

TanStack Start calls `getRouter()` once in the browser and once per request on the server. `createKitrRouter` compiles the table into a TanStack route tree, so the `Register` block is what makes every `<Link to>`, `useParams` and `useSearch` in the app type-checked against your pages. Nothing is generated: the tree's type comes from `typeof routes`.

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

`lazy` points at the page module, which loads on first visit, so a page's components never weigh on another page's bundle. Its default export is the component, or `definePage({ component, pendingComponent, errorComponent, notFoundComponent })` when the page brings its own screens. Everything that is not a component, such as the loader, `beforeLoad`, `validateSearch` and `head`, goes on the link in `app/routes.ts`, which is a `.ts` file and holds no JSX. For a page that must be in the first bundle, pass `component` instead of `lazy` and import it at the top of `app/routes.ts`.

`routes.$types` names every page by its link (`'page /projects'`) and carries TanStack's route type for it. The table is the one place that lists what the app renders; `kitr routes:list` (from [api](/packages/api)) prints it.

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

`.group(prefix, callback)` comes from the core table, so it prefixes endpoints and sockets too; `.layout(id, options, callback)` is the router's. Route ids follow TanStack's rules, with layouts in them: the dashboard above is `/_app/dashboard`, which is what `getRouteApi('/_app/dashboard')` takes. Path syntax (`$id`, `$`, optional segments) is TanStack's, documented in its [routing guide](https://tanstack.com/router/latest/docs/framework/react/routing/routing-concepts).

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

`<Link to="/projects/$id">` without `params` is a type error, and so is a `to` that matches no page. That is the `Register` block in `app/router.tsx` at work; `getRouteApi` is typed by it too, so a wrong id is an error as well.

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

A schema library works too: pass a [Zod](https://zod.dev) schema's `parse` as `validateSearch`. For tables bound to the URL, [table](/packages/table) reads and writes these params for you.

## Navigate from code

After a form submits or an action finishes, navigate with `useNavigate`:

```tsx
// app/features/projects/archive-button.tsx
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

`navigate` takes the same typed `to`, `params` and `search` as `<Link>`. Use `<Link>` for anything the user clicks to move; it preloads on hover, renders a real `<a>` and works with a middle click. Keep `navigate` for moves that follow an action.

## Load data before the page renders

A loader runs before the page renders, on the server during server rendering and in the browser on every navigation. With [query](/packages/query), the loader fills the cache and the component reads the same entry, so the page never shows a spinner on first load:

```ts
// app/features/projects/queries.ts
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
import { projectQuery } from '#app/features/projects/queries'

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
import { projectQuery } from '#app/features/projects/queries'

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

`context.queryClient` comes from `createKitrRouter`. It is the container's `queryClient`, and on the server it belongs to this request alone. Because links preload on intent, hovering the "Apollo" link already runs this loader.

Without query, return data from the loader and read it with `route.useLoaderData()`, typed from what the loader returned. Prefer the query version: the cache is shared with every other component that shows the project, and mutations can refresh it.

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

The router boots the app before the first loader runs, so every service is ready. Don't import `app` from `#app/app` in a loader: on the server, `context.app` is a per-request fork of it, and the shared app would leak one visitor's request-scoped services into another's page.

## Add a layout

`.layout(id, options, callback)` wraps the pages in its callback in a component without adding a URL segment. The component renders `<Outlet />` where the child page goes:

```ts
// app/routes.ts
r.layout('_app', { lazy: () => import('./pages/app-layout') }, (app) =>
  app
    .page('/dashboard', { lazy: () => import('./pages/dashboard') })
    .page('/projects', { lazy: () => import('./pages/projects') }),
)
```

```tsx
// app/pages/app-layout.tsx
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

`/dashboard` and `/projects` now render inside this layout. Navigating between them keeps the layout mounted and replaces only the outlet. A layout takes the same options as a page except `validateSearch` is per page; a `beforeLoad` on it runs for every page inside (see Protect pages behind sign-in).

## Show loading, error and not-found states

`createKitrRouter` gives every route three screens without you writing them:

| Component | Shows | Markup |
| --- | --- | --- |
| `DefaultPending` | A spinner with "Loading…" for screen readers, while a loader runs. | `role="status"`, `data-kitr="pending"` |
| `DefaultError` | The error's title and message, a "Try again" button and a "Go home" link. | `role="alert"`, `data-kitr="error"`, `data-code` set to the error code |
| `DefaultNotFound` | "Page not found" and a "Go home" link. | `data-kitr="not-found"` |

They are styled by `@kitr/theme/styles.css`, which `app/document.tsx` links, through the `.kitr-pending`, `.kitr-error` and `.kitr-not-found` classes. TanStack shows the pending screen only when a loader takes longer than `defaultPendingMs` (one second by default), so fast pages never flash it.

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

"Try again" invalidates the router and resets the error boundary, so the loader runs again. Errors from [http](/packages/http), [actions](/packages/actions) and [query](/packages/query) are already `KitrError`s.

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

r.layout('_app', { beforeLoad: requireAuth(), lazy: () => import('./pages/app-layout') }, (app) =>
  app.page('/dashboard', { lazy: () => import('./pages/dashboard') }),
)
```

The guard reads `context.session`. When `session?.user` is missing, it throws a redirect to `/sign-in` with the page the visitor wanted in the `redirect` search param: Linus, signed out, opening `/projects/apollo?tab=tasks` lands on `/sign-in` with `redirect` set to `/projects/apollo?tab=tasks`. When there is a user, it returns `{ session }`, which TanStack merges into the context of every page inside the layout.

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

The guard only sees a session if you put one in the router context, through `createKitrRouter`'s `context` option. The session can come from [auth](/packages/auth) or from your own provider; see "Add fields to the router context" below.

> **Warning**
> Route guards decide what the browser shows. They do not protect data: anyone can call your API without loading the page. Check the session again on the server, in the API route or action that returns the data.

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

A session without a `can` function, or no session at all, fails every check. The guards type-check against `context.session`, so declare `session` on `KitrRouterContext` (see "Add fields to the router context"). Inside components, [auth](/packages/auth)'s `useCan()` hides buttons the user cannot use; the guard stops the page.

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

Your own guards fit in the same list. Return an object to add it to the route context. When a guard needs the page's params, build the list inside `beforeLoad`:

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

Pass extra context with `context` and declare its type once, so every `beforeLoad` and loader sees it. This is how a session reaches the guards. With `@kitr/auth` installed, `createKitrRouter` already puts the live session in `context.session` (and the platform service in `context.platform` with `@kitr/platform`), read from the container when a guard asks; the example below is for a session service of your own named `session`:

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

`KitrRouterContext` starts with `app` and `queryClient`. The root route is created with it as its context type, so what you declare here is typed in every route. Augment `'@kitr/router'`, the module that declares the interface.

Use a getter when the value changes after the router is created. TanStack Start builds the router before the app boots, so a plain `session: app.container.use('session')` would read it too early and throw `No binding named "session"`.

## Stack pages like a native app

In a phone app a tap on a list row pushes the detail over the list; the list stays where it was, scrolled to the same row, and swiping back reveals it. The browser's model is different: the list unmounts, the detail mounts, back mounts the list again from scratch. `<StackOutlet>` from `@kitr/router/stack` gives the router the native model. Put it where a layout renders its children instead of `<Outlet>`:

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

Every page inside the `_app` layout is now a page in the stack. Navigating deeper pushes; the page beneath stays mounted with its state, scroll position and playing media; history back pops it with the matching animation. Nothing else changes: links, loaders, search params and guards work as before, and the same route tree renders as plain pages on the server, during hydration and in a static build.

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

Opening `/chats/7` from that list pushes the chat over it; opening `/chats/9` from inside chat 7 pushes a second chat page, and each keeps its own params and data. Back pops to chat 7, back again to the list, still scrolled to where it was.

| Prop | What it does |
| --- | --- |
| `keepAlive` | How many covered pages stay mounted per tab. Default `5`; `false` remounts every page on back, like a plain outlet. |
| `motion` | `ios`, `android`, `plain` or `none`. Default: detected from the device; `none` when the user prefers reduced motion. |
| `gestures` | Edge swipe back and drag to dismiss. Default: on for touch devices. Pass `{ edge, commitAt, velocity }` to tune. |
| `onRootBack` | Back pressed with nothing to pop. Default: Android exits the app. |

The stack renders inside a `position: relative` box that fills its parent. Give the parent a height (`100dvh` for a full-screen app) and the pages fill it. Pages are plain `<div data-kitr-stack-page>` elements with `data-presentation` and `data-active` attributes, so CSS can style them; `--kitr-stack-page-bg` sets their background.

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

`keepAlive: false` on a route tells the stack to unmount that page as soon as it is covered: a camera or a heavy map should not keep running under the next page.

`stackParent` is for cold starts. When a notification opens `/chats/7` directly, there is no list beneath it; with `stackParent: '/chats'`, the stack puts the list under the chat on first render (the history gets both entries), so swipe back and the back button have somewhere to go. It applies only when the app started on that page; a push from inside the app already has its parent.

```ts
// app/routes.ts (inside the _app layout)
r.page('/chats/$id', { stackParent: '/chats', lazy: () => import('./pages/chat') })
```

## Swipe back and the back button

On iOS, dragging from the left edge pulls the page away and shows the one beneath, with the system's parallax; letting go past 30% of the width (or flicking) pops, letting go earlier snaps back. Covers and sheets dismiss with a downward drag, but only when the content inside is scrolled to the top, so a long list scrolls before it dismisses. Android gets the same gestures without the edge requirement for sheets, and its hardware back button follows the platform's order:

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

The back button needs the `platform` service from [`@kitr/platform`](/packages/platform): the stack subscribes to `platform.onBackButton()` when the service is in the app's container. Without it the gestures and `useStack()` still work; only the hardware button has no listener.

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

`select(tab)` opens the tab's last page, or its `to` the first time; selecting the current tab pops it to its root. `match` lists the paths a tab owns (a path and everything under it); by default a tab owns `to`. Pages of other tabs stay mounted and hidden, within the `keepAlive` limit per tab. The render prop draws the bar, so a phone gets a bottom bar and a desktop gets a sidebar from the same component.

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

`useSplitPane()` is `false` on the server and in the first client render, so the server output is the phone layout and the panes appear once the viewport is measured; nothing shifts for phones, which never split.

## Limit a route to some platforms

An app that ships as a marketing site, an authed web app and a phone app shares one route tree, but not every route belongs everywhere: the pricing page exists on `www` only, the account pages on the authed builds. `onlyPlatform()` is a `beforeLoad` guard that renders not-found (or redirects) on the other platforms:

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

Keys are platform names from `kitrrc.ts` (`www`, `phone`), platform types (`web`, `mobile`, `desktop`), OS names (`ios`) or `native`. The guard reads `context.platform` (the service from `@kitr/platform`, which `createKitrRouter` puts in the router context when the package is installed) and falls back to the build's `KITR_PLATFORM` and `KITR_PLATFORM_TYPE`, so it works in a project with no platform package. Because the platform of a build is a constant, the bundler also drops a component that branches on `import.meta.env.KITR_PLATFORM` from the builds where it never runs.

| Guard | Where the route exists |
| --- | --- |
| `onlyPlatform('www')` | The `www` build only. |
| `onlyPlatform(['web', 'desktop'])` | Every web and desktop build; a 404 on phones. |
| `onlyPlatform('native', { to: '/download' })` | Native shells; the web redirects to the download page. |

To render a route on the server on one platform and in the browser on another, see `ssrRoute()` with a per-platform table in [`@kitr/seo`](/packages/seo).

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
| `platforms` | The platforms (names from `kitrrc.ts`) that ship this page. The others drop it from their tree and bundle; a layout with no page left is dropped too. Default: all. |
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

`<Link to="/scan">` stays type-checked everywhere, because the type of the table is the same on every platform; only the compiled tree differs.

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

`.root` takes TanStack's root route options (`head`, `component`, `beforeLoad`, `loader`, `errorComponent`...) and may be called once per table, before any page. Without it, kitr renders a default document. [theme](/packages/theme) and [tailwind](/packages/tailwind) edit `app/document.tsx` when you add them.

On the web platform, [`mode`](/docs/platforms) decides what happens with the document: `ssr` streams it from the server on every request, `static` prerenders it at build time, and `spa` ships one shell that renders in the browser. Desktop and mobile apps always use the shell. Write the document once and it works in all of them; don't branch on the platform inside it.

On the server, each request gets its own router and its own fork of the app (`app.fork()`), so request-scoped services such as the query cache never leak between visitors. The router also boots the app before its first `load()`, so a loader never sees a provider that has not registered yet.

When the same app has a [server](/packages/server) platform, `app/server.ts` is Start's server entry: a request for a path the kitr server has routes for (endpoints, sockets, the health check) goes to that server, everything else renders a page. One process in development and in `ssr` builds, two tables.

## Reach the router from a service

`createKitrRouter` binds the router in the container as `router`, so code that is not a component can navigate without importing the table:

```ts
// app/features/projects/open-project.ts
import { app } from '#app/app'

export function openProject(id: string) {
  const router = app.container.use('router')
  return router.navigate({ to: '/projects/$id', params: { id } })
}
```

The binding is typed as TanStack's `AnyRouter`, so `to` is not checked here. Inside components, prefer `useNavigate()`, which is.

## Keep file routes

This section is the one place that documents file routes. A project that already has `app/routes/__root.tsx` keeps working: `@kitr/vite` sees the file and lets TanStack's route generator build `app/routeTree.gen.ts` as before, and `createKitrRouter({ routeTree, app })` takes that tree. Route files import `createFileRoute` from `@tanstack/react-router`, because the generator owns that line. New projects get the table; nothing forces a move, and the two can't mix in one app.

## Commands

| Command | What it does |
| --- | --- |
| `kitr make:page <path>` | Writes `app/pages/<path>.tsx` with a component, and appends `.page('<path>', { lazy })` to `app/routes.ts`. |

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

`projects/:id` is accepted for `projects/$id`. `--force` overwrites an existing page file. `kitr eject stub page` copies the template to `stubs/page.ts` so you can change what every new page looks like. Quote the argument in shells that expand `$`. When `app/routes.ts` is not one method chain (a callback with a block body), the command writes the page and prints the link to add by hand.

`kitr doctor` reports a router with no pages (`app/routes.ts` missing) and warns about imports from `@tanstack/react-router` in app code; everything it exports comes from `@kitr/router`.

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

Testing with the app's own table from `app/routes.ts` works the same way; build the small table above when you want a test that does not depend on every page. Without a `.root`, kitr renders a default document around the page.

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

To render one component that uses `Link` or `getRouteApi` without the whole app, put it on a page in a small table like the one above. Links need a router around them.

## Devtools

With [devtools](/packages/devtools) installed, every resolved navigation is logged to the overlay's log under the `router` source: `navigated /projects/apollo` when the path changed, `resolved /projects/apollo` when only the search did. Each entry carries the previous path and the new search params.

## Next steps

- [API reference](/packages/router/api): `createKitrRouter`, the `router` extension, the guards and the default screens with their signatures.
- [TanStack Router documentation](https://tanstack.com/router/latest/docs/framework/react/overview): routing, search params, loaders and everything re-exported here.
- [Query](/packages/query): the cache that loaders fill and components read.
- [Auth](/packages/auth): the session the guards read, and `useCan()` for components.
- [Platforms](/docs/platforms): `ssr`, `static` and `spa` modes, and the desktop and mobile shells.
