---
title: Database
description: Connect your database so every request can use it.
order: 1
---

# Database

Almost every app keeps its data in a database. `@kitr/db` opens the connection when your app starts, hands the same client to every controller, action and job, and closes it cleanly when the server stops.

> [!SUMMARY]
> Connect your database so every request can use it. Add it with `kitr add db`; the overview is at [/packages/db](/packages/db).

It ships no ORM. Bring [Drizzle](https://orm.drizzle.team), [Prisma](https://www.prisma.io/docs), [Kysely](https://kysely.dev) or a plain [`pg`](https://node-postgres.com) pool, and kitr runs it inside the [app lifecycle](/docs/configuration). It runs on the server only; for browser or device data, use [storage](/packages/storage).

The examples use Acme's Postgres database with `orders` and `projects` tables, read through Drizzle.

## Install

```sh
kitr add db
```

<details>
<summary>Everything kitr add changes</summary>

What `kitr add` does:

- Adds the [server](/packages/server) package first when missing.
- Installs `@kitr/db`.
- Adds `'@kitr/db'` to `packages` and `() => import('@kitr/db')` to `providers` in `kitrrc.ts`.
- Appends `DATABASE_URL=postgres://localhost:5432/app` under a `# Database` comment to `.env.example`, and to `.env` when it exists.
- Writes `config/db.ts` (shown under Configure). An existing file is left alone.
- Regenerates `config/index.ts`, the config list the standalone server imports.
- Adds a `## kitr: db` section to `AGENTS.md`: "`config/db.ts` connects the ORM; controllers and actions read it with `useDb<AppDb>(ctx.app)` or `ctx.app.container.use('db')`. Migrations are the ORM's own tooling."

`kitr add db` asks no questions. Pass `--dry-run` to preview or `--no-install` to skip the package manager. The `server` kit includes db.

`kitr remove db` removes the provider, the `packages` entry, the dependency, the `AGENTS.md` section and `config/db.ts`. It leaves `DATABASE_URL`, your ORM packages and schema files.

</details>

## Configure

`kitr add db` writes this file. `connect` returns an empty object until you fill in your ORM.

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

`defineDb` takes three functions, each receiving the app.

| Option | Default | Description |
| --- | --- | --- |
| `connect(app)` | required | Opens the connection and returns the client. Runs once, during `app.boot()`. If it throws or rejects, boot fails with that error. |
| `disconnect(db, app)` | none | Closes the client. Runs when the server shuts down: on `SIGINT`, `SIGTERM` or `server.close()`. |
| `onReady(db, app)` | none | Runs once after boot, when the server starts serving. Use it to check for pending migrations. |

| Variable | Used for |
| --- | --- |
| `DATABASE_URL` | The connection string your `connect` reads. `kitr add` writes `postgres://localhost:5432/app` as the example value. |

Prefer `defineDb` to `defineConfig`: it infers the client type from `connect`, so `disconnect` and `onReady` receive a typed `db`.

## Connect with Drizzle

Install Drizzle and the postgres.js driver:

```sh
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit
```

Describe the tables in plain Drizzle.

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

Fill in `config/db.ts` and export the client type as `AppDb`.

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

Start the server with `kitr dev`. `connect` runs during boot, before the first request. If Postgres is not running, the server does not start and the log shows the driver's error, such as `ECONNREFUSED`.

## Query from a controller

In a controller, pass `ctx.app` to `useDb` with your client type:

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

Every request shares the same pooled client, not a new connection.

## Query from an action

An [action](/packages/actions) handler has no `ctx`; get the request's app with `useRequestApp` from `@kitr/server`:

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

> [!WARNING]
> Don't import `config/db.ts` into a component; import it from server code and actions only.

## Query from a service or job

Outside a request, such as a scheduled [job](/packages/jobs), pass the root app to `useDb`:

```ts
// server/services/revenue.ts
import { eq, sum } from 'drizzle-orm'
import type { KitrApp } from '@kitr/kitr/app'
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

Taking `app` as a parameter keeps the function testable (see Testing).

## Read the client without a type

`useDb<T>(app)` is a typed shortcut for `app.container.use('db')`:

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

> [!WARNING]
> `useDb` only casts. Derive `AppDb` from `connect`, as in the Drizzle example, rather than writing the type by hand.

Without the provider in `providers`, both throw `No binding named "db"`.

## Await the client before boot finishes

The provider resolves `connect` during `app.boot()`, so `useDb` is synchronous after boot. Code that runs earlier, such as another provider's `register`, must await the binding:

```ts
// app/providers/project_stats.ts
import { defineProvider } from '@kitr/kitr/app'
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


## Connect other ORMs

Any library works: whatever `connect` returns is the client.

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

Calling `$connect()` makes a bad URL fail boot instead of the first query. See the [Prisma Client docs](https://www.prisma.io/docs/orm/prisma-client).

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

`Database` is your table interface, by hand or from `kysely-codegen`. See the [Kysely docs](https://kysely.dev/docs/getting-started).

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

The `select 1` checks the URL during boot, because a `Pool` opens no connection until its first query. See the [pooling docs](https://node-postgres.com/features/pooling).

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

Here `DATABASE_URL` is a file path such as `acme.db`, and tables come from `drizzle-orm/sqlite-core`. See [Drizzle with SQLite](https://orm.drizzle.team/docs/get-started-sqlite).

## Validate DATABASE_URL at startup

A missing `process.env.DATABASE_URL!` crashes deep inside the driver. Declare it in the typed env so the app refuses to start with a clear message:

```ts
// app/env.ts
import { createEnv, env as e } from '@kitr/kitr/env'

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


## Change settings per environment

Read `app.isProduction` or `app.environment` in `connect` to size the pool or turn on TLS only where it matters:

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


## Check migrations when the server starts

`onReady` runs once after boot, when the server starts serving. Use it to warn about, or refuse to run with, an outdated schema:

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

`onReady` does not run under `createTestApp`. The logger comes from [logger](/packages/logger).

## Run migrations

Your ORM's migration tools work unchanged. Add scripts to `package.json`:

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

Run `pnpm db:migrate` in your deploy step, before the new server starts. See [Drizzle migrations](https://orm.drizzle.team/docs/migrations).

> [!WARNING]
> Don't run migrations from `connect` or `onReady`: two instances migrating at once can leave the database half-migrated. Run them once, from the deploy pipeline.

## Use a transaction

Transactions belong to your ORM; call its API on the client from `useDb`:

```ts
// server/services/checkout.ts
import { eq } from 'drizzle-orm'
import type { KitrApp } from '@kitr/kitr/app'
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


## Close the connection on shutdown

On `SIGINT` or `SIGTERM` the server stops accepting requests, then calls your `disconnect`, so open queries finish before the pool closes:

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

Without `disconnect`, the database sees connections drop instead of closing.

## Errors

Driver errors (`ECONNREFUSED`, authentication failures) pass through unchanged. These come from a wrong database binding:

| Error | When | What to do |
| --- | --- | --- |
| `[kitr] Missing config "db". Create config/db.ts or pass it to createApp().` | The provider is registered but there is no `config/db.ts`, or a test passed no `db` config. | Run `kitr add db` again, or pass `config: { db: defineDb(...) }`. |
| `[kitr] No binding named "db". Did you add the package that provides it?` | `useDb` on an app without the db provider. | Add `() => import('@kitr/db')` to `providers` in `kitrrc.ts`, or `providers: [dbProvider]` in a test. |
| `[kitr] Binding "db" has an async factory; await container.make('db') before use('db').` | `useDb` before `app.boot()` finished. | Await `app.boot()` first, or use `await app.container.make('db')`. |
| The error `connect` threw | `connect` failed, for example the database is down. | Boot rejects with it and the server does not start. Fix the URL or start the database. |

## Testing

Build the app with `createTestApp` from [testing](/packages/testing) and give `config` a `db` whose `connect` returns a fake. Code under test calls `useDb` unchanged. This tests `teamRevenue` from "Query from a service or job":

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

`createTestApp` runs `connect` but not `onReady`; call `await app.ready()` for that. To replace the client in an app that has booted, bind a value over it:

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

Bind after boot, not before: the provider's `register` replaces anything bound under `db`.

For real queries, point `DATABASE_URL` at a throwaway database in `.env.test`, or use [PGlite](https://pglite.dev), which runs Postgres in-process through `drizzle-orm/pglite`. To test a controller end to end, call it with `createTestClient(server)` from [testing](/packages/testing).

## Next steps

- [API reference](/packages/db/api): `defineDb`, `dbProvider`, `useDb`.
- [API routes](/packages/api): routes and controllers that read the database.
- [Actions](/packages/actions): server functions your components call.
