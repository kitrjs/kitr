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
kitr make:action tasks/rename
```

```ts
// app/actions/tasks/rename.ts
import { defineAction } from 'kitr/actions'
import { z } from 'zod'

export const renameTask = defineAction('tasks.rename', {
  input: z.object({ id: z.string(), title: z.string().min(1) }),
  effects: (task) => ({ invalidate: [['tasks', 'list']] }),
  handler: async ({ input }) => db.tasks.update(input.id, { title: input.title }),
})
```

Call it from a form or a mutation. Validation failures reach the form's fields; the effect refreshes every task list:

```tsx
const rename = useKitrMutation(defineMutation(renameTask.mutation()))
```

## Live updates

With [Sockets](/packages/socket), one channel definition serves both ends. The server publishes; every open browser applies the event's cache effects:

```ts
// app/channels/tasks.ts
export const tasksChannel = defineChannel<{ board: string }>({
  name: 'tasks',
  events: { changed: { effects: ({ board }) => ({ invalidate: [['tasks', 'list', { board }]] }) } },
  authorize: (session) => !!session,
})
```

## Server rendering and SEO

[SSR and SEO](/packages/ssr) controls which pages render on the server and what goes in their `<head>`:

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

`npm start` runs `kitr serve`, a Node server for the build. The output is also a standard fetch handler, so platforms that run those directly work too.
