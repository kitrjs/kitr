---
title: Actions
description: Call server code straight from a component, like a form submit, without writing an API route.
order: 1
---

# Actions

A button often just needs to run a bit of server code, like renaming a project. An action is a function you define once with `defineQuery` or `defineMutation`. The browser calls it like a local function; kitr sends the request, checks the input and returns the result or a typed error.

> [!SUMMARY]
> Call server code straight from a component, like a form submit, without writing an API route. Add it with `kitr add actions`; the overview is at [/packages/actions](/packages/actions).

Actions are [TanStack Start server functions](https://tanstack.com/start/latest/docs/framework/react/server-functions) plus:

- Input validation with any Standard Schema.
- One error shape, so a validation failure lands on the right form field.
- Cache effects after a mutation.
- A generated registry, so `useQuery('projects.list')` is fully typed.

Use actions when the only caller is your own React app. When a mobile app, partner or webhook calls the code too, use [API routes](/packages/api): they give you URLs, OpenAPI and a typed client.

## Install

```sh
kitr add actions
```

<details>
<summary>Everything kitr add changes</summary>

What `kitr add` does:

- Adds [server](/packages/server) and [query](/packages/query) first when missing; actions require both.
- Installs `@kitr/actions` and adds it to `packages` in `kitrrc.ts`. Actions register no provider.
- Adds `#kitr/*` to `paths` and `.kitr/**/*` to `include` in `tsconfig.json`, and `.kitr` to `.gitignore`. Projects from `kitr new` already have both.
- Points the `typecheck` script at `kitr typecheck`, which generates the names and then runs `tsc`, and adds `#kitr/*` to the `imports` field of `package.json` when it has one.
- Creates an empty `app/actions/` folder (or `directories.actions` from `kitrrc.ts`).
- Edits `app/app.ts`: `import { operations } from '#kitr/actions'` and `createApp({ operations, ... })`.
- Runs `kitr types` once dependencies are installed, which writes `.kitr/actions.ts`.
- Appends an `actions` section to `AGENTS.md`.

`kitr add actions` asks no questions. `kitr remove actions` takes `operations` out of `app/app.ts` and removes the `AGENTS.md` section, the `packages` entry and the dependency. It leaves the `tsconfig.json`, `.gitignore`, `imports` and `typecheck` changes, which other type generators use, and your files in `app/actions/`. The `fullstack` and `saas` kits include actions.

</details>

## Configure

This package has no config file. Everything is declared on each definition:

```ts
// app/actions/projects/update.ts
import { defineMutation } from '@kitr/actions'
import { z } from 'zod'

export const updateProject = defineMutation('projects.update', {
  input: z.object({ id: z.string(), name: z.string().min(2) }),
  middleware: [],
  effects: (project) => ({ invalidate: [['projects']] }),
  handler: async ({ input }) => ({ id: input.id, name: input.name }),
})
```

| Option | Default | Description |
| --- | --- | --- |
| `input` | none | A [Standard Schema](https://standardschema.dev) such as zod, checked on the server. A failure is a `VALIDATION` error with `fieldErrors`. |
| `handler` | required | Runs on the server only. Receives `{ input, context, signal }`. Its code and imports never reach the browser bundle. |
| `middleware` | `[]` | TanStack Start function middleware, run before the handler. Whatever it puts in `context` is typed on the handler. |
| `staleTime` | the query client's | Queries only: how long a result counts as fresh, in milliseconds, carried into the query options. |
| `effects` | none | Mutations only: cache effects applied on the client after success. An object, or a function of `(result, input)`. |

The names you pass, `projects.update` above, go into one generated file:

| File | Written by | Holds |
| --- | --- | --- |
| `.kitr/actions.ts` | `kitr types` | `operations`, a flat map by name; `actions`, the same as a tree; and the `Operations` augmentation that types every name. |
| `.kitr/platforms.d.ts` | `kitr types` | The platform names from `kitrrc.ts`, so `app.platform` is `'site' \| 'api'`. |

`kitr dev` and `kitr build` run `kitr types` first, and the Vite plugin reruns it when a file under `app/actions/` changes. The file is generated and ignored by git. Set `directories.actions` in `kitrrc.ts` to keep actions elsewhere.

## Your first mutation

Generate a file:

```sh
kitr make:mutation projects/rename
```

Then give it a schema and a handler:

```ts
// app/actions/projects/rename.ts
import { defineMutation } from '@kitr/actions'
import { useDb } from '@kitr/db'
import { useRequestApp } from '@kitr/server'
import { z } from 'zod'
import type { AppDb } from '#config/db'

export const renameProject = defineMutation('projects.rename', {
  input: z.object({ id: z.string(), name: z.string().min(2) }),
  effects: (project) => ({
    set: [{ key: ['projects', 'detail', project.id], data: project }],
    invalidate: [['projects', 'list']],
  }),
  handler: async ({ input }) => {
    const db = useDb<AppDb>(useRequestApp())
    return db.projects.update(input.id, { name: input.name })
  },
})
```

Use it in a component by name:

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

Clicking the button sends one request that validates the input, runs the handler and returns the project. The `set` effect writes it into the detail cache and `invalidate` refetches every project list. `rename.mutate({ id })` and `useMutation('projects.rnaem')` are type errors.

`useRequestApp()` returns the app for the current request. Don't import `app` from `#app/app` in an action file: `app/app.ts` imports the registry that imports every action, and a file that imports `app` back makes the cycle that leaves the registry reading an action before it exists.

## Read data with a query

A query is an action that only reads. It is sent as a GET and cached like any other query:

```ts
// app/actions/projects/list.ts
import { defineQuery } from '@kitr/actions'
import { useDb } from '@kitr/db'
import { useRequestApp } from '@kitr/server'
import { z } from 'zod'
import type { AppDb } from '#config/db'

export const listProjects = defineQuery('projects.list', {
  input: z.object({ status: z.enum(['open', 'archived']).optional() }),
  staleTime: 30_000,
  handler: ({ input }) =>
    useDb<AppDb>(useRequestApp()).projects.findMany({ where: { status: input.status } }),
})
```

In a component:

```tsx
// app/components/project-list.tsx
import { useSuspenseQuery } from '@kitr/query'

export function ProjectList() {
  const { data: projects } = useSuspenseQuery('projects.list', { status: 'open' })
  return <ul>{projects.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
}
```

`useQuery`, `useSuspenseQuery` and `queryOptions` take a name first and the input second; leave the input out when every field is optional. The query key is `['action', 'projects.list', input]`, so `['action', 'projects.list']` invalidates every variant.

## Load before the page renders

In a route loader, `queryOptions` hands the router the options the component uses, so the server fetches once and the browser reuses the result:

```ts
// app/routes.ts
import { queryOptions } from '@kitr/query'

r.page('/projects/', {
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      queryOptions(context.app, 'projects.list', { status: 'open' }),
    ),
  lazy: () => import('./pages/projects/index'),
})
```

```ts
// app/pages/projects/index.tsx
import { ProjectList } from '#components/project-list'

export default ProjectList
```

## Call an action outside a component

Every definition is a function. Import it and call it from a loader, a store, an event handler or a job:

```ts
import { renameProject } from '#app/actions/projects/rename'

const project = await renameProject({ id: 'prj_42', name: 'Acme site' })
// => { id: 'prj_42', name: 'Acme site', status: 'open' }
```

In the browser this is one request; on the server the handler runs in-process. A direct call applies no cache effects; use `useMutation` in components for that.

When all you have is the name, `call` from `@kitr/query` looks it up in `app.operations`:

```ts
import { call } from '@kitr/query'

await call(app, 'projects.rename', { id: 'prj_42', name: 'Acme site' })
const open = await call(app, 'projects.list', { status: 'open' })
```

The generated tree groups the same functions by feature:

```ts
import { actions } from '#kitr/actions'

await actions.projects.rename({ id: 'prj_42', name: 'Acme site' })
```

## Use the definition instead of the name

When you prefer an import to a string, every hook takes the definition too, with the same types:

```tsx
import { useMutation, useSuspenseQuery } from '@kitr/query'
import { listProjects } from '#app/actions/projects/list'
import { renameProject } from '#app/actions/projects/rename'

const { data } = useSuspenseQuery(listProjects, { status: 'open' })
const rename = useMutation(renameProject)
```

Plain TanStack options also work: `useQuery({ queryKey, queryFn })` passes straight through.

## Pass your own query and mutation options

The third argument of a query hook, and the second of `useMutation`, are TanStack overrides. Everything but `queryKey`, `queryFn` and `mutationFn` can be replaced:

```tsx
const { data } = useQuery('projects.list', { status: 'open' }, { refetchInterval: 10_000 })
const rename = useMutation('projects.rename', {
  onSuccess: (project) => toast(`Renamed to ${project.name}`),
})
```

The mutation's cache effects run first, then your `onSuccess`.

## Protect an action with middleware

Middleware runs before the handler and can add to `context`. A session middleware puts the session there; `requireSession` then rejects anonymous callers with `UNAUTHORIZED`:

```ts
// app/actions/middleware/session.ts
import { getRequest } from '@tanstack/react-start/server'
import { createMiddleware } from '@kitr/actions'
import { sessionFromRequest } from '#server/session'

export const sessionMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  // Your own lookup: a cookie, a bearer token, an auth adapter. It returns { user } or null.
  const session = await sessionFromRequest(getRequest())
  return next({ context: { session } })
})
```

```ts
// app/actions/projects/archive.ts
import { defineMutation, requireSession } from '@kitr/actions'
import { z } from 'zod'
import { sessionMiddleware } from '#app/actions/middleware/session'

export const archiveProject = defineMutation('projects.archive', {
  middleware: [sessionMiddleware, requireSession],
  input: z.object({ id: z.string() }),
  handler: async ({ input, context }) => {
    // context.session.user is typed here
    return { id: input.id, archivedBy: context.session.user.id }
  },
})
```

The handler's `context` type is built from the middleware list. An error thrown in middleware reaches the caller as a `KitrError`, like a handler's. `redirect()` and `notFound()` pass through to the router.

Any middleware can wrap the call:

```ts
// app/actions/middleware/timing.ts
import { createMiddleware } from '@kitr/actions'

export const timing = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const started = Date.now()
  const result = await next()
  console.log(`took ${Date.now() - started}ms`)
  return result
})
```

## Throw an error the caller understands

Throw a `KitrError` and the caller receives the same code, status, message and field errors:

```ts
import { KitrError } from '@kitr/kitr/app'

handler: async ({ input }) => {
  const project = await db.projects.find(input.id)
  if (!project) throw KitrError.notFound('Project not found')
  if (project.ownerId !== input.userId) throw KitrError.forbidden()
  if (await db.projects.exists({ name: input.name }))
    throw KitrError.validation({ name: ['A project with this name exists'] })
  return project
}
```

On the client:

```ts
try {
  await renameProject({ id: 'prj_42', name: 'Acme site' })
} catch (error) {
  if (error instanceof KitrError && error.code === 'VALIDATION') error.fieldErrors
  // => { name: ['A project with this name exists'] }
}
```

With [forms](/packages/forms), pass `rename.mutateAsync` to `<Form onSubmit>` and each message appears under its field.

> [!WARNING]
> Anything that is not a `KitrError` becomes a 500. The real error is logged on the server; production browsers see only `Internal server error`.

## Organize actions by feature

One file per action under `app/actions/<feature>/`. The dotted name only needs to be unique; `kitr types` groups the tree by the part before the first dot:

```
app/actions/
├── projects/
│   ├── list.ts      projects.list
│   ├── rename.ts    projects.rename
│   └── archive.ts   projects.archive
└── invoices/
    └── send.ts      invoices.send
```

> [!WARNING]
> Only `export const <id> = defineQuery('...')` and `defineMutation('...')` with a literal name are picked up. `kitr types` fails when a name is used twice, is not a dotted identifier, or is both an operation and a group (`projects` and `projects.list`).

Any file under `app/actions/` counts at any depth, except tests and `.d.ts` files.

## Commands

| Command | What it does |
| --- | --- |
| `kitr make:query <feature>/<name>` | Writes `app/actions/<feature>/<name>.ts` with `defineQuery('<feature>.<name>', ...)`. |
| `kitr make:mutation <feature>/<name>` | Writes `app/actions/<feature>/<name>.ts` with `defineMutation('<feature>.<name>', ...)`. |
| `kitr types` | Runs every type generator and writes `.kitr/`. `--check` fails when a file is stale; `--watch` keeps running; `--only actions` runs one generator. |

```sh
kitr make:query invoices/list
# → write app/actions/invoices/list.ts
kitr types
# → write .kitr/actions.ts
```

`kitr doctor` warns when `.kitr/` is stale.

## Errors

| Code | When | What to do |
| --- | --- | --- |
| `VALIDATION` | The input failed the `input` schema, or the handler threw `KitrError.validation()`. | Read `fieldErrors`; forms show them under the field. |
| `UNAUTHORIZED` | `requireSession` found no `context.session.user`. | Sign the user in, or drop the middleware for public actions. |
| `NOT_FOUND`, `FORBIDDEN` | The handler threw them. | Show the message; the status is 404 or 403. |
| `INTERNAL` | The handler threw anything else. | Check the server log; the browser never sees the details in production. |
| `Nothing is registered` | A name was used before `createApp({ operations })` ran, or `operations` is not passed. | Import `operations` from `#kitr/actions` in `app/app.ts` and pass it to `createApp`. |
| `"x" is a mutation; use useMutation` | A mutation name was given to `useQuery` or `queryOptions`, or the reverse. | Use the hook that matches the kind. |

## Testing

`.run(input, { context })` validates the input and runs the handler in-process, skipping middleware and HTTP:

```ts
// test/actions/rename.test.ts
import { KitrError } from '@kitr/kitr/app'
import { describe, expect, it } from 'vitest'
import { renameProject } from '#app/actions/projects/rename'

describe('projects.rename', () => {
  it('renames and returns the project', async () => {
    const project = await renameProject.run({ id: 'prj_42', name: 'Acme site' })
    expect(project).toMatchObject({ id: 'prj_42', name: 'Acme site' })
  })

  it('rejects a short name with field errors', async () => {
    await expect(renameProject.run({ id: 'prj_42', name: 'A' })).rejects.toMatchObject({
      code: 'VALIDATION',
      fieldErrors: { name: [expect.any(String)] },
    })
  })

  it('sees the middleware context it is given', async () => {
    const result = await archiveProject.run(
      { id: 'prj_42' },
      { context: { session: { user: { id: 'usr_ada' } } } },
    )
    expect(result.archivedBy).toBe('usr_ada')
  })
})
```

To test a component that uses a name, register the definitions on the test app with [testing](/packages/testing):

```tsx
// test/components/rename-button.test.tsx
import { renderWithKitr } from '@kitr/testing/react'
import { createTestApp } from '@kitr/testing'
import { operations } from '#kitr/actions'
import { RenameButton } from '#components/rename-button'

const app = await createTestApp({ operations })
renderWithKitr(<RenameButton id="prj_42" />, { app })
```


## Next steps

- [API reference](/packages/actions/api): every export of `@kitr/actions`.
- [Query](/packages/query): the hooks, cache effects and `call`.
- [Choosing a data source](/docs/data-sources): actions, API routes, HTTP or realtime.
