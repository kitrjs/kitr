---
title: Database
description: Connect your database so every request can use it.
order: 1
---

# Database

Orders, invoices, projects, teams: almost every app keeps its data in a database. `@kitr/db` opens the connection when your app starts, hands the same client to every controller, action and job, and closes it cleanly when the server stops. It ships no ORM. You bring [Drizzle](https://orm.drizzle.team), [Prisma](https://www.prisma.io/docs), [Kysely](https://kysely.dev) or a plain [`pg`](https://node-postgres.com) pool, and kitr runs it inside the [app lifecycle](/docs/configuration).

It runs on the server only. If you only need to keep data in the browser or on a device, use [storage](/packages/storage) instead.

This guide follows Acme's app at `app.acme.com`: a Postgres database with `orders` and `projects` tables, read through Drizzle.

## Install

```sh
kitr add db
```

What `kitr add` does:

- Adds the [server](/packages/server) package first if the project does not have it yet.
- Installs `@kitr/db` (you use it through `@kitr/db`).
- Adds `'@kitr/db'` to `packages` and `() => import('@kitr/db')` to `providers` in `kitrrc.ts`.
- Appends `DATABASE_URL=postgres://localhost:5432/app` under a `# Database` comment to `.env.example`, and to `.env` when it exists.
- Writes `config/db.ts` (shown under Configure). An existing file is left alone.
- Regenerates `config/index.ts`, the config list the standalone server imports.
- Adds a `## kitr: db` section to `AGENTS.md`: "`config/db.ts` connects the ORM; controllers and actions read it with `useDb<AppDb>(ctx.app)` or `ctx.app.container.use('db')`. Migrations are the ORM's own tooling."

`kitr add db` asks no questions. Pass `--dry-run` to print the changes without writing them, or `--no-install` to skip the package manager run.

The `server` kit (`kitr new acme-api --kit server`) already includes db. `kitr remove db` removes the provider, the `packages` entry, the dependency, the `AGENTS.md` section and `config/db.ts`. It leaves `DATABASE_URL` in `.env.example`, and your ORM packages and schema files in place.

## Configure

`kitr add db` writes this file. It connects nothing yet: `connect` returns an empty object until you fill in your ORM.

```ts
// config/db.ts
import { defineDb } from '@kitr/db'

// Example with Drizzle + postgres.js: `pnpm add drizzle-orm postgres`
// import { drizzle } from 'drizzle-orm/postgres-js'
// import postgres from 'postgres'

export default defineDb({
  connect: async () => {
    // const client = postgres(process.env.DATABASE_URL!)
    // return drizzle(client)
    return {} as unknown
  },
  // disconnect: (db) => db.$client.end(),
})
```

`defineDb` takes three functions. Each receives the app, so you can read `app.environment`, `app.isProduction` or another service from `app.container`.

| Option | Default | Description |
| --- | --- | --- |
| `connect(app)` | required | Opens the connection and returns the client. Runs once, during `app.boot()`. If it throws or rejects, boot fails with that error. |
| `disconnect(db, app)` | none | Closes the client. Runs when the server shuts down: on `SIGINT`, `SIGTERM` or `server.close()`. |
| `onReady(db, app)` | none | Runs once after boot, when the server starts serving. Use it to check for pending migrations. |

| Variable | Used for |
| --- | --- |
| `DATABASE_URL` | The connection string your `connect` reads. `kitr add` writes `postgres://localhost:5432/app` as the example value. |

`@kitr/db` also exports `defineConfig`, the same identity helper every package has. Prefer `defineDb`: it infers the client type from `connect`, so `disconnect` and `onReady` receive a typed `db`.

## Connect with Drizzle

Install Drizzle and the postgres.js driver:

```sh
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit
```

Describe the tables. The schema is plain Drizzle; kitr does not read it.

```ts
// server/db/schema.ts
import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  teamId: text('team_id').notNull(),
  name: text('name').notNull(),
})

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  teamId: text('team_id').notNull(),
  customerEmail: text('customer_email').notNull(),
  totalCents: integer('total_cents').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

Then fill in `config/db.ts`. Export the client type as `AppDb` so the rest of the app can ask for it by name.

```ts
// config/db.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { defineDb } from '@kitr/db'
import * as schema from '#server/db/schema'

const createDb = () => drizzle(postgres(process.env.DATABASE_URL!), { schema })

/** The client every controller and action gets from useDb<AppDb>(). */
export type AppDb = ReturnType<typeof createDb>

export default defineDb({
  connect: () => createDb(),
  disconnect: (db) => db.$client.end(),
})
```

Point `DATABASE_URL` in `.env` at a running database:

```sh
DATABASE_URL=postgres://ada@localhost:5432/acme
```

Start the server with `kitr dev`. The provider calls `connect` during boot, before the first request. If Postgres is not running, the server does not start, and the log shows the driver's own error, such as `ECONNREFUSED`.

## Query from a controller

In a controller, `ctx.app` is the app for the current request. Pass it to `useDb` with your client type:

```ts
// server/controllers/orders-controller.ts
import { desc, eq } from 'drizzle-orm'
import type { HttpContext } from '@kitr/api'
import { useDb } from '@kitr/db'
import type { AppDb } from '#config/db'
import { orders } from '#server/db/schema'

export default class OrdersController {
  async index({ app, params }: HttpContext<{ teamId: string }>) {
    const db = useDb<AppDb>(app)
    return db
      .select()
      .from(orders)
      .where(eq(orders.teamId, params.teamId))
      .orderBy(desc(orders.createdAt))
  }
}
```

Register the route as usual with [api](/packages/api):

```ts
// server/routes.ts
import { defineRoutes } from '@kitr/api'
import OrdersController from '#server/controllers/orders-controller'

export const routes = defineRoutes((router) =>
  router.get('/api/teams/:teamId/orders', [OrdersController, 'index']),
)
```

A request returns the rows as JSON:

```sh
curl http://localhost:3001/api/teams/team_acme/orders
```

```json
[{ "id": "ord_1", "teamId": "team_acme", "customerEmail": "grace@acme.com", "totalCents": 4900, "createdAt": "2026-11-02T09:14:00.000Z" }]
```

The request app is a fork of the root app. It shares the root's singletons, so every request gets the same pooled client, not a new connection.

## Query from an action

On the server, an [action](/packages/actions) handler has no `ctx`. Get the request's app with `useRequestApp` from `@kitr/server`, falling back to the root app:

```ts
// app/actions/projects/rename.ts
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { defineMutation } from '@kitr/actions'
import { useDb } from '@kitr/db'
import { useRequestApp } from '@kitr/server'
import { app } from '#app/app'
import type { AppDb } from '#config/db'
import { projects } from '#server/db/schema'

export const renameProject = defineMutation('projects.rename', {
  input: z.object({ id: z.string(), name: z.string().min(2) }),
  effects: (project) => ({ invalidate: [['projects', 'list']], set: [{ key: ['projects', 'detail', project.id], data: project }] }),
  handler: async ({ input }) => {
    const db = useDb<AppDb>(useRequestApp(app))
    const [project] = await db
      .update(projects)
      .set({ name: input.name })
      .where(eq(projects.id, input.id))
      .returning()
    return project
  },
})
```

The handler only runs on the server, so the database driver never reaches the browser bundle. Don't import `config/db.ts` into a component; import it from server code and actions only.

## Query from a service or job

Code that runs outside a request, such as a scheduled [job](/packages/jobs) or a script, has the root app. Pass it to `useDb` directly:

```ts
// server/services/revenue.ts
import { eq, sum } from 'drizzle-orm'
import type { KitrApp } from 'kitr/app'
import { useDb } from '@kitr/db'
import type { AppDb } from '#config/db'
import { orders } from '#server/db/schema'

/** Total revenue for one team, in cents. */
export async function teamRevenue(app: KitrApp, teamId: string): Promise<number> {
  const db = useDb<AppDb>(app)
  const [row] = await db
    .select({ total: sum(orders.totalCents) })
    .from(orders)
    .where(eq(orders.teamId, teamId))
  return Number(row?.total ?? 0)
}
```

Taking `app` as a parameter keeps the function testable: a test passes an app with a fake client (see Testing).

## Read the client without a type

`useDb<T>(app)` is a typed shortcut for `app.container.use('db')`. Both return the same object:

```ts
// server/controllers/health-controller.ts
import type { HttpContext } from '@kitr/api'

export default class HealthController {
  async show({ app }: HttpContext) {
    const db = app.container.use('db') // typed as unknown
    return { ok: db !== undefined }
  }
}
```

`useDb` only casts; it does not check the shape. If `AppDb` and `connect` drift apart, TypeScript catches it only when `AppDb` is derived from `connect`, as in the Drizzle example above. Don't write the type by hand.

When the container has no `db` binding, both throw `[kitr] No binding named "db". Did you add the package that provides it?`. That means the provider is missing from `providers` in `kitrrc.ts`, or the code runs on an app that was created without it.

## Await the client before boot finishes

`connect` usually returns a promise. The provider resolves it during `app.boot()`, so `useDb` is synchronous everywhere after boot: in controllers, actions and jobs. Code that runs before boot completes, such as another provider's `register`, must await the binding instead:

```ts
// app/providers/project_stats.ts
import { defineProvider } from 'kitr/app'
import type { AppDb } from '#config/db'
import { projects } from '#server/db/schema'

export default defineProvider({
  name: 'projectStats',
  register(app) {
    app.container.singleton('projectStats', async (container) => {
      const db = (await container.make('db')) as AppDb
      return { count: async () => (await db.select().from(projects)).length }
    })
  },
})
```

Calling `useDb` while `connect` is still pending throws `[kitr] Binding "db" has an async factory; await container.make('db') before use('db').`

## Connect other ORMs

The provider calls whatever `connect` returns "the client". Any library works. Each one below follows the same steps: install, `config/db.ts`, `.env`, the library's own docs.

### Prisma

```sh
pnpm add @prisma/client
pnpm add -D prisma
```

```ts
// config/db.ts
import { PrismaClient } from '@prisma/client'
import { defineDb } from '@kitr/db'

const createDb = () => new PrismaClient()
export type AppDb = ReturnType<typeof createDb>

export default defineDb({
  connect: async () => {
    const prisma = createDb()
    await prisma.$connect()
    return prisma
  },
  disconnect: (prisma) => prisma.$disconnect(),
})
```

Prisma reads `DATABASE_URL` from `.env` through `schema.prisma`. Calling `$connect()` in `connect` makes a bad URL fail boot instead of the first query. See the [Prisma Client docs](https://www.prisma.io/docs/orm/prisma-client).

### Kysely

```sh
pnpm add kysely pg
pnpm add -D @types/pg
```

```ts
// config/db.ts
import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import { defineDb } from '@kitr/db'
import type { Database } from '#server/db/types'

export type AppDb = Kysely<Database>

export default defineDb({
  connect: (): AppDb =>
    new Kysely<Database>({
      dialect: new PostgresDialect({ pool: new Pool({ connectionString: process.env.DATABASE_URL }) }),
    }),
  disconnect: (db) => db.destroy(),
})
```

`Database` is your table interface, written by hand or generated with `kysely-codegen`. See the [Kysely docs](https://kysely.dev/docs/getting-started).

### A plain pg pool

```sh
pnpm add pg
pnpm add -D @types/pg
```

```ts
// config/db.ts
import { Pool } from 'pg'
import { defineDb } from '@kitr/db'

export type AppDb = Pool

export default defineDb({
  connect: async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 })
    await pool.query('select 1')
    return pool
  },
  disconnect: (pool) => pool.end(),
})
```

The `select 1` checks the URL during boot; a `Pool` opens no connection until its first query. See the [node-postgres pooling docs](https://node-postgres.com/features/pooling).

### SQLite with Drizzle

```sh
pnpm add drizzle-orm better-sqlite3
pnpm add -D @types/better-sqlite3
```

```ts
// config/db.ts
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { defineDb } from '@kitr/db'
import * as schema from '#server/db/schema'

const createDb = () => drizzle(new Database(process.env.DATABASE_URL ?? 'acme.db'), { schema })
export type AppDb = ReturnType<typeof createDb>

export default defineDb({
  connect: () => createDb(),
  disconnect: (db) => db.$client.close(),
})
```

Here `DATABASE_URL` is a file path such as `acme.db`. The schema uses `drizzle-orm/sqlite-core` tables instead of `pg-core`. See [Drizzle with SQLite](https://orm.drizzle.team/docs/get-started-sqlite).

## Validate DATABASE_URL at startup

`process.env.DATABASE_URL!` crashes deep inside the driver when the variable is missing. Declare it in the typed env instead, so the app refuses to start with a clear message:

```ts
// app/env.ts
import { createEnv, env as e } from 'kitr/env'

export const env = createEnv({
  public: {},
  server: {
    DATABASE_URL: e.url(),
  },
})
```

```ts
// config/db.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { defineDb } from '@kitr/db'
import { env } from '#app/env'
import * as schema from '#server/db/schema'

const createDb = () => drizzle(postgres(env.DATABASE_URL), { schema })
export type AppDb = ReturnType<typeof createDb>

export default defineDb({
  connect: () => createDb(),
  disconnect: (db) => db.$client.end(),
})
```

See [configuration](/docs/configuration) for how `createEnv` reads `.env` files.

## Change settings per environment

`connect` receives the app. Read `app.isProduction` or `app.environment` to size the pool or turn on TLS only where it matters:

```ts
// config/db.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { defineDb } from '@kitr/db'
import * as schema from '#server/db/schema'

const createDb = (production: boolean) =>
  drizzle(
    postgres(process.env.DATABASE_URL!, {
      max: production ? 20 : 5,
      ssl: production ? 'require' : false,
    }),
    { schema },
  )
export type AppDb = ReturnType<typeof createDb>

export default defineDb({
  connect: (app) => createDb(app.isProduction),
  disconnect: (db) => db.$client.end(),
})
```

`app.environment` is `'server'` for the running server and `'test'` in an app built by `createTestApp`.

## Check migrations when the server starts

`onReady` runs once, after boot, when the server starts serving: on `server.listen()`, or on the first `server.fetch()` outside tests. Use it to warn about, or refuse to run with, an outdated schema:

```ts
// config/db.ts
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { defineDb } from '@kitr/db'
import * as schema from '#server/db/schema'

const createDb = () => drizzle(postgres(process.env.DATABASE_URL!), { schema })
export type AppDb = ReturnType<typeof createDb>

const EXPECTED_MIGRATIONS = 12

export default defineDb({
  connect: () => createDb(),
  disconnect: (db) => db.$client.end(),
  onReady: async (db, app) => {
    const rows = await db.execute(sql`select count(*)::int as count from drizzle.__drizzle_migrations`)
    const applied = Number(rows[0]?.count ?? 0)
    if (applied < EXPECTED_MIGRATIONS) {
      if (app.isProduction) throw new Error(`Database is ${EXPECTED_MIGRATIONS - applied} migrations behind`)
      app.container.use('logger').warn(`Run pnpm db:migrate: ${EXPECTED_MIGRATIONS - applied} pending`)
    }
  },
})
```

`onReady` does not run in tests built with `createTestApp`, which only boots. The logger binding comes from [logger](/packages/logger).

## Run migrations

kitr has no migration runner. Your ORM's tools work unchanged, so their docs apply as written. Add scripts to `package.json`:

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  }
}
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

Run `pnpm db:migrate` in your deploy step, before the new server starts. With Prisma the commands are `prisma migrate dev` and `prisma migrate deploy`. See [Drizzle migrations](https://orm.drizzle.team/docs/migrations).

> **Warning**
> Don't run migrations from `connect` or `onReady` when more than one server instance starts at once. Two instances migrating the same database at the same time can leave it half-migrated. Run them once, from the deploy pipeline.

## Use a transaction

Transactions belong to your ORM. Get the client with `useDb` and call its own API:

```ts
// server/services/checkout.ts
import { eq } from 'drizzle-orm'
import type { KitrApp } from 'kitr/app'
import { useDb } from '@kitr/db'
import type { AppDb } from '#config/db'
import { orders, projects } from '#server/db/schema'

export async function placeOrder(app: KitrApp, input: { id: string; teamId: string; projectId: string }) {
  const db = useDb<AppDb>(app)
  return db.transaction(async (tx) => {
    const [project] = await tx.select().from(projects).where(eq(projects.id, input.projectId))
    if (!project) throw new Error(`Project ${input.projectId} not found`)
    const [order] = await tx
      .insert(orders)
      .values({ id: input.id, teamId: input.teamId, customerEmail: 'linus@acme.com', totalCents: 4_900 })
      .returning()
    return order
  })
}
```

If the callback throws, Drizzle rolls back both statements.

## Close the connection on shutdown

When the server receives `SIGINT` or `SIGTERM`, it stops accepting requests, then runs every provider's `shutdown` in reverse order. The db provider calls your `disconnect` there, so open queries finish before the pool closes:

```ts
// server/main.ts
import { mountRoutes } from '@kitr/api'
import { createServer } from '@kitr/server'
import { config } from '../config'
import rc from '../kitrrc'
import { routes } from './routes'

export const server = createServer({ providers: rc.providers, config })
mountRoutes(server, routes)

await server.listen({ port: 3001 })
// Ctrl-C logs "SIGINT received, shutting down", then calls disconnect(db, app).
```

If you leave `disconnect` out, the process still exits, but the database sees the connections drop instead of closing.

## Errors

These errors come from the app container and config when the database binding is wrong. Driver errors (`ECONNREFUSED`, authentication failures) pass through unchanged.

| Error | When | What to do |
| --- | --- | --- |
| `[kitr] Missing config "db". Create config/db.ts or pass it to createApp().` | The provider is registered but there is no `config/db.ts`, or a test passed no `db` config. | Run `kitr add db` again, or pass `config: { db: defineDb(...) }`. |
| `[kitr] No binding named "db". Did you add the package that provides it?` | `useDb` on an app without the db provider. | Add `() => import('@kitr/db')` to `providers` in `kitrrc.ts`, or `providers: [dbProvider]` in a test. |
| `[kitr] Binding "db" has an async factory; await container.make('db') before use('db').` | `useDb` before `app.boot()` finished. | Await `app.boot()` first, or use `await app.container.make('db')`. |
| The error `connect` threw | `connect` failed, for example the database is down. | Boot rejects with it and the server does not start. Fix the URL or start the database. |

## Testing

In a test, build the app with `createTestApp` from [testing](/packages/testing) and give `config` a `db` whose `connect` returns a fake. The provider binds it exactly as it binds the real client, so code under test calls `useDb` unchanged.

This tests `teamRevenue` from "Query from a service or job" against a fake client that answers one query:

```ts
// server/services/revenue.test.ts
import { dbProvider, defineDb } from '@kitr/db'
import { createTestApp } from '@kitr/testing'
import { describe, expect, it, vi } from 'vitest'
import type { AppDb } from '#config/db'
import { teamRevenue } from '#server/services/revenue'

describe('teamRevenue', () => {
  it('sums the team orders and closes the client on shutdown', async () => {
    const where = vi.fn(async () => [{ total: '16900' }])
    const fakeDb = { select: () => ({ from: () => ({ where }) }) } as unknown as AppDb
    const disconnect = vi.fn()

    const app = await createTestApp({
      providers: [dbProvider],
      config: { db: defineDb({ connect: () => fakeDb, disconnect }) },
    })

    expect(await teamRevenue(app, 'team_acme')).toBe(16_900)
    expect(where).toHaveBeenCalledOnce()

    await app.shutdown()
    expect(disconnect).toHaveBeenCalledWith(fakeDb, app)
  })
})
```

`createTestApp` boots the app, so `connect` has run and `useDb` works. It does not call `onReady`; call `await app.ready()` in the test when you want it.

To replace the client in an app that has already booted, bind a value over it. Every later `useDb`, including in request forks, returns the new value:

```ts
// test/orders.test.ts
import { dbProvider, defineDb, useDb } from '@kitr/db'
import { createTestApp } from '@kitr/testing'
import { expect, it } from 'vitest'

it('uses the stub bound after boot', async () => {
  const app = await createTestApp({
    providers: [dbProvider],
    config: { db: defineDb({ connect: () => ({ name: 'real' }) }) },
  })
  app.container.value('db', { name: 'stub' })
  expect(useDb<{ name: string }>(app)).toEqual({ name: 'stub' })
})
```

Bind the value after boot, not before: the provider's `register` replaces anything bound under `db` before it runs.

For queries you want to run for real, point `DATABASE_URL` at a throwaway test database in `.env.test` and run your migrations before the suite. For Postgres without a server, [PGlite](https://pglite.dev) runs in-process and Drizzle supports it through `drizzle-orm/pglite`.

To test a controller end to end, mount the routes on a server built with the fake db config and call it with `createTestClient(server)`. See [testing](/packages/testing).

## Next steps

- [API reference](/packages/db/api): `defineDb`, `DbDefinition`, `dbProvider`, `useDb`.
- [Drizzle ORM docs](https://orm.drizzle.team/docs/overview): schema, queries and migrations.
- [api](/packages/api): routes and controllers that read the database.
- [actions](/packages/actions): server functions your components call.
- [Getting started](/docs/getting-started): the server kit, which includes db.
