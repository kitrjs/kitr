---
title: Query
description: Load data from your API, keep it cached, and refresh it when something changes.
order: 1
---

# Query

Most screens show data that lives on a server: a list of projects, a user's profile, today's orders. `kitr/query` loads that data, keeps a cached copy so going back to a page is instant, and refreshes it when it changes, whether because you saved something, another tab did, or a live update arrived.

It is [TanStack Query](https://tanstack.com/query), re-exported, plus a small **data contract**: you describe each piece of data once, and every source (a REST API, your own API routes, server actions, realtime channels) plugs into it the same way.

## When to use it

Use queries for **server data**: anything a server owns and the browser only displays or changes.

For values that only exist in the browser, such as a cart or a theme choice, use [State](/packages/state).

## Install

```sh
kitr add query
```

This installs `@kitr/query`, `@tanstack/react-query` and its devtools, registers the provider in `kitrrc.ts`, and writes `config/query.ts`. Every kit already includes it.

## Describe your data once

A query has a **key** (its name in the cache) and a **fetch** function. Put them in a feature's `queries.ts`:

```ts
// app/features/projects/queries.ts
import { createKeys } from 'kitr/app'
import { defineMutation, defineQuery } from 'kitr/query'

export const projectKeys = createKeys('projects')

export const projectsQuery = defineQuery({
  key: () => projectKeys.list(),
  fetch: async () => {
    const res = await fetch('/api/projects')
    return (await res.json()) as Project[]
  },
})

export const projectQuery = defineQuery({
  key: (id: string) => projectKeys.detail(id),
  fetch: async (id) => (await fetch(`/api/projects/${id}`)).json() as Promise<Project>,
})
```

`createKeys('projects')` gives you consistent keys (`all`, `lists()`, `list(filters)`, `details()`, `detail(id)`), so every part of the app agrees on what to refresh.

You will rarely write `fetch` by hand. [HTTP](/packages/http), [API](/packages/api), [server actions](/packages/actions) and [realtime channels](/packages/realtime) each produce these contracts for you.

## Show it in a component

```tsx
import { useSuspenseQuery } from 'kitr/query'
import { projectsQuery } from './queries'

export function ProjectList() {
  const { data: projects } = useSuspenseQuery(projectsQuery.options())
  return <ul>{projects.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
}
```

`.options(input)` returns ordinary TanStack `queryOptions`, so `useQuery`, `useSuspenseQuery` and `prefetchQuery` all accept it.

## Load before the page renders

Start the request in the route's loader so data arrives with the page instead of after it:

```ts
// app/routes/projects/index.tsx
export const Route = createFileRoute('/projects/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(projectsQuery.options()),
  component: ProjectList,
})
```

With server rendering, the server fetches once and the browser reuses the result.

## Change data and refresh what's affected

A mutation changes something on the server. Instead of telling each component to refetch, the mutation declares its **effects** on the cache:

```ts
export const renameProject = defineMutation({
  mutate: async (input: { id: string; name: string }) =>
    (await fetch(`/api/projects/${input.id}`, { method: 'PATCH', body: JSON.stringify(input) })).json() as Promise<Project>,
  effects: (project) => ({
    set: [{ key: projectKeys.detail(project.id), data: project }],
    invalidate: [projectKeys.lists()],
  }),
})
```

- `set` writes the new value straight into the cache, with no refetch.
- `invalidate` marks entries stale so they refetch (prefix match: `projectKeys.lists()` covers every filtered list).
- `remove` drops entries entirely.

Use it with `useMutation`, which applies the effects for you when given a definition:

```tsx
import { useMutation } from 'kitr/query'

const rename = useMutation(renameProject)
rename.mutate({ id, name })
```

`useKitrMutation(renameProject)` is the same thing under its older name.

## Use a query or mutation by name

[Server actions](/packages/actions) register every `defineQuery('projects.list', ...)` and `defineMutation('projects.rename', ...)` under its name, and `kitr types` writes those names into `.kitr/actions.ts` so they are typed. Every hook in `kitr/query` then takes the name as its first argument, the input as the second, and TanStack overrides as the third:

```tsx
import { queryOptions, useMutation, useQuery, useSuspenseQuery } from 'kitr/query'

const { data } = useQuery('projects.list', { status: 'open' }, { refetchInterval: 10_000 })
const { data: projects } = useSuspenseQuery('projects.list', { status: 'open' })
const rename = useMutation('projects.rename', { onSuccess: () => toast('Renamed') })
const options = queryOptions('projects.list', { status: 'open' }) // for loaders
```

The input is optional when every field of it is optional. A name that is not registered, or a mutation name given to `useQuery`, is a type error; at run time the hook throws `[kitr/query] "projects.rnaem" is not registered` with the names that are.

Outside React, `call` runs an operation by name: a query fetches, a mutation mutates. In the browser it is a request; on the server the handler runs in-process:

```ts
import { call } from 'kitr/query'

const open = await call('projects.list', { status: 'open' })
await call('projects.rename', { id: 'prj_42', name: 'Acme site' })
```

Every hook also accepts the imported definition in place of the name, `useQuery(listProjects, input)`, and plain TanStack options as before. The three forms produce the same query options, so a component and a loader using different forms share one cache entry.

## Live updates

A subscription is a stream of events whose effects land in the same cache. When an event arrives, the matching queries update, and every component showing them re-renders:

```tsx
useSubscription(projectEvents, { projectId })
```

[Realtime](/packages/realtime) produce subscriptions from channel definitions; you can also write one by hand with `defineSubscription`.

## Errors

Every failure, whatever its source, becomes a `KitrError` with a `code`, `status`, `message` and, for validation errors, `fieldErrors`. [Forms](/packages/forms) map `fieldErrors` onto the right fields. Queries don't retry on 4xx errors, only on network and server failures.

## Configuration

```ts
// config/query.ts
import { defineConfig } from 'kitr/query'

export default defineConfig({
  // Navigating back within 30s never refetches.
  staleTime: 30_000,
})
```

| Option | Default | Description |
| --- | --- | --- |
| `staleTime` | `30_000` | How long data counts as fresh, in milliseconds. |
| `defaultOptions` | | Passed to the `QueryClient` as-is. |
| `createClient` | | Build the `QueryClient` yourself; the other options are ignored. |

## Next steps

- [API reference](/packages/query/api)
- [TanStack Query docs](https://tanstack.com/query/latest/docs/framework/react/overview): everything there works as written, imported from `kitr/query`.
