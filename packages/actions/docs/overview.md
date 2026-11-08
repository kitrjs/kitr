---
title: Overview
description: Call server code straight from a component, like a form submit, without writing an API route.
order: 0
---

# Server actions

Rename a project, archive an invoice, invite someone to a team: a button often needs to run a bit of server code and nothing more. The traditional answer is an API route, a client for it, and types kept in step on both sides. That is a lot of ceremony for one function call, and it is where most "the frontend and backend disagree" bugs come from.

`@kitr/actions` lets you write that function once and call it from a component as if it were local.

## What it is

An action is a server function you define with `defineQuery` or `defineMutation`. The handler runs on the server; the call can come from anywhere in your React app. kitr sends the request, validates the input on the server with the schema you gave, and brings back the result or a typed error. A generated registry lets a component say `useQuery('projects.list')` and get the input and output types without importing the server file.

Actions run on both sides: the handler on the server, the call anywhere. Use them when the only caller is your own React app. When something else calls the same code too, such as a mobile app, a partner or a webhook, use [API routes](/packages/api) instead; they give you URLs, OpenAPI and a typed client.

## Install

```sh
kitr add actions
```

This installs `@kitr/actions`, creates `app/actions/`, points `app/app.ts` at the generated operation registry and runs `kitr types` once. It adds [server](/packages/server) and [query](/packages/query) first when the project does not have them. The guide's [Install](/packages/actions/guide#install) section lists every change.

## Quick start

Define a mutation with its input schema and handler:

```ts
// app/actions/projects/rename.ts
import { defineMutation } from '@kitr/actions'
import { z } from 'zod'

export const renameProject = defineMutation('projects.rename', {
  input: z.object({ id: z.string(), name: z.string().min(2) }),
  effects: (project) => ({
    set: [{ key: ['projects', 'detail', project.id], data: project }],
    invalidate: [['projects', 'list']],
  }),
  handler: async ({ input }) => {
    // Update the project in your database and return it.
    return { id: input.id, name: input.name }
  },
})
```

Call it from a component by name:

```tsx
// app/components/rename-button.tsx
import { useMutation } from '@kitr/query'

export function RenameButton({ id }: { id: string }) {
  const rename = useMutation('projects.rename')
  return (
    <button disabled={rename.isPending} onClick={() => rename.mutate({ id, name: 'Acme site' })}>
      Rename
    </button>
  )
}
```

Clicking the button sends one request; the server validates the input, runs the handler and returns the project. The `set` effect writes it into the detail cache and `invalidate` refetches every project list. `rename.mutate({ id })` is a type error because `name` is required. The guide continues from here: [Your first mutation](/packages/actions/guide#your-first-mutation).

## Built on

Actions are [TanStack Start server functions](https://tanstack.com/start/latest/docs/framework/react/server-functions). TanStack Start handles the transport: it turns a server function into an RPC endpoint at build time and a `fetch` call in the browser, with middleware and `useServerFn` as documented.

kitr adds four things on top:

| What kitr adds | Why |
| --- | --- |
| Input validation with any [Standard Schema](https://standardschema.dev) library (zod, valibot, arktype). | The server never trusts the browser, and the schema is also the TypeScript type. |
| kitr's one error shape, `KitrError`. | A validation failure lands on the right form field in [forms](/packages/forms), and every other failure looks the same as it does from [api](/packages/api) or [http](/packages/http). |
| Cache effects on mutations. | A mutation declares which [query](/packages/query) keys it changes, and every screen showing them updates. |
| A generated registry. | `kitr types` writes the names and types of every action, so `useQuery('projects.list')` is typed and renaming a file is a type error, not a runtime one. |

## Problems it solves

- **Writing an endpoint for every button.** One `defineMutation` replaces a route, a controller and a client method. See [Your first mutation](/packages/actions/guide#your-first-mutation).
- **Reading data without a REST layer.** `defineQuery` gives a component typed server data, cached and refreshed by [query](/packages/query). See [Read data with a query](/packages/actions/guide#read-data-with-a-query).
- **Data that arrives after the page.** Route loaders call the same actions, so the page renders with its data. See [Load before the page renders](/packages/actions/guide#load-before-the-page-renders).
- **Untrusted input reaching server code.** Every action validates its input before the handler runs, and the error reaches the form field that caused it. See [Throw an error the caller understands](/packages/actions/guide#throw-an-error-the-caller-understands).
- **Server code anyone can call.** Middleware runs before the handler, so `requireAuth` or a permission check protects the action the same way it protects a route. See [Protect an action with middleware](/packages/actions/guide#protect-an-action-with-middleware).
- **Actions scattered across the codebase.** The guide shows one folder per feature, and the registry keeps names unique. See [Organize actions by feature](/packages/actions/guide#organize-actions-by-feature).

## Further reading

- [Guide](/packages/actions/guide): install, configure, the first mutation and every task.
- [API reference](/packages/actions/api): every export with its signature.
- [TanStack Start server functions](https://tanstack.com/start/latest/docs/framework/react/server-functions): the transport, middleware and `useServerFn`.
- [Query](/packages/query): the hooks, cache effects and `call` that actions plug into.
- [API routes](/packages/api): the same handlers behind URLs, for callers outside your app.
- [Forms](/packages/forms): field errors from a mutation.
