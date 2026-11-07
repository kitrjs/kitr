---
title: Build a full-stack app
description: One codebase with server-rendered pages, a database, server actions, a public API and live updates.
packages: web, server, db, actions, api, query, forms, realtime, seo, testing
platforms: web, server
time: 60 min
---

# Build a full-stack app

When you own the backend too, keep it in the same project. One repository, one `kitr dev`, one set of types from the database to the button: rename a column and the compiler shows you every screen that read it. This guide builds Acme's project tracker that way, from `kitr new` to a page that updates live when a teammate saves.

You will build `acme-projects`: a server-rendered list of a team's projects, read from Postgres through a server action, a form that creates projects and shows validation errors under the fields, a JSON API for the mobile app and partners, and live updates so Grace sees Ada's new project without reloading.

## Before you start

You need [Node.js](https://nodejs.org) 22 or newer, the kitr CLI (`npm install -g kitr`) and a Postgres database. If you have Docker, this starts one:

```sh
docker run -d --name acme-db -e POSTGRES_PASSWORD=acme -e POSTGRES_DB=acme -p 5432:5432 postgres:17
```

The guide uses [zod](https://zod.dev) for schemas and [Drizzle](https://orm.drizzle.team) for the database. Both are choices, not requirements: kitr validates with any [Standard Schema](https://standardschema.dev) library and connects any ORM.

## Create the project

```sh
kitr new acme-projects --kit fullstack
cd acme-projects
```

The `fullstack` kit adds two [platforms](/docs/platforms) to `kitrrc.ts`:

```ts
// kitrrc.ts
import { defineKitrConfig } from 'kitr/app'
import { server } from 'kitr/server'
import { web } from 'kitr/web'

export default defineKitrConfig({
  // ...packages and providers
  platforms: {
    site: web({ mode: 'ssr' }),
    api: server(),
  },
})
```

`site` renders pages on the server through [TanStack Start](https://tanstack.com/start) and hydrates them in the browser. `api` is the h3 server in `server/main.ts`. The kit also wrote `app/routes/api.$.ts`, which hands every `/api/*` request the site receives to that same server, so in production one process serves pages and the API. Run both in development:

```sh
cp .env.example .env
npm run dev
```

The site answers on `http://localhost:3000` and the API on `http://localhost:3001`. `kitr dev site` runs the pages alone.

Where the code goes:

| Folder | What lives there | Runs on |
| --- | --- | --- |
| `app/routes/` | Pages | Server, then browser |
| `app/actions/` | Server actions: functions the browser calls | Server |
| `app/channels/` | Realtime channel definitions | Both |
| `app/features/` | Queries, forms and components by feature | Browser |
| `server/` | `main.ts`, `routes.ts`, controllers, the database schema | Server |
| `config/` | One file per package | Where the package runs |

## Connect the database

```sh
kitr add db
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit
```

`kitr add db` registers the [DB](/packages/db) provider, writes `config/db.ts` and adds `DATABASE_URL` to `.env.example`. Describe the table:

```ts
// server/db/schema.ts
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  teamId: text('team_id').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type Project = typeof projects.$inferSelect
```

Connect it in `config/db.ts`, and export the client's type so the rest of the app can ask for it:

```ts
// config/db.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import { defineDb } from 'kitr/db'
import postgres from 'postgres'
import * as schema from '#server/db/schema'

const createDb = () => drizzle(postgres(process.env.DATABASE_URL!), { schema })

export type AppDb = ReturnType<typeof createDb>

export default defineDb({
  connect: () => createDb(),
  disconnect: (db) => db.$client.end(),
})
```

Point `.env` at the database and create the table with Drizzle's own tools:

```sh
# .env
DATABASE_URL=postgres://postgres:acme@localhost:5432/acme
```

```ts
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
})
```

```sh
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

Restart `kitr dev`. The provider connects during boot, before the first request; if Postgres is not running, the server does not start and the log shows the driver's error, such as `ECONNREFUSED`. `config/db.ts` never reaches the browser bundle.

## Read projects with a server action

A server action is a function you define once and call from the browser as if it were local. kitr sends the request, validates the input on the server, runs the handler there and brings back the result. Generate one:

```sh
kitr make:query projects/list
```

```ts
// app/actions/projects/list.ts
import { desc, eq } from 'drizzle-orm'
import { defineQuery } from 'kitr/actions'
import { useDb } from 'kitr/db'
import { useRequestApp } from 'kitr/server'
import { z } from 'zod'
import { app } from '#app/app'
import type { AppDb } from '#config/db'
import { projects } from '#server/db/schema'

export const listProjects = defineQuery('projects.list', {
  input: z.object({ teamId: z.string() }),
  handler: ({ input }) =>
    useDb<AppDb>(useRequestApp(app))
      .select()
      .from(projects)
      .where(eq(projects.teamId, input.teamId))
      .orderBy(desc(projects.createdAt)),
})
```

The handler, Drizzle and the Postgres driver only run on the server; none of it reaches the browser bundle. `useRequestApp(app)` is the app for the current request, so services bound per request work inside the handler.

The name `projects.list` is the action's address. `kitr types` (which `kitr dev` runs, and reruns whenever a file in `app/actions/` changes) writes it into `.kitr/actions.ts`, so a component can use it by name with full types. Load it in the page's loader and read it in the component:

```tsx
// app/routes/projects/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { queryOptions, useSuspenseQuery } from 'kitr/query'
import { seo } from 'kitr/seo'

export const Route = createFileRoute('/projects/')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(queryOptions('projects.list', { teamId: 'team_acme' })),
  head: () => seo({ title: 'Projects · Acme', description: 'Every project the Acme team runs.' }),
  component: ProjectsPage,
})

function ProjectsPage() {
  const { data: projects } = useSuspenseQuery('projects.list', { teamId: 'team_acme' })
  return (
    <main className="mx-auto grid max-w-2xl gap-4 p-6">
      <h1 className="text-2xl font-semibold">Projects</h1>
      <ul>
        {projects.map((project) => (
          <li key={project.id}>{project.name}</li>
        ))}
      </ul>
    </main>
  )
}
```

Open `/projects`. The server runs the loader, which calls the handler in-process (no HTTP hop), renders the list into the HTML and sends the data along, so the browser does not fetch it again. View the page source and the project names are there, which is what search engines and link previews read. `useSuspenseQuery('projects.lst')` is a type error: the name is not registered.

## Create projects with a form

Put the schema where both sides can import it. The form validates with it in the browser, and the action validates with it again on the server, because the browser can be bypassed:

```ts
// app/features/projects/schema.ts
import { z } from 'zod'

export const newProjectSchema = z.object({
  teamId: z.string(),
  name: z.string().trim().min(2, 'Give the project a name of at least two letters'),
})

export type NewProject = z.output<typeof newProjectSchema>
```

```sh
kitr make:mutation projects/create
```

```ts
// app/actions/projects/create.ts
import { and, eq } from 'drizzle-orm'
import { defineMutation } from 'kitr/actions'
import { KitrError } from 'kitr/app'
import { useDb } from 'kitr/db'
import { useRequestApp } from 'kitr/server'
import { app } from '#app/app'
import type { AppDb } from '#config/db'
import { newProjectSchema } from '#app/features/projects/schema'
import { projects } from '#server/db/schema'

export const createProject = defineMutation('projects.create', {
  input: newProjectSchema,
  effects: { invalidate: [['action', 'projects.list']] },
  handler: async ({ input }) => {
    const db = useDb<AppDb>(useRequestApp(app))
    const taken = await db
      .select()
      .from(projects)
      .where(and(eq(projects.teamId, input.teamId), eq(projects.name, input.name)))
    if (taken.length) throw KitrError.validation({ name: ['This team already has a project with that name'] })
    const [project] = await db
      .insert(projects)
      .values({ id: `prj_${crypto.randomUUID().slice(0, 8)}`, ...input })
      .returning()
    return project!
  },
})
```

`effects` says what the mutation changes in the cache. Action queries are cached under `['action', '<name>', input]`, so `['action', 'projects.list']` covers every team's list. When the mutation succeeds, every list on screen refetches. No component has to remember to.

Use it from a form:

```tsx
// app/features/projects/new-project-form.tsx
import { FieldInput, Form, FormField, SubmitButton, useSchemaForm } from 'kitr/forms'
import { useMutation } from 'kitr/query'
import { newProjectSchema } from './schema'

export function NewProjectForm({ teamId }: { teamId: string }) {
  const create = useMutation('projects.create')
  const form = useSchemaForm(newProjectSchema, { defaultValues: { teamId, name: '' } })
  return (
    <Form form={form} onSubmit={create.mutateAsync} resetOnSuccess className="flex items-end gap-2">
      <FormField name="name" label="New project">
        <FieldInput placeholder="Apollo launch" />
      </FormField>
      <SubmitButton pendingText="Creating…">Create</SubmitButton>
    </Form>
  )
}
```

Render `<NewProjectForm teamId="team_acme" />` above the list in `ProjectsPage`. Type `Apollo launch` and press Create: the project appears at the top of the list. Submit the same name again and "This team already has a project with that name" appears under the field. The handler threw `KitrError.validation`, the error crossed the network with its field errors intact, and `<Form>` put each message under its input. Anything else a handler throws becomes a `500`, logged on the server; in production the browser only sees `Internal server error`.

## Open an API for other clients

Server actions are for your own React app. When something else calls the same logic, such as the iPhone app, a partner or a webhook, give it a URL. [API routes](/packages/api) are controllers with typed routes, validation and an OpenAPI document:

```sh
kitr make:controller projects
```

```ts
// server/controllers/projects_controller.ts
import { desc, eq } from 'drizzle-orm'
import type { HttpContext } from 'kitr/api'
import { KitrError } from 'kitr/app'
import { useDb } from 'kitr/db'
import type { AppDb } from '#config/db'
import { projects } from '#server/db/schema'

export default class ProjectsController {
  async index({ app, params }: HttpContext<{ teamId: string }>) {
    return useDb<AppDb>(app)
      .select()
      .from(projects)
      .where(eq(projects.teamId, params.teamId))
      .orderBy(desc(projects.createdAt))
  }

  async show({ app, params }: HttpContext<{ teamId: string; id: string }>) {
    const [project] = await useDb<AppDb>(app).select().from(projects).where(eq(projects.id, params.id))
    if (!project || project.teamId !== params.teamId) throw KitrError.notFound('Project')
    return project
  }
}
```

```ts
// server/routes.ts
import { defineRoutes } from 'kitr/api'
import HealthController from '#server/controllers/health_controller'
import ProjectsController from '#server/controllers/projects_controller'

export const routes = defineRoutes((router) =>
  router.group({ prefix: '/api' }, (api) =>
    api
      .get('/health', [HealthController, 'show'], { name: 'health' })
      .get('/teams/:teamId/projects', [ProjectsController, 'index'], { name: 'projects.index' })
      .get('/teams/:teamId/projects/:id', [ProjectsController, 'show'], { name: 'projects.show' }),
  ),
)

export type AppRoutes = typeof routes.$types
```

```sh
curl http://localhost:3000/api/teams/team_acme/projects
```

```json
[{ "id": "prj_5f1c2a9e", "teamId": "team_acme", "name": "Apollo launch", "createdAt": "2026-11-07T09:14:00.000Z" }]
```

The same URL answers on port 3001 from the `api` platform. A missing project answers `404` with `{ "code": "NOT_FOUND", "message": "Project not found", "status": 404 }`, the same error shape actions use. `kitr api:sync` writes `openapi.json` for partners and the route table the typed browser client needs; the [API guide](/packages/api#call-the-api-from-the-browser) shows `api.projects.index({ params: { teamId } })`.

Both read the same table with the same code, so pick per caller, not per feature: actions for your own UI, API routes for everyone else.

## Push changes to every open tab

Grace has the projects page open when Ada creates "Apollo launch". With [Realtime](/packages/realtime), Grace's list refreshes on its own. A channel is defined once and imported by both ends:

```ts
// app/channels/projects.ts
import { defineChannel } from 'kitr/realtime'
import { z } from 'zod'

export const teamProjectsChannel = defineChannel({
  name: 'team-projects',
  params: z.object({ teamId: z.string() }),
  events: {
    created: {
      schema: z.object({ id: z.string(), name: z.string() }),
      effects: () => ({ invalidate: [['action', 'projects.list']] }),
    },
  },
})
```

Register it with the realtime server the kit wrote:

```ts
// server/realtime.ts
import { createRealtimeServer } from 'kitr/realtime/server'
import { teamProjectsChannel } from '#app/channels/projects'

export const realtime = createRealtimeServer({
  channels: [teamProjectsChannel],
})
```

Emit from the action, after the insert:

```ts
// app/actions/projects/create.ts
// ...
import { teamProjectsChannel } from '#app/channels/projects'
import { realtime } from '#server/realtime'

export const createProject = defineMutation('projects.create', {
  // ...input and effects as before
  handler: async ({ input }) => {
    // ...the duplicate check and the insert as before
    realtime.use(teamProjectsChannel, { teamId: input.teamId }).emit('created', {
      id: project!.id,
      name: project!.name,
    })
    return project!
  },
})
```

And subscribe on the page. The socket only exists in the browser, so subscribe from a component that mounts after hydration:

```tsx
// app/features/projects/live-projects.tsx
import { useChannel } from 'kitr/realtime/react'
import { teamProjectsChannel } from '#app/channels/projects'
import { realtime } from '#app/realtime'

export function LiveProjects({ teamId }: { teamId: string }) {
  const live = useChannel(realtime(), teamProjectsChannel, { teamId })
  return <small>{live.status === 'open' ? 'Live' : 'Connecting…'}</small>
}
```

Open `/projects` in two windows and create a project in one. The other shows it within a moment: the server sent one `created` event to every connection subscribed to `team-projects` with `{ teamId: 'team_acme' }`, each browser validated the payload against the schema and ran the event's `effects`, which refetched the list. [Add live updates](/guides/live-updates) covers authorising channels, writing events straight into the cache and running more than one server.

## Test the API and the action

The kit includes [Testing](/packages/testing). The server is a fetch handler, so an API test calls it without opening a port:

```ts
// @vitest-environment node
// test/projects.test.ts
import { createTestClient } from 'kitr/testing'
import { expect, it } from 'vitest'
import { server } from '#server/main'

it('answers 404 for a project in another team', async () => {
  const res = await createTestClient(server).get('/api/teams/team_acme/projects/prj_missing')
  expect(res.status).toBe(404)
  expect(res.body).toMatchObject({ code: 'NOT_FOUND' })
})
```

```sh
npm test
```

The first request boots the server's app with every provider in `kitrrc.ts`, as `kitr dev` does, including the database. Point it at a throwaway database, never the one you develop against: [Test your app](/guides/testing) sets one up with `.env.test`, and covers components, pages and CI.

## Ship it

```sh
npm run build
npm start
```

`kitr build` builds every platform: the site into `dist/site` (`client/` and `server/server.js`), and the API typechecks. `kitr start site` serves pages and `/api/*` from one process on port 3000. Run `pnpm drizzle-kit migrate` in your deploy step before the new version starts. [Deploy to production](/guides/deploy) covers Docker, environment variables and hosts.

## Next steps

- [Add sign-in, end to end](/guides/authentication): sessions in actions with `requireSession`, and `authMiddleware` on the API.
- [Add live updates](/guides/live-updates): typed events that write straight into the cache.
- [Actions](/packages/actions): middleware, calling actions from loaders and jobs, and the generated registry.
- [API routes](/packages/api): resources, middleware, rate limits, OpenAPI and the typed client.
- [Keep several apps in one repository](/guides/monorepo): split the API and the site into apps that share a package of schemas.
