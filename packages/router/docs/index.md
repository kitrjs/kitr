---
title: Router
description: Turn files in app/routes into pages, with links, loaders and guards. Every app has it.
order: 1
---

# Router

[TanStack Router](https://tanstack.com/router), file based: a file in `app/routes` is a page, `$id` in a name is a parameter, `_app.tsx` is a layout. kitr adds `createKitrRouter`, which puts the app and the query client in route context, wraps the tree in every provider, restores scroll and supplies pending, error and not-found components, plus guards for authentication and permissions.

## Install

```sh
kitr add router
```

Every UI kit includes it. `kitr make:route projects/:id` writes `app/routes/projects/$id.tsx`.

## A route

```tsx
// app/routes/projects/$id.tsx
import { createFileRoute } from 'kitr/router'
import { useSuspenseQuery } from 'kitr/query'
import { projectQuery } from '#app/features/projects/queries'

export const Route = createFileRoute('/projects/$id')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(projectQuery.options(params.id)),
  component: ProjectPage,
})

function ProjectPage() {
  const { id } = Route.useParams()
  const { data } = useSuspenseQuery(projectQuery.options(id))
  return <h1>{data.name}</h1>
}
```

Loaders fill the query cache, so the page renders with data and later visits are instant. `Link`, `useNavigate`, `useSearch` and the rest come from `kitr/router` unchanged.

## Guards

```tsx
// app/routes/_app.tsx
import { createFileRoute, requireAuth, can, guards } from 'kitr/router'

export const Route = createFileRoute('/_app')({
  beforeLoad: guards(requireAuth({ to: '/sign-in' }), can('projects.read')),
})
```

`requireAuth` reads `context.session` (set by [Auth](/packages/auth)) and redirects anonymous visitors, remembering where they were going. `can` checks an ability.

## Defaults

`DefaultPending`, `DefaultError` and `DefaultNotFound` are used until a route sets its own. Pass `context` to `createKitrRouter` to add anything every route should see.
