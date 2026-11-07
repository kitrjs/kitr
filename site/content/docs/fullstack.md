---
title: A full-stack app
description: An app with its own API, server actions and live updates, in one codebase.
---

# A full-stack app

When you own the backend too, keep it in the same project. The `fullstack` kit runs on [TanStack Start](https://tanstack.com/start): pages render on the server, server actions run on the server, and the browser calls both with full types.

```sh
kitr new tasks --kit fullstack
```

## Server actions or API routes?

Both run on your server. Pick by who calls them:

| Use | When |
| --- | --- |
| [Server actions](/packages/actions) | Only your own React app calls it. The quickest way: no routes, no client to set up. |
| [API routes](/packages/api) | Something else calls it too: a mobile app, a partner, a webhook. You get URLs, OpenAPI and a typed client. |

Many apps use actions for the UI and a handful of API routes for integrations.

## A server action

```sh
kitr make:mutation tasks/rename
```

```ts
// app/actions/tasks/rename.ts
import { defineMutation } from 'kitr/actions'
import { z } from 'zod'

export const renameTask = defineMutation('tasks.rename', {
  input: z.object({ id: z.string(), title: z.string().min(1) }),
  effects: (task) => ({ invalidate: [['tasks', 'list']] }),
  handler: async ({ input }) => db.tasks.update(input.id, { title: input.title }),
})
```

`kitr types` registers the name (it runs with `kitr dev`), so a component uses it with full types. Validation failures reach the form's fields; the effect refreshes every task list:

```tsx
const rename = useMutation('tasks.rename')
```

Reads are `defineQuery('tasks.list', { handler })`, used as `useSuspenseQuery('tasks.list')` in a component and `queryOptions('tasks.list')` in a loader.

## Live updates

With [Realtime](/packages/realtime), one channel definition serves both ends. The server publishes; every open browser applies the event's cache effects:

```ts
// app/channels/tasks.ts
export const tasksChannel = defineChannel<{ board: string }>({
  name: 'tasks',
  events: { changed: { effects: ({ board }) => ({ invalidate: [['tasks', 'list', { board }]] }) } },
  authorize: (session) => !!session,
})
```

## Server rendering and SEO

[SEO](/packages/seo) controls which pages render on the server and what goes in their `<head>`:

```ts
export const Route = createFileRoute('/tasks/$id')({
  head: ({ loaderData }) => seo({ title: loaderData.title, description: loaderData.summary }),
})
```

## Deploying

```sh
npm run build
npm start
```

`npm start` runs `kitr start`, which serves each platform's build (the site on srvx, the API on its runtime). The output is also a standard fetch handler, so platforms that run those directly work too.
