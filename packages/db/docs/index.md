---
title: Database
description: Connect your database so every request can use it.
order: 1
---

# Database

kitr ships no ORM. `defineDb` joins whichever one you pick (Drizzle, Prisma, Kysely, a raw driver) to the app lifecycle: connect at boot, disconnect at shutdown, available as `db` in the container and as `ctx.db` in controllers and actions.

## Install

```sh
kitr add db
```

```ts
// config/db.ts
import { defineDb } from 'kitr/db'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

export default defineDb({
  connect: async () => drizzle(postgres(process.env.DATABASE_URL!)),
  disconnect: (db) => db.$client.end(),
})
```

The recipe adds `DATABASE_URL` to `.env.example` and the provider to `kitrrc.ts`.

## Use it

```ts
// server/controllers/projects_controller.ts
import { useDb } from 'kitr/db'
import type { AppDb } from '#config/db'

export default class ProjectsController {
  async index({ app }: Context) {
    const db = useDb<AppDb>(app)
    return db.select().from(projects)
  }
}
```

Export the inferred type from `config/db.ts` (`export type AppDb = Awaited<ReturnType<typeof config.connect>>`) so every caller gets the ORM's own types. Migrations stay with the ORM's tooling.

## Tests

`createTestApp({ config: { db: defineDb({ connect: async () => fakeDb }) } })` swaps the connection without touching the code under test.
