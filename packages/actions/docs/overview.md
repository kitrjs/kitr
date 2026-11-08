---
title: Overview
description: Call server code straight from a component, like a form submit, without writing an API route.
order: 0
---

# Server actions

## What it is

An action is a server function you define with `defineQuery` or `defineMutation` and call from any component by name. kitr sends the request, validates the input with your schema and returns the result or a typed error.

Use actions when only your own app calls the code. For mobile apps, partners or webhooks, use [API routes](/packages/api).

## Install

```sh
kitr add actions
```

Adds `@kitr/actions` and `app/actions/`, and runs `kitr types` once. Adds [server](/packages/server) and [query](/packages/query) first if missing. [Every change](/packages/actions/guide#install).

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

One click sends one request. The server validates, runs the handler and returns the project; the cache effects update every screen that shows it. A missing `name` is a type error. Next in the guide: [Your first mutation](/packages/actions/guide#your-first-mutation).

## Built on

kitr adds four things on top:

| What kitr adds | Why |
| --- | --- |
| Input validation with any [Standard Schema](https://standardschema.dev) library (zod, valibot, arktype). | The server never trusts the browser, and the schema is also the TypeScript type. |
| kitr's one error shape, `KitrError`. | A validation failure lands on the right form field in [forms](/packages/forms), and every other failure looks the same as it does from [api](/packages/api) or [http](/packages/http). |
| Cache effects on mutations. | A mutation declares which [query](/packages/query) keys it changes, and every screen showing them updates. |
| A generated registry. | `useQuery('projects.list')` is typed from the action's name. |

kitr adds the input schema, the typed error, the generated registry and the cache effects.

## Problems it solves

- **Writing an endpoint for every button.** [Your first mutation](/packages/actions/guide#your-first-mutation).
- **Reading data without a REST layer.** [query](/packages/query).
- **Data that arrives after the page.** [Load before the page renders](/packages/actions/guide#load-before-the-page-renders).
- **Untrusted input reaching server code.** [Throw an error the caller understands](/packages/actions/guide#throw-an-error-the-caller-understands).
- **Server code anyone can call.** [Protect an action with middleware](/packages/actions/guide#protect-an-action-with-middleware).
- **Actions scattered across the codebase.** [Organize actions by feature](/packages/actions/guide#organize-actions-by-feature).

## Further reading

- [Guide](/packages/actions/guide).
- [API reference](/packages/actions/api).
- [TanStack Start server functions](https://tanstack.com/start/latest/docs/framework/react/server-functions).
- [Query](/packages/query).
- [API routes](/packages/api).
- [Forms](/packages/forms).
