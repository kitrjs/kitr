---
title: Loading and saving data
description: The one idea that ties kitr together, a single contract for every data source.
---

# Loading and saving data

Apps get data from many places: a REST API someone else built, your own API routes, server functions, a WebSocket. Usually each comes with its own way of loading, caching and reporting errors, and your components end up knowing which is which.

In kitr, every source produces the same three things:

| Kind | What it does | Example |
| --- | --- | --- |
| **Query** | Reads data | The list of projects |
| **Mutation** | Changes data, then says what in the cache is now out of date | Rename a project |
| **Subscription** | A stream of events that update the cache | A teammate renamed a project |

Components only ever use queries, mutations and subscriptions. Swap a REST endpoint for a server action and no component changes.

## Where contracts come from

```ts
// An existing REST API (kitr add http)
defineQuery(httpQuery(http, { path: 'projects', key: () => projectKeys.list() }))

// Your own API routes (kitr add api)
defineQuery(api.projects.index.query())

// A server action (kitr add actions)
defineQuery(listProjects.query())

// Hand-written, for anything else
defineQuery({ key: () => projectKeys.list(), fetch: () => getProjectsSomehow() })
```

All four give you the same object, used the same way:

```tsx
const { data } = useSuspenseQuery(projectsQuery.options())
```

## Effects instead of manual refetching

The most common bug in data-heavy apps is a screen that shows stale data after a save. kitr fixes it at the source: a mutation declares what it changes.

```ts
export const renameProject = defineMutation(
  api.projects.update.mutation({
    effects: (project) => ({
      set: [{ key: projectKeys.detail(project.id), data: project }], // update this entry now
      invalidate: [projectKeys.lists()],                              // refetch every list
    }),
  }),
)
```

Every screen showing that project or a list of projects updates, without any component knowing the others exist. A socket event can carry the same effects, so a change made in another browser lands in the same cache.

## Keys

A **key** names a piece of data in the cache. `createKeys` makes them consistent so effects can find what to update:

```ts
const projectKeys = createKeys('projects')

projectKeys.all            // ['projects']                       everything about projects
projectKeys.lists()        // ['projects', 'list']               every list
projectKeys.list({ page }) // ['projects', 'list', { page: 2 }]  one list
projectKeys.detail(id)     // ['projects', 'detail', '42']       one project
```

Invalidating a key also invalidates every key that starts with it.

## Errors

Whatever the source, a failure arrives as a `KitrError` with `code`, `status`, `message` and, for validation failures, `fieldErrors`. [Forms](/packages/forms) puts `fieldErrors` under the right inputs automatically.

## Learn more

- [Query](/packages/query): the full API
- [HTTP](/packages/http), [API routes](/packages/api), [server actions](/packages/actions), [sockets](/packages/socket): the sources
