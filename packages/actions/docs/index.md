---
title: Actions
description: Call server code straight from a component, like a form submit, without writing an API route.
order: 1
---

# Actions

A server action is a function that runs on the server and is called from a component as if it were local. `defineAction` wraps a TanStack Start server function with kitr's input validation, one error shape (validation errors land on form fields) and cache effects, so a form submit updates the right queries without extra code.

## Install

```sh
kitr add actions
```

Needs the web platform in `ssr` mode (TanStack Start). `kitr make:action projects/create` writes a starter file.

## Define one

```ts
// app/actions/projects/update.ts
import { defineAction } from 'kitr/actions'
import { z } from 'zod'

export const updateProject = defineAction('projects.update', {
  input: z.object({ id: z.string(), name: z.string().min(2) }),
  effects: (project, input) => ({
    set: [{ key: ['projects', 'detail', input.id], data: project }],
    invalidate: [['projects', 'list']],
  }),
  handler: async ({ input, context }) => db.projects.update(input),
})
```

`input` is any Standard Schema; invalid input never reaches `handler` and comes back as `KitrError.validation(fieldErrors)`. `method: 'GET'` makes an action cacheable and prefetchable like a query. `middleware` takes Start middleware (`requireSession` is exported for the common case) and its context lands on `ctx.context`.

## Call it

```tsx
import { useMutation } from 'kitr/query'
import { Form } from 'kitr/forms'

function Rename({ id }: { id: string }) {
  const rename = useMutation(updateProject.mutation())
  return <Form onSubmit={(values) => rename.mutateAsync({ id, ...values })}>…</Form>
}
```

`action.mutation()` and `action.query()` are query contracts, so they plug into `useMutation`, `useSuspenseQuery` and loaders; `action(input)` calls it directly. Effects run on the client after success, so lists refresh without manual invalidation.

## Errors

Every failure crosses the wire as the same `KitrError` shape: `code`, `status`, `message`, `fieldErrors`. `<Form>` from `kitr/forms` maps `fieldErrors` onto fields; anything else surfaces through the route's error component.
