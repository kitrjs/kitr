---
title: Actions
description: Call server code straight from a component, like a form submit, without writing an API route.
order: 1
---

# Actions

Rename a project, archive an invoice, invite Grace to a team: a button often needs to run a bit of server code and nothing more. An API route, a client for it and types on both sides is a lot of ceremony for that. An action is a function you define once with `defineQuery` or `defineMutation`; the browser calls it as if it were local, and kitr sends the request, validates the input on the server and brings back the result or a typed error.

Actions are [TanStack Start server functions](https://tanstack.com/start/latest/docs/framework/react/server-functions) with four things added: input validation with any Standard Schema, kitr's one error shape so a validation failure lands on the right form field, cache effects after a mutation, and a generated registry that lets a component say `useQuery('projects.list')` with full types.

Actions run on both sides: the handler on the server, the call anywhere. Use them when the only caller is your own React app. When something else calls the same code too, such as a mobile app, a partner or a webhook, use [API routes](/packages/api) instead; they give you URLs, OpenAPI and a typed client.

## Install

```sh
kitr add actions
```

What `kitr add` does:

- Adds [server](/packages/server) and [query](/packages/query) first when the project does not have them, because actions require both.
- Installs `@kitr/actions` and adds it to `packages` in `kitrrc.ts`. Actions register no provider.
- Adds `#kitr/*` to `paths` and `.kitr/**/*` to `include` in `tsconfig.json`, and `.kitr` to `.gitignore`. Projects from `kitr new` already have both.
- Prefixes the `typecheck` script with `kitr types &&`, so `tsc` always sees current names, and adds `#kitr/*` to the `imports` field of `package.json` when it has one.
- Creates an empty `app/actions/` folder (or `directories.actions` from `kitrrc.ts`).
- Edits `app/app.ts`: `import { operations } from '#kitr/actions'` and `createApp({ operations, ... })`.
- Runs `kitr types` once dependencies are installed, which writes `.kitr/actions.ts`.
- Appends an `actions` section to `AGENTS.md`.

`kitr add actions` asks no questions. `kitr remove actions` takes `operations` out of `app/app.ts` and removes the `AGENTS.md` section, the `packages` entry and the dependency. It leaves the `tsconfig.json`, `.gitignore`, `imports` and `typecheck` changes, which other type generators use too, and your files in `app/actions/`. The `fullstack` and `saas` kits include actions.

## Configure

This package has no config file. Everything is declared on each definition, so a reader of one file sees everything that affects it:

```ts
// app/actions/projects/update.ts
import { defineMutation } from 'kitr/actions'
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
| `input` | none | Any [Standard Schema](https://standardschema.dev) (zod, valibot, arktype). Validated on the server; a failure reaches the caller as a `VALIDATION` error with `fieldErrors`. Without it the input is `void`. |
| `handler` | required | Runs on the server only. Receives `{ input, context, signal }`. Its code and imports never reach the browser bundle. |
| `middleware` | `[]` | TanStack Start function middleware, run before the handler. Whatever it puts in `context` is typed on the handler. |
| `staleTime` | the query client's | Queries only: how long a result counts as fresh, in milliseconds, carried into the query options. |
| `effects` | none | Mutations only: cache effects applied on the client after success. An object, or a function of `(result, input)`. |

The names you pass, `projects.update` above, go into one generated file:

| File | Written by | Holds |
| --- | --- | --- |
| `.kitr/actions.ts` | `kitr types` | `operations`, a flat map by name; `actions`, the same as a tree; and the `Operations` augmentation that types every name. |
| `.kitr/platforms.d.ts` | `kitr types` | The platform names from `kitrrc.ts`, so `app.platform` is `'site' \| 'api'`. |

`kitr dev` and `kitr build` run `kitr types` first, and the Vite plugin reruns it whenever a file under `app/actions/` changes, so the file is current while you work. It is generated and ignored by git. Set `directories.actions` in `kitrrc.ts` to keep actions somewhere else.

## Your first mutation

Generate a file:

```sh
kitr make:mutation projects/rename
```

Then give it a schema and a handler:

```ts
// app/actions/projects/rename.ts
import { defineMutation } from 'kitr/actions'
import { useDb } from 'kitr/db'
import { useRequestApp } from 'kitr/server'
import { z } from 'zod'
import { app } from '#app/app'
import type { AppDb } from '#config/db'

export const renameProject = defineMutation('projects.rename', {
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

Use it in a component by name:

```tsx
// app/components/rename-button.tsx
import { useMutation } from 'kitr/query'

export function RenameButton({ id }: { id: string }) {
  const rename = useMutation('projects.rename')
  return (
    <button disabled={rename.isPending} onClick={() => rename.mutate({ id, name: 'Acme site' })}>
      Rename
    </button>
  )
}
```

Clicking the button sends one request to the server, which validates the input, runs the handler and returns the project. The `set` effect writes it into the detail cache and `invalidate` refetches every project list. `rename.mutate({ id })` is a type error, because `name` is required, and `useMutation('projects.rnaem')` is one too, because the name is not in the registry.

`useRequestApp(app)` returns the app for the current request, or `app` itself when there is none.

## Read data with a query

A query is an action that only reads. It is sent as a GET and cached like any other query:

```ts
// app/actions/projects/list.ts
import { defineQuery } from 'kitr/actions'
import { useDb } from 'kitr/db'
import { useRequestApp } from 'kitr/server'
import { z } from 'zod'
import { app } from '#app/app'
import type { AppDb } from '#config/db'

export const listProjects = defineQuery('projects.list', {
  input: z.object({ status: z.enum(['open', 'archived']).optional() }),
  staleTime: 30_000,
  handler: ({ input }) =>
    useDb<AppDb>(useRequestApp(app)).projects.findMany({ where: { status: input.status } }),
})
```

In a component:

```tsx
// app/components/project-list.tsx
import { useSuspenseQuery } from 'kitr/query'

export function ProjectList() {
  const { data: projects } = useSuspenseQuery('projects.list', { status: 'open' })
  return <ul>{projects.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
}
```

`useQuery`, `useSuspenseQuery` and `queryOptions` from `kitr/query` all take a name as the first argument and the input as the second. When every field of the input is optional, the input can be left out: `useQuery('projects.list')`. The query key is `['action', 'projects.list', input]`, so `['action', 'projects.list']` invalidates every variant.

## Load before the page renders

In a route loader, `queryOptions` by name hands TanStack Router the same options the component uses, so the server fetches once and the browser reuses the result:

```ts
// app/routes.ts
import { queryOptions } from 'kitr/query'

r.page('/projects/', {
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(queryOptions('projects.list', { status: 'open' })),
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

In the browser this is one request. On the server, during rendering or inside another handler, Start runs the handler in-process; there is no HTTP hop. A direct call applies no cache effects, because there is no cache in play; use `useMutation` in components for that.

When all you have is the name, `call` from `kitr/query` looks it up in the registry:

```ts
import { call } from 'kitr/query'

await call('projects.rename', { id: 'prj_42', name: 'Acme site' })
const open = await call('projects.list', { status: 'open' })
```

The generated tree gives the same functions grouped by feature, which reads well in scripts:

```ts
import { actions } from '#kitr/actions'

await actions.projects.rename({ id: 'prj_42', name: 'Acme site' })
```

## Use the definition instead of the name

A name resolves through the registry that `createApp({ operations })` fills. When you prefer an import to a string, every hook takes the definition too, with the same types:

```tsx
import { useMutation, useSuspenseQuery } from 'kitr/query'
import { listProjects } from '#app/actions/projects/list'
import { renameProject } from '#app/actions/projects/rename'

const { data } = useSuspenseQuery(listProjects, { status: 'open' })
const rename = useMutation(renameProject)
```

Both forms end in the same TanStack options. Plain TanStack options still work as before: `useQuery({ queryKey, queryFn })` passes straight through.

## Pass your own query and mutation options

The third argument of a query hook, and the second of `useMutation`, are TanStack overrides. The definition's own `queryKey`, `queryFn` and `mutationFn` cannot be replaced; everything else can:

```tsx
const { data } = useQuery('projects.list', { status: 'open' }, { refetchInterval: 10_000 })
const rename = useMutation('projects.rename', {
  onSuccess: (project) => toast(`Renamed to ${project.name}`),
})
```

The mutation's cache effects run first, then your `onSuccess`.

## Protect an action with middleware

Start middleware runs before the handler and can add to `context`. A session middleware reads the request once and puts the session on the context; `requireSession` then rejects anonymous callers with `UNAUTHORIZED`. It expects `context.session` from an earlier middleware:

```ts
// app/actions/middleware/session.ts
import { getRequest } from '@tanstack/react-start/server'
import { createMiddleware } from 'kitr/actions'
import { sessionFromRequest } from '#server/session'

export const sessionMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  // Your own lookup: a cookie, a bearer token, an auth adapter. It returns { user } or null.
  const session = await sessionFromRequest(getRequest())
  return next({ context: { session } })
})
```

```ts
// app/actions/projects/archive.ts
import { defineMutation, requireSession } from 'kitr/actions'
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

The handler's `context` type is built from the middleware list: each middleware adds what it passes to `next({ context })`. An error thrown in middleware, like `requireSession`'s `UNAUTHORIZED`, reaches the caller as a `KitrError` exactly as a handler's would, and a server error's message is masked in production the same way. `redirect()` and `notFound()` pass through to the router.

`createMiddleware` is re-exported from `kitr/actions` so every middleware uses the same import. Any middleware can wrap the call:

```ts
// app/actions/middleware/timing.ts
import { createMiddleware } from 'kitr/actions'

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
import { KitrError } from 'kitr/app'

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

With [forms](/packages/forms), pass `rename.mutateAsync` to `<Form onSubmit>` and each message appears under its field. Anything that is not a `KitrError` becomes a 500: the real error is logged on the server, and in production the browser sees only `Internal server error`.

## Organise actions by feature

The generator writes one file per action under `app/actions/<feature>/`. The dotted name is yours; the registry only needs it to be unique, and `kitr types` groups the tree by the part before the first dot:

```
app/actions/
├── projects/
│   ├── list.ts      projects.list
│   ├── rename.ts    projects.rename
│   └── archive.ts   projects.archive
└── invoices/
    └── send.ts      invoices.send
```

Any file under `app/actions/` counts, at any depth, except tests and `.d.ts` files. Only `export const <id> = defineQuery('...')` and `export const <id> = defineMutation('...')` with a literal name are picked up; a name built at run time cannot be typed. `kitr types` fails when a name is used twice, is not a dotted identifier, or is both an operation and a group (`projects` and `projects.list`).

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

`.run(input, { context })` validates the input and runs the handler in-process, skipping Start middleware and HTTP, so a test needs neither a server nor a browser:

```ts
// test/actions/rename.test.ts
import { KitrError } from 'kitr/app'
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

To test a component that uses a name, register the definitions on the test app and render with [testing](/packages/testing):

```tsx
// test/components/rename-button.test.tsx
import { renderWithKitr } from 'kitr/testing/react'
import { createTestApp } from 'kitr/testing'
import { operations } from '#kitr/actions'
import { RenameButton } from '#components/rename-button'

const app = await createTestApp({ operations })
renderWithKitr(<RenameButton id="prj_42" />, { app })
```

The server function itself is a TanStack Start function, so it also works with Start's own test helpers.

## Next steps

- [API reference](/packages/actions/api)
- [TanStack Start server functions](https://tanstack.com/start/latest/docs/framework/react/server-functions), including middleware and `useServerFn`.
- [Query](/packages/query): the hooks, the cache effects and `call`.
- [Forms](/packages/forms): field errors from a mutation.
- [API routes](/packages/api) for the same handlers behind URLs.
- [Type generation](/docs/cli#type-generation): the `kitr types` runner and how a package adds a generator.
