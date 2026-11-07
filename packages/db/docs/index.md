---
title: Database
description: Connect your database so every request can use it.
order: 1
---

# Database

kitr doesn't ship an ORM. Use the one you like: Drizzle, Prisma, Kysely, or a plain `pg` pool. `kitr/db` does the part that every app repeats. It opens the connection when the app starts, makes it available to every controller and action, and closes it cleanly when the server stops.

## Install

```sh
kitr add db
```

This needs the [server](/packages/server) package. It writes `config/db.ts` and adds `DATABASE_URL` to `.env`.

## Connect

Fill in `config/db.ts` with your ORM. With Drizzle and postgres.js (`pnpm add drizzle-orm postgres`):

```ts
// config/db.ts
import { defineDb } from 'kitr/db'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

export default defineDb({
  connect: () => drizzle(postgres(process.env.DATABASE_URL!)),
  disconnect: (db) => db.$client.end(),
})

export type AppDb = ReturnType<typeof drizzle>
```

| Option | Default | Description |
| --- | --- | --- |
| `connect(app)` | required | Returns the client. It runs once, the first time something uses `db`. |
| `disconnect(db, app)` | none | Runs when the server shuts down. |
| `onReady(db, app)` | none | Runs once the app has started, for example to check for pending migrations. |

## Use it

In a controller, `ctx.app` is the app for the current request:

```ts
import { useDb } from 'kitr/db'
import type { AppDb } from '#config/db'

import type { HttpContext } from 'kitr/api'

export default class ProjectsController {
  async index(ctx: HttpContext) {
    const db = useDb<AppDb>(ctx.app)
    return db.select().from(projects)
  }
}
```

In an [action](/packages/actions) or a service, use `useDb<AppDb>(useRequestApp(app))` from `kitr/server`. `ctx.app.container.use('db')` returns the same client without the type.

## Migrations

Run migrations with your ORM's own tools, such as `drizzle-kit migrate` or `prisma migrate deploy`. kitr stays out of the way so their docs apply unchanged.

## Tests

Point `DATABASE_URL` at a test database. Or, in [testing](/packages/testing), bind a fake before the app boots:

```ts
const app = await createTestApp()
app.container.value('db', fakeDb)
```
