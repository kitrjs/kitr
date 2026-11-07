---
title: Router
description: Turn files in app/routes into pages, with links, loaders and guards. Web, desktop and mobile apps get it automatically.
order: 1
---

# Router

Every app has pages: a dashboard, a list of projects, one project, a sign-in screen. With `kitr/router` each page is a file in `app/routes`. Add `app/routes/projects/$id.tsx` and `/projects/42` exists, with `id` typed in the component, the loader and every `<Link>` that points at it.

`kitr/router` is [TanStack Router](https://tanstack.com/router/latest), re-exported unchanged, rendered by [TanStack Start](https://tanstack.com/start/latest). On top it adds `createKitrRouter` (the router with kitr's defaults and the app in context), default loading, error and not-found screens, and three `beforeLoad` guards: `requireAuth`, `can` and `guards`.

It runs in the browser, and on the server when the web platform renders pages there. A server-only project has no pages and no router; its HTTP routes come from [api](/packages/api).

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
- Writes `app/router.tsx`, which creates the router (shown under Configure).
- Writes `app/client.tsx`, Start's client entry, which boots the app before it hydrates the page.
- Writes three routes: `app/routes/__root.tsx` (the HTML document, with a two-link nav and `kitr/theme/styles.css`), `app/routes/index.tsx` (`/`) and `app/routes/about.tsx` (`/about`).
- Adds a `router` section to `AGENTS.md`: routes are files in `app/routes`, `app/routeTree.gen.ts` is generated, route files import `createFileRoute` from `@tanstack/react-router`, everything else from `kitr/router`, and the root route stays platform-neutral.
- Adds no config file, no environment variables and no scripts.

`kitr add` skips any of these files that already exists. It asks no questions; `--no-install` skips the package manager and `--dry-run` prints the plan.

```sh
kitr add router --dry-run
```

`kitr remove router` removes the packages, the `kitrrc.ts` entry and the `AGENTS.md` section. It leaves `app/router.tsx`, `app/client.tsx` and `app/routes/` in place, because they are your pages now.

## Configure

`kitr/router` has no config file. You configure it where it is created, in `app/router.tsx`, which `kitr add router` writes:

```tsx
// app/router.tsx
import { createKitrRouter } from 'kitr/router'
import { app } from './app'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createKitrRouter({ routeTree, app })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
```

TanStack Start calls `getRouter()` once in the browser and once per request on the server. The `Register` block is what makes every `<Link to>`, `useParams` and `useSearch` in the app type-checked against your routes.

`createKitrRouter` accepts every [`createRouter` option](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType) except `context`, and sets different defaults for some of them:

| Option | Default | Description |
| --- | --- | --- |
| `routeTree` | required | The generated tree from `app/routeTree.gen.ts`. |
| `app` | required | The kitr app from `app/app.ts`. Put in every route's context as `context.app`, forked per request on the server. |
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

Create a file under `app/routes`, or let `kitr make:route projects` write it:

```tsx
// app/routes/projects/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Link } from 'kitr/router'

const projects = [
  { id: 'apollo', name: 'Apollo', team: 'Platform' },
  { id: 'hermes', name: 'Hermes', team: 'Billing' },
]

export const Route = createFileRoute('/projects/')({
  component: ProjectsPage,
})

function ProjectsPage() {
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

Run `kitr dev` and open `/projects`. You see the two projects as links. While `kitr dev` runs, the route generator adds the file to `app/routeTree.gen.ts`; never edit that file by hand.

Route files import `createFileRoute` from `@tanstack/react-router` because the generator owns that line and rewrites it. Everything else, such as `Link`, `useNavigate` and `Outlet`, comes from `kitr/router`. `kitr doctor` warns about any other direct `@tanstack/react-router` import.

## Map files to URLs

| File | URL |
| --- | --- |
| `app/routes/index.tsx` | `/` |
| `app/routes/about.tsx` | `/about` |
| `app/routes/projects/index.tsx` | `/projects/` |
| `app/routes/projects/$id.tsx` | `/projects/:id`, with `params.id` |
| `app/routes/projects/$id/settings.tsx` | `/projects/:id/settings` |
| `app/routes/_app.tsx` | A layout with no URL segment; wraps every route in `app/routes/_app/` |
| `app/routes/_app/dashboard.tsx` | `/dashboard`, inside the `_app` layout |
| `app/routes/files/$.tsx` | `/files/*`, the rest of the path in `params._splat` |
| `app/routes/__root.tsx` | The HTML document around every page |

The full naming rules, including route groups and lazy routes, are in TanStack's [file-based routing guide](https://tanstack.com/router/latest/docs/framework/react/routing/file-based-routing).

## Read path params

A `$name` segment becomes a typed param. Read it with `Route.useParams()`:

```tsx
// app/routes/projects/$id.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Link } from 'kitr/router'

export const Route = createFileRoute('/projects/$id')({
  component: ProjectPage,
})

function ProjectPage() {
  const { id } = Route.useParams() // '/projects/apollo' → { id: 'apollo' }
  return (
    <main>
      <h1>Project {id}</h1>
      <Link to="/projects">All projects</Link>
    </main>
  )
}
```

`<Link to="/projects/$id">` without `params` is a type error, and so is a `to` that matches no route file. That is the `Register` block in `app/router.tsx` at work.

## Read and write search params

Declare what the query string may hold with `validateSearch`. The result is typed in the component and in every link to the route:

```tsx
// app/routes/projects/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Link } from 'kitr/router'

type ProjectsSearch = { team?: string; page: number }

export const Route = createFileRoute('/projects/')({
  validateSearch: (search: Record<string, unknown>): ProjectsSearch => ({
    team: typeof search.team === 'string' ? search.team : undefined,
    page: Number(search.page ?? 1) || 1,
  }),
  component: ProjectsPage,
})

function ProjectsPage() {
  const { team, page } = Route.useSearch() // '/projects?team=Billing' → { team: 'Billing', page: 1 }
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
import { useNavigate } from 'kitr/router'

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

A loader runs before the route renders, on the server during server rendering and in the browser on every navigation. With [query](/packages/query), the loader fills the cache and the component reads the same entry, so the page never shows a spinner on first load:

```ts
// app/features/projects/queries.ts
import { createKeys } from 'kitr/app'
import { queryFrom } from 'kitr/query'

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

```tsx
// app/routes/projects/$id.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Link } from 'kitr/router'
import { useSuspenseQuery } from 'kitr/query'
import { projectQuery } from '#app/features/projects/queries'

export const Route = createFileRoute('/projects/$id')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(projectQuery.options(params.id)),
  component: ProjectPage,
})

function ProjectPage() {
  const { id } = Route.useParams()
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

Without query, return data from the loader and read it with `Route.useLoaderData()`. Prefer the query version: the cache is shared with every other component that shows the project, and mutations can refresh it.

## Use services in loaders

Loaders and guards are not components, so they cannot call `useService`. Read services from `context.app`:

```tsx
// app/routes/teams/$team.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/teams/$team')({
  loader: async ({ context, params }) => {
    const http = context.app.container.use('http')
    return http.get(`teams/${params.team}`).json<{ name: string; members: string[] }>()
  },
  component: TeamPage,
})

function TeamPage() {
  const team = Route.useLoaderData()
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

A file whose name starts with `_` is a layout without a URL segment. It renders `<Outlet />` where the child page goes:

```tsx
// app/routes/_app.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Link, Outlet } from 'kitr/router'

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

function AppLayout() {
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

Every route in `app/routes/_app/` now renders inside this layout. Navigating between them keeps the layout mounted and replaces only the outlet.

## Show loading, error and not-found states

`createKitrRouter` gives every route three screens without you writing them:

| Component | Shows | Markup |
| --- | --- | --- |
| `DefaultPending` | A spinner with "Loading…" for screen readers, while a loader runs. | `role="status"`, `data-kitr="pending"` |
| `DefaultError` | The error's title and message, a "Try again" button and a "Go home" link. | `role="alert"`, `data-kitr="error"`, `data-code` set to the error code |
| `DefaultNotFound` | "Page not found" and a "Go home" link. | `data-kitr="not-found"` |

They are styled by `kitr/theme/styles.css`, which the root route imports, through the `.kitr-pending`, `.kitr-error` and `.kitr-not-found` classes. TanStack shows the pending screen only when a loader takes longer than `defaultPendingMs` (one second by default), so fast pages never flash it.

Override one route by giving it its own component:

```tsx
// app/routes/projects/$id.tsx
import { createFileRoute } from '@tanstack/react-router'
import { type ErrorComponentProps, Link } from 'kitr/router'
import { toKitrError } from 'kitr/app'

export const Route = createFileRoute('/projects/$id')({
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
import { createKitrRouter } from 'kitr/router'
import { app } from './app'
import { AcmeError, AcmeNotFound, AcmeSpinner } from './components/route-states'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createKitrRouter({
    routeTree,
    app,
    defaultPendingComponent: AcmeSpinner,
    defaultErrorComponent: AcmeError,
    defaultNotFoundComponent: AcmeNotFound,
  })
}
```

The defaults are exported, so a custom screen can render one inside its own layout: `import { DefaultError } from 'kitr/router'`.

## Throw errors from loaders

Throw a `KitrError` from a loader and `DefaultError` shows its message as the title, with its code in `data-code`:

```tsx
// app/routes/projects/$id/archive.tsx
import { createFileRoute } from '@tanstack/react-router'
import { KitrError } from 'kitr/app'

export const Route = createFileRoute('/projects/$id/archive')({
  loader: ({ params }) => {
    if (params.id === 'apollo') throw new KitrError('CONFLICT', 'Already archived')
    return { id: params.id }
  },
  component: () => <p>Archive this project?</p>,
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

For a missing record, throw TanStack's `notFound()` instead. The route's not-found screen renders, not the error screen:

```tsx
// app/routes/projects/$id.tsx
import { createFileRoute } from '@tanstack/react-router'
import { notFound } from 'kitr/router'

const projects: Record<string, { name: string }> = { apollo: { name: 'Apollo' } }

export const Route = createFileRoute('/projects/$id')({
  loader: ({ params }) => {
    const project = projects[params.id]
    if (!project) throw notFound()
    return project
  },
  component: () => <h1>{Route.useLoaderData().name}</h1>,
})
// /projects/zeus → "Page not found"
```

## Protect pages behind sign-in

`requireAuth()` is a `beforeLoad` guard. Put it on a layout and every route under it needs a signed-in user:

```tsx
// app/routes/_app.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Outlet, requireAuth } from 'kitr/router'

export const Route = createFileRoute('/_app')({
  beforeLoad: requireAuth(),
  component: () => <Outlet />,
})
```

The guard reads `context.session`. When `session?.user` is missing, it throws a redirect to `/sign-in` with the page the visitor wanted in the `redirect` search param: Linus, signed out, opening `/projects/apollo?tab=tasks` lands on `/sign-in` with `redirect` set to `/projects/apollo?tab=tasks`. When there is a user, it returns `{ session }`, which TanStack merges into the context of every child route.

| Option | Default | Description |
| --- | --- | --- |
| `to` | `'/sign-in'` | Where anonymous visitors go. |
| `redirectParam` | `'redirect'` | The search param that carries the original URL. `false` sends no param. |

```tsx
// app/routes/_app.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Outlet, requireAuth } from 'kitr/router'

export const Route = createFileRoute('/_app')({
  beforeLoad: requireAuth({ to: '/login', redirectParam: 'next' }),
  component: () => <Outlet />,
})
// signed out at /dashboard → /login, with search { next: '/dashboard' }
```

After sign-in, send the visitor back:

```tsx
// app/routes/sign-in.tsx
import { createFileRoute } from '@tanstack/react-router'
import { useNavigate } from 'kitr/router'

export const Route = createFileRoute('/sign-in')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : '/dashboard',
  }),
  component: SignInPage,
})

function SignInPage() {
  const { redirect } = Route.useSearch()
  const navigate = useNavigate()
  async function signIn() {
    // ... sign in with kitr/auth
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

`can(permission)` asks `context.session.can(permission, subject)`. Without permission it throws a `FORBIDDEN` `KitrError` (status 403), which the route's error screen shows as "You don't have access to this page.":

```tsx
// app/routes/_app/settings.tsx
import { createFileRoute } from '@tanstack/react-router'
import { can } from 'kitr/router'

export const Route = createFileRoute('/_app/settings')({
  beforeLoad: can('teams.manage'),
  component: () => <h1>Team settings</h1>,
})
// Grace (member) opening /settings: the error screen, title 'Missing permission "teams.manage"'
```

Pass `to` to redirect instead of showing the error:

```tsx
// app/routes/_app/billing.tsx
import { createFileRoute } from '@tanstack/react-router'
import { can } from 'kitr/router'

export const Route = createFileRoute('/_app/billing')({
  beforeLoad: can('invoices.view', { to: '/upgrade' }),
  component: () => <h1>Invoices</h1>,
})
```

`subject` is fixed when the route file loads. For a check that depends on the URL, call the guard inside `beforeLoad` with the subject you build from the params:

```tsx
// app/routes/_app/projects/$id/edit.tsx
import { createFileRoute } from '@tanstack/react-router'
import { can } from 'kitr/router'

export const Route = createFileRoute('/_app/projects/$id/edit')({
  beforeLoad: (ctx) => can('projects.update', { subject: { id: ctx.params.id } })(ctx),
  component: () => <h1>Edit project</h1>,
})
```

A session without a `can` function, or no session at all, fails every check. The guards type-check against `context.session`, so declare `session` on `KitrRouterContext` (see "Add fields to the router context"). Inside components, [auth](/packages/auth)'s `useCan()` hides buttons the user cannot use; the guard stops the page.

## Combine guards

`guards(a, b, ...)` runs several `beforeLoad` functions in order, awaits each one and merges the objects they return. The first one that throws stops the rest:

```tsx
// app/routes/_app/admin.tsx
import { createFileRoute } from '@tanstack/react-router'
import { can, guards, requireAuth } from 'kitr/router'

export const Route = createFileRoute('/_app/admin')({
  beforeLoad: guards(requireAuth(), can('admin.access')),
  component: () => <h1>Admin</h1>,
})
```

Your own guards fit in the same list. Return an object to add it to the route context. When a guard needs the route's params, build the list inside `beforeLoad`:

```tsx
// app/routes/_app/teams/$team.tsx
import { createFileRoute } from '@tanstack/react-router'
import { guards, requireAuth } from 'kitr/router'

const loadTeam = async (slug: string) => ({
  team: { slug, name: slug === 'platform' ? 'Platform' : 'Billing' },
})

export const Route = createFileRoute('/_app/teams/$team')({
  beforeLoad: (ctx) => guards(requireAuth(), () => loadTeam(ctx.params.team))(ctx),
  component: TeamPage,
})

function TeamPage() {
  const { team } = Route.useRouteContext()
  return <h1>{team.name}</h1>
}
// /teams/platform → beforeLoad returns { session, team }, and the page shows "Platform"
```

When two guards return the same key, the later one wins.

## Add fields to the router context

Pass extra context with `context` and declare its type once, so every `beforeLoad` and loader sees it. This is how a session reaches the guards. Here it comes from an app service of your own named `session`:

```tsx
// app/router.tsx
import { createKitrRouter } from 'kitr/router'
import { app } from './app'
import { routeTree } from './routeTree.gen'

interface AcmeSession {
  user: { id: string; email: string; role: 'admin' | 'member' } | null
  can: (permission: string, subject?: unknown) => boolean
}

export function getRouter() {
  return createKitrRouter({
    routeTree,
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
import type { Session } from 'kitr/auth'
import { createKitrRouter } from 'kitr/router'
import type { User } from '#app/abilities'
import { app } from './app'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createKitrRouter({
    routeTree,
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

`KitrRouterContext` starts with `app` and `queryClient`. The root route is created with `createRootRouteWithContext<KitrRouterContext>()`, so what you declare here is typed in every route. Augment `'@kitr/router'`, the module that declares the interface.

Use a getter when the value changes after the router is created. TanStack Start builds the router before the app boots, so a plain `session: app.container.use('session')` would read it too early and throw `No binding named "session"`.

## Set the page title and meta tags

Each route can add tags to the document head with `head`. The root route renders them through `<HeadContent />`:

```tsx
// app/routes/projects/$id.tsx
import { createFileRoute } from '@tanstack/react-router'
import { projectQuery } from '#app/features/projects/queries'

export const Route = createFileRoute('/projects/$id')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(projectQuery.options(params.id)),
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.name ?? 'Project'} · Acme` }],
  }),
  component: () => null,
})
```

For canonical URLs, Open Graph tags and sitemaps, use [seo](/packages/seo).

## Render on the server

The root route renders the whole HTML document:

```tsx
// app/routes/__root.tsx
import type { KitrRouterContext } from 'kitr/router'
import { HeadContent, Link, Outlet, Scripts, createRootRouteWithContext } from 'kitr/router'
import type { ReactNode } from 'react'
import css0 from 'kitr/theme/styles.css?url'

export const Route = createRootRouteWithContext<KitrRouterContext>()({
  head: () => ({
    meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    links: [{ rel: 'stylesheet', href: css0 }],
  }),
  component: RootLayout,
})

function RootLayout() {
  return (
    <RootDocument>
      <nav style={{ display: 'flex', gap: 12, padding: 12 }}>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
      </nav>
      <Outlet />
    </RootDocument>
  )
}

/** The HTML shell. Start streams it on the server and hydrates it on the client. */
function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
```

On the web platform, [`mode`](/docs/platforms) decides what happens with it: `ssr` streams it from the server on every request, `static` prerenders it at build time, and `spa` ships one shell that renders in the browser. Desktop and mobile apps always use the shell. Write the root route once and it works in all of them; don't branch on the platform inside it.

On the server, each request gets its own router and its own fork of the app (`app.fork()`), so request-scoped services such as the query cache never leak between visitors. The router also boots the app before its first `load()`, so a loader never sees a provider that has not registered yet.

## Reach the router from a service

`createKitrRouter` binds the router in the container as `router`, so code that is not a component can navigate without importing the route tree:

```ts
// app/features/projects/open-project.ts
import { app } from '#app/app'

export function openProject(id: string) {
  const router = app.container.use('router')
  return router.navigate({ to: '/projects/$id', params: { id } })
}
```

The binding is typed as TanStack's `AnyRouter`, so `to` is not checked here. Inside components, prefer `useNavigate()`, which is.

## Devtools

With [devtools](/packages/devtools) installed, every resolved navigation is logged to the overlay's log under the `router` source: `navigated /projects/apollo` when the path changed, `resolved /projects/apollo` when only the search did. Each entry carries the previous path and the new search params.

## Errors

| Code | When | What to do |
| --- | --- | --- |
| `FORBIDDEN` (403) | `can(permission)` failed and no `to` was given. Message: `Missing permission "<permission>"`. | Give the user the permission, hide the link with `useCan()`, or pass `to` to redirect. |
| redirect | `requireAuth()` found no `session.user`. Not an error: TanStack follows it. | Put a session in context with `createKitrRouter({ context })`. |
| not found | No route matches, or a loader threw `notFound()`. | Add the route file, or check the id. |
| `[kitr] No binding named "session"` | The router context read a service before the app booted. | Read it through a getter, as in "Add fields to the router context". |
| `Something went wrong` | A loader threw something that is not a `KitrError`. | Throw a `KitrError` with a code and message the user can act on. |

## Commands

| Command | What it does |
| --- | --- |
| `kitr make:route <path>` | Writes a route file under `app/routes` with a component and a commented loader. |

```sh
kitr make:route projects/$id
```

This writes `app/routes/projects/$id.tsx`:

```tsx
// app/routes/projects/$id.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/projects/$id')({
  // loader: ({ context }) => context.queryClient.ensureQueryData(idQuery.options()),
  component: IdPage,
})

function IdPage() {
  return (
    <div>
      <h1>Id</h1>
    </div>
  )
}
```

`projects/index` writes `app/routes/projects/index.tsx` for the path `/projects/`; `/` writes `app/routes/index.tsx`. `--force` overwrites an existing file. `kitr eject stub route` copies the template to `stubs/route.ts` so you can change what every new route looks like. Quote the argument in shells that expand `$`: `kitr make:route 'projects/$id'`.

`kitr doctor` checks the router too: it reports when `app/routeTree.gen.ts` has not been generated yet (run `kitr dev` once) and warns about imports from `@tanstack/react-router` outside the generator's `createFileRoute` line.

## Testing

Build the router in a test with `createKitrRouter`, a test app and a memory history, then render it with `RouterProvider`:

```tsx
// app/routes/projects.test.tsx
import { createTestApp } from 'kitr/testing'
import {
  createKitrRouter,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  type KitrRouterContext,
  Outlet,
  RouterProvider,
} from 'kitr/router'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

function routes() {
  const root = createRootRouteWithContext<KitrRouterContext>()({ component: () => <Outlet /> })
  const project = createRoute({
    getParentRoute: () => root,
    path: '/projects/$id',
    loader: ({ params }) => ({ id: params.id, name: params.id === 'apollo' ? 'Apollo' : 'Hermes' }),
    component: function ProjectPage() {
      return <h1>{project.useLoaderData().name}</h1>
    },
  })
  return root.addChildren([project])
}

async function visit(path: string) {
  const app = await createTestApp()
  const router = createKitrRouter({
    routeTree: routes(),
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

Testing with the generated `routeTree` from `app/routeTree.gen.ts` works the same way; build the small tree above when you want a test that does not depend on every page.

Guards are plain functions, so test them without rendering. A redirect is thrown, and `isRedirect` recognises it:

```ts
// app/routes/guards.test.ts
import { can, isRedirect, requireAuth } from 'kitr/router'
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

To render one component that uses `Link` or `Route.useParams` without a full route tree, render it from a route's `component` in a small tree like the one above. Links need a router around them.

## Next steps

- [API reference](/packages/router/api): `createKitrRouter`, the guards and the default screens with their signatures.
- [TanStack Router documentation](https://tanstack.com/router/latest/docs/framework/react/overview): routing, search params, loaders and everything re-exported here.
- [Query](/packages/query): the cache that loaders fill and components read.
- [Auth](/packages/auth): the session the guards read, and `useCan()` for components.
- [Platforms](/docs/platforms): `ssr`, `static` and `spa` modes, and the desktop and mobile shells.
