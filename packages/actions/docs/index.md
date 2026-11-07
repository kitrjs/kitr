---
title: Actions
description: Call server code straight from a component, like a form submit, without writing an API route.
order: 1
---

# Actions

Sometimes a button just needs to run a bit of server code: save a form, rename a project, send an invite. Writing an API route, a client for it and the types on both sides is a lot of ceremony for that. An action is a function you define once and call from the browser as if it were local. kitr sends the request, checks the input on the server and brings back either the result or a typed error.

Actions are [TanStack Start server functions](https://tanstack.com/start/latest/docs/framework/react/server-functions) with three things added: input validation, kitr's one error shape (so a validation error lands on the right form field), and cache updates after success.

## Install

```sh
kitr add actions
```

This needs the [server](/packages/server) package, which `kitr add` adds if it's missing. It creates an empty `app/actions/` folder.

## Define one

```ts
// app/actions/projects/update.ts
import { z } from 'zod'
import { defineAction } from 'kitr/actions'
import { useDb } from 'kitr/db'
import { useRequestApp } from 'kitr/server'
import { app } from '#app/app'
import type { AppDb } from '#config/db'

export const updateProject = defineAction('projects.update', {
  input: z.object({ id: z.string(), name: z.string().min(2) }),
  effects: (project) => ({
    set: [{ key: ['projects', 'detail', project.id], data: project }],
    invalidate: [['projects', 'list']],
  }),
  handler: async ({ input }) => {
    const db = useDb<AppDb>(useRequestApp(app))
    return db.projects.update(input.id, { name: input.name })
  },
})
```

`kitr make:action projects/update` writes this file for you. `useRequestApp(app)` returns the app for the current request, or `app` itself when there is none.

The handler only ever runs on the server. Its code, and anything it imports, never reaches the browser bundle.

## Call it

Call it directly, anywhere:

```ts
const project = await updateProject({ id: '42', name: 'Renamed' })
```

In a component, wrap it as a mutation so you get pending state, errors and the cache effects:

```tsx
import { defineMutation, useKitrMutation } from 'kitr/query'
import { updateProject } from '#app/actions/projects/update'

const update = defineMutation(updateProject.mutation())

function RenameButton({ id }: { id: string }) {
  const rename = useKitrMutation(update)
  return (
    <button disabled={rename.isPending} onClick={() => rename.mutate({ id, name: 'Renamed' })}>
      Rename
    </button>
  )
}
```

With [forms](/packages/forms), pass `rename.mutateAsync` to `<Form onSubmit>`. If the server rejects the input, each message appears under its field.

## Reading data

Actions that only read data use `method: 'GET'`. They can then be cached and prefetched like any query:

```ts
export const listProjects = defineAction('projects.list', {
  method: 'GET',
  handler: () => useDb<AppDb>(useRequestApp(app)).projects.findMany(),
})

const projects = defineQuery(listProjects.query())
```

## Errors

Throw a `KitrError` (`KitrError.notFound()`, `KitrError.forbidden()`, `KitrError.validation({ name: ['Taken'] })`) and the caller receives the same error, with the same code, status and field errors. Anything else becomes a 500, and the real error is logged on the server, not sent to the browser.

## Middleware

Start middleware runs before the handler. `requireSession` rejects callers who aren't signed in:

```ts
import { defineAction, requireSession } from 'kitr/actions'

export const deleteProject = defineAction('projects.delete', {
  middleware: [sessionMiddleware, requireSession],
  input: z.object({ id: z.string() }),
  handler: ({ input, context }) => {
    // context.session is set here
  },
})
```

`createMiddleware` and `createServerFn` are re-exported from `kitr/actions`, so your own middleware uses the same import.

## Actions or an API?

Use actions when the only caller is your own UI. Use the [API](/packages/api) package when other clients (a mobile app, a partner, a CLI) call the same endpoints, or when you want stable URLs. Both use the same errors and the same cache effects, so moving from one to the other is a small change.
