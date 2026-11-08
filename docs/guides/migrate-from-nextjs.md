---
title: Migrate from Next.js
description: Move a Next.js App Router project to kitr page by page, with a map from every Next.js concept to its kitr equivalent.
packages: web, router, actions, api, query, seo
platforms: web, server
time: 60 min
---

# Migrate from Next.js

Most of a Next.js app is React components, and those move unchanged. What changes is the frame around them: where routes live, how a page gets its data, how the browser calls the server, and how the head is set. kitr renders with [TanStack Start](https://tanstack.com/start) and routes with [TanStack Router](https://tanstack.com/router), so pages are server-rendered like in Next.js, but data loading is explicit and every route, param and search value is typed.

This guide moves `acme-projects`, a Next.js App Router app with a home page, a project list, a project page at `/projects/[id]`, a server action that creates projects, an API route for the mobile app and a `middleware.ts` that guards the app. Read the concept map first, then move one piece at a time.

## Before you start

You need the Next.js project, [Node.js](https://nodejs.org) 22 or newer and the kitr CLI (`npm install -g @kitr/kitr`). The guide assumes the App Router; for the Pages Router, `getServerSideProps` maps to a route `loader` the same way server components do below.

Decide what you are migrating for before you start. kitr fits when you want typed routes and search params, server actions you can test without a server, an API with OpenAPI for other clients, and an app you can run on any Node host. If the app depends on Next.js-only features, such as incremental static regeneration on Vercel or React Server Components streaming data into the page, read "What has no equivalent" first.

## Map the concepts

| Next.js | kitr | Notes |
| --- | --- | --- |
| `app/page.tsx` | `.page('/', { lazy: () => import('./pages/home') })` in `app/routes.ts` | Every page is a link on the route table; the component lives in `app/pages/`. |
| `app/projects/page.tsx` | `.page('/projects', ...)` + `app/pages/projects/index.tsx` | |
| `app/projects/[id]/page.tsx` | `.page('/projects/$id', ...)` + `app/pages/projects/id.tsx` | `$id` is the param; `getRouteApi('/projects/$id').useParams()` reads it, typed. |
| `app/[...slug]/page.tsx` | `.page('/$', ...)` | The splat param is `_splat`. |
| `app/layout.tsx` | `app/document.tsx` | The HTML document; `.root({ head, component: RootDocument })` mounts it. |
| `app/(app)/layout.tsx` | `.layout('_app', options, (app) => ...)` | A pathless layout: it adds no URL segment. |
| `loading.tsx` | `pendingComponent` on the route | |
| `error.tsx` | `errorComponent` on the route | |
| `not-found.tsx` | `notFoundComponent` on the root route | |
| An async server component that fetches | A route `loader` plus `useSuspenseQuery` | The loader runs on the server for the first request and in the browser after. |
| Server actions (`'use server'`) | `defineMutation` and `defineQuery` from [Actions](/packages/actions) | Called by name with `useMutation('projects.create')`. |
| Route handlers (`app/api/*/route.ts`) | Controllers in [API routes](/packages/api) | With validation, OpenAPI and a typed client. |
| `middleware.ts` | `beforeLoad` on a layout route, and server middleware | Page guards and API middleware are separate. |
| `export const metadata`, `generateMetadata` | `head: () => seo({...})` from [SEO](/packages/seo) | `head` can read loader data. |
| `generateStaticParams` | `web({ mode: 'static' })` with prerendering | Every linked route is rendered at build time. |
| `next/link` | `Link` from `@kitr/router` | `href` becomes `to` plus `params`. |
| `useRouter().push` | `useNavigate()` from `@kitr/router` | |
| `useSearchParams` | `validateSearch` on the page link plus `getRouteApi(path).useSearch()` | Search params are parsed and typed. |
| `NEXT_PUBLIC_*` | `VITE_*`, declared in `app/env.ts` | |
| `next.config.js` | `kitrrc.ts`, `vite.config.ts` and `config/*.ts` | |
| `next dev`, `next build`, `next start` | `kitr dev`, `kitr build`, `kitr start` | |

## Create the kitr project

Create the new project next to the old one, so both run while you move pages over:

```sh
kitr new acme-projects-kitr --kit fullstack
cd acme-projects-kitr
kitr add seo
```

The `fullstack` kit gives you a server-rendered web platform (`site`, port 3000), an API server (`api`, port 3001), [Actions](/packages/actions), [Query](/packages/query), [Forms](/packages/forms) and Tailwind. `npm run dev` starts both.

Copy the parts that are plain React first: `components/`, `lib/`, hooks and styles. Put components in `app/components/`, and import them with the `#components/*` alias instead of Next.js's `@/components/*`:

```sh
cp -r ../acme-projects/components/* app/components/
```

Then replace `@/components/` with `#components/` across the copied files with your editor's search and replace. Remove `'use client'` lines as you go; they do nothing in kitr, because every component renders on the server and hydrates in the browser.

## Move the root layout

`app/layout.tsx` in Next.js renders `<html>`, `<body>` and the children. In kitr that is `app/document.tsx`, mounted by `.root()` at the top of the route table. The kit already wrote both; move your fonts, global CSS and site chrome into the document:

```tsx
// app/document.tsx
import { HeadContent, Link, Outlet, Scripts } from '@kitr/router'
import appCss from '#app/styles/app.css?url'

export function head() {
  return {
    meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    links: [{ rel: 'stylesheet', href: appCss }],
  }
}

export function RootDocument() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header className="flex gap-4 p-4">
          <Link to="/">Acme</Link>
          <Link to="/projects">Projects</Link>
        </header>
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
```

```ts
// app/routes.ts
import { defineRoutes } from '@kitr/kitr/app'
import router from '@kitr/router/routes'
import { head, RootDocument } from './document'

export const routes = defineRoutes([router], (r) =>
  r
    .root({ head, component: RootDocument, notFoundComponent: () => <p>We could not find that page.</p> })
    .page('/', { lazy: () => import('./pages/home') }),
)
```

`<Outlet />` is where Next.js put `{children}`. `<HeadContent />` renders the `head` of every matched route, and `<Scripts />` loads the client bundle. Leave both in place.

## Move a page with data

In Next.js, the project list is an async server component that queries the database:

```tsx
// app/projects/page.tsx (Next.js)
import { db } from '@/lib/db'

export const metadata = { title: 'Projects · Acme' }

export default async function ProjectsPage() {
  const projects = await db.project.findMany({ orderBy: { createdAt: 'desc' } })
  return <ul>{projects.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
}
```

In kitr, the query becomes a server action, and the page loads it in its `loader`:

```ts
// app/actions/projects/list.ts
import { defineQuery } from '@kitr/actions'
import { db } from '#server/db'

export const listProjects = defineQuery('projects.list', {
  handler: () => db.project.findMany({ orderBy: { createdAt: 'desc' } }),
})
```

```ts
// app/routes.ts
import { queryOptions } from '@kitr/query'
import { seo } from '@kitr/seo'

r.page('/projects', {
  loader: ({ context }) => context.queryClient.ensureQueryData(queryOptions('projects.list')),
  head: () => seo({ title: 'Projects · Acme' }),
  lazy: () => import('./pages/projects/index'),
})
```

```tsx
// app/pages/projects/index.tsx
import { useSuspenseQuery } from '@kitr/query'

export default function ProjectsPage() {
  const { data: projects } = useSuspenseQuery('projects.list')
  return <ul>{projects.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
}
```

Three things changed:

- The data access moved out of the component into `app/actions/projects/list.ts`. The handler only runs on the server; your database client never reaches the browser bundle, as with a server component.
- The loader runs before the page renders. On the first request it runs on the server and the HTML arrives with the list in it; on a client-side navigation it runs in the browser, which calls the action over HTTP.
- The data lands in the [Query](/packages/query) cache, so going back to `/projects` is instant, and a mutation can refresh it (next section).

Keep the database client you had: Prisma, Drizzle, a plain driver. Move `lib/db.ts` to `server/db.ts` so nothing under `app/components` imports it by accident. [DB](/packages/db) can manage its connection lifecycle when you are ready.

## Move a dynamic route

`app/projects/[id]/page.tsx` becomes a `.page('/projects/$id', ...)` link and `app/pages/projects/id.tsx`. The param is typed, and a missing project becomes a 404 with `notFound()`:

```ts
// app/routes.ts
import { queryOptions } from '@kitr/query'
import { notFound } from '@kitr/router'
import { seo } from '@kitr/seo'

r.page('/projects/$id', {
  loader: async ({ context, params }) => {
    const project = await context.queryClient.ensureQueryData(queryOptions('projects.show', { id: params.id }))
    if (!project) throw notFound()
    return { name: project.name }
  },
  head: ({ loaderData }) => seo({ title: `${loaderData?.name} · Acme` }),
  lazy: () => import('./pages/projects/id'),
})
```

```tsx
// app/pages/projects/id.tsx
import { useSuspenseQuery } from '@kitr/query'
import { getRouteApi } from '@kitr/router'

const route = getRouteApi('/projects/$id')

export default function ProjectPage() {
  const { id } = route.useParams()
  const { data: project } = useSuspenseQuery('projects.show', { id })
  return <h1>{project?.name}</h1>
}
```

```ts
// app/actions/projects/show.ts
import { defineQuery } from '@kitr/actions'
import { z } from 'zod'
import { db } from '#server/db'

export const showProject = defineQuery('projects.show', {
  input: z.object({ id: z.string() }),
  handler: ({ input }) => db.project.findUnique({ where: { id: input.id } }),
})
```

`head` replaces `generateMetadata`: it receives the loader's data, so the title is the project's name without a second fetch.

Links change from a string `href` to a route and params. TypeScript checks both, so a link to a route that does not exist fails to compile:

```tsx
// Next.js
<Link href={`/projects/${project.id}`}>{project.name}</Link>

// kitr
<Link to="/projects/$id" params={{ id: project.id }}>{project.name}</Link>
```

## Move a server action

A Next.js server action is a function marked `'use server'` that a form posts to:

```ts
// app/projects/actions.ts (Next.js)
'use server'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'

export async function createProject(formData: FormData) {
  const name = String(formData.get('name'))
  if (name.length < 2) return { error: 'Name too short' }
  await db.project.create({ data: { name } })
  revalidatePath('/projects')
}
```

In kitr it is a mutation with a schema, and the cache refresh is declared next to it instead of called by hand:

```ts
// app/actions/projects/create.ts
import { defineMutation } from '@kitr/actions'
import { z } from 'zod'
import { db } from '#server/db'

export const createProject = defineMutation('projects.create', {
  input: z.object({ name: z.string().trim().min(2, 'Give the project a name of at least two letters') }),
  effects: { invalidate: [['action', 'projects.list']] },
  handler: ({ input }) => db.project.create({ data: { name: input.name } }),
})
```

```tsx
// app/components/projects/new-project-form.tsx
import { FieldInput, Form, FormField, SubmitButton, useSchemaForm } from '@kitr/forms'
import { useMutation } from '@kitr/query'
import { z } from 'zod'

const schema = z.object({ name: z.string().trim().min(2, 'Give the project a name of at least two letters') })

export function NewProjectForm() {
  const create = useMutation('projects.create')
  const form = useSchemaForm(schema, { defaultValues: { name: '' } })
  return (
    <Form form={form} onSubmit={create.mutateAsync} resetOnSuccess>
      <FormField name="name" label="New project">
        <FieldInput />
      </FormField>
      <SubmitButton>Create</SubmitButton>
    </Form>
  )
}
```

| Next.js | kitr |
| --- | --- |
| `formData.get('name')` | `input.name`, validated by the schema before the handler runs |
| `return { error }` and `useFormState` | `throw KitrError.validation({ name: ['...'] })`; the form shows it under the field |
| `revalidatePath('/projects')` | `effects: { invalidate: [['action', 'projects.list']] }` |
| `<form action={createProject}>` | `<Form onSubmit={create.mutateAsync}>` |

A kitr action needs JavaScript in the browser to submit. If a form must work with JavaScript turned off, post it to an API route instead. [Build a full-stack app](/guides/fullstack-app) walks through actions and forms in full.

## Move route handlers

`app/api/projects/route.ts` serves the mobile app. In kitr, an endpoint for other clients is a controller in [API routes](/packages/api), served by the `api` platform and, in the same process, under `/api` on the site:

```ts
// app/api/projects/route.ts (Next.js)
import { db } from '@/lib/db'

export async function GET() {
  return Response.json(await db.project.findMany())
}
```

```ts
// server/controllers/projects-controller.ts
import { db } from '#server/db'

export default class ProjectsController {
  async index() {
    return db.project.findMany()
  }
}
```

```ts
// server/routes.ts
import { defineRoutes } from '@kitr/kitr/app'
import api from '@kitr/api/routes'
import ProjectsController from '#server/controllers/projects-controller'

export const routes = defineRoutes([api], (router) =>
  router.group('/api', (r) => api.resource('projects', ProjectsController, { only: ['index'] })),
)

export type ServerRoutes = typeof routes.$types
```

`GET /api/projects` answers the same JSON as before, so the mobile app does not change. `kitr api:sync` writes an OpenAPI document for it. Keep both kinds: actions for your own pages, API routes for everyone else.

## Move middleware

Next.js runs one `middleware.ts` for every request. kitr splits it by what it protects.

Pages: guard a layout route in `beforeLoad`. Every route under it inherits the guard:

```ts
// app/routes.ts
import { requireAuth } from '@kitr/router'

r.layout('_app', {
  beforeLoad: requireAuth(),
}, (app) => app.page('/projects', { lazy: () => import('./pages/projects') }))
```

Move the guarded `.page()` links inside the layout's callback: `app.page('/projects', ...)` still answers `/projects`, because `_app` adds no URL segment. An anonymous visitor goes to `/sign-in?redirect=/projects`.

The API and actions: use server middleware. `authMiddleware` from `@kitr/auth/server` on API route groups, and `requireSession` from `@kitr/actions` on actions. [Add sign-in, end to end](/guides/authentication) wires both to one session.

Redirects and rewrites that `next.config.js` or middleware did for SEO belong in the host (nginx, your CDN) or in a `beforeLoad` that throws `redirect({ to })`.

## Move environment variables

Rename `NEXT_PUBLIC_` variables to `VITE_`, and declare every variable in `app/env.ts`, so a missing one fails at startup:

```ts
// app/env.ts
import { createEnv, env as e } from '@kitr/kitr/env'

export const env = createEnv({
  public: {
    VITE_APP_NAME: e.string({ default: 'Acme Projects' }),
    VITE_SENTRY_DSN: e.url({ optional: true }),
  },
  server: {
    DATABASE_URL: e.url(),
  },
})
```

Import `env` from `#app/env` instead of reading `process.env` in components. Reading a server variable in the browser throws, where Next.js would have silently given you `undefined`.

## What has no equivalent

Some Next.js features have no kitr counterpart. Plan for them:

| Next.js | What to do in kitr |
| --- | --- |
| Incremental static regeneration (`revalidate`) | Render with `ssr` and set `Cache-Control` headers so your CDN caches pages, or rebuild a `static` site when content changes. |
| React Server Components | Components render on the server and hydrate. Keep server-only code in actions and controllers; the loader replaces fetching in the component. |
| `next/image` | Use `<img>` with `width`, `height` and `loading="lazy"`, and resize at your CDN or image host. |
| `next/font` | Self-host with [Fontsource](https://fontsource.org) and link the CSS from `head()` in `app/document.tsx`. |
| Edge runtime per route | Run the `api` platform on Cloudflare Workers; pages run on Node. |
| Parallel and intercepting routes | Render the modal as a child route, or keep its open state in a search param with `validateSearch`. |

## Switch over

Move pages until the kitr app covers every route, then compare the two side by side: the same URLs, the same titles, the same API responses. Point the mobile app and any partners at the new `/api` first, since those endpoints did not change shape. Then build and deploy:

```sh
npm run build
npm start
```

[Deploy to production](/guides/deploy) covers Docker, environment variables and hosts. Keep the Next.js deployment until the new one has served real traffic for a while; switching back is a DNS change.

## Next steps

- [Build a full-stack app](/guides/fullstack-app): the kitr way of doing what this guide translated, from scratch.
- [Router](/packages/router): route files, loaders, search params and guards.
- [Actions](/packages/actions): middleware, errors and testing actions.
- [SEO](/packages/seo): titles, Open Graph, the sitemap and prerendering.
- [TanStack Router file-based routing](https://tanstack.com/router/latest/docs/framework/react/routing/file-based-routing): every naming rule for route files.
