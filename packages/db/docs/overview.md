---
title: Overview
description: Connect your database so every request can use it.
order: 0
---

# Database

Orders, invoices, projects, teams: almost every app keeps its data in a database. The ORM is the easy choice. The hard part is everything around it: opening the connection once when the app starts, handing the same client to every controller, action and job, closing it cleanly on shutdown, and failing loudly at boot when `DATABASE_URL` is wrong instead of on the first request.

`@kitr/db` does that part and leaves the ORM to you.

## What it is

`@kitr/db` connects your database to the kitr app lifecycle. You describe the connection once with `defineDb`, and the provider opens it at boot, binds the client in the container, hands it to `useDb()` in controllers, actions, services and jobs, and closes it when the server stops. It can check that migrations are current before the server accepts traffic.

It ships no ORM. It runs on the server only. To keep data in the browser or on a device, use [storage](/packages/storage) instead.

## Install

```sh
kitr add db
```

This installs `@kitr/db`, registers the provider in `kitrrc.ts`, writes `config/db.ts` and adds `DATABASE_URL` to `.env.example`. Bring your own ORM. The guide's [Install](/packages/db/guide#install) section lists every change.

## Quick start

With Drizzle and postgres.js installed (`pnpm add drizzle-orm postgres`), describe the connection once:

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

Then read it anywhere on the server:

```ts
// server/controllers/orders_controller.ts
import type { HttpContext } from '@kitr/api'
import { useDb } from '@kitr/db'
import type { AppDb } from '#config/db'

export default class OrdersController {
  async index({ app }: HttpContext) {
    return useDb<AppDb>(app).query.orders.findMany()
  }
}
```

Point `DATABASE_URL` in `.env` at a running database and run `kitr dev`. The provider connects during boot, before the first request, and the server refuses to start if Postgres is not reachable. The guide continues from here: [Connect with Drizzle](/packages/db/guide#connect-with-drizzle).

## Built on

`@kitr/db` is built on the kitr [server](/packages/server) lifecycle and container. The database client itself is whichever you bring:

| ORM or driver | Docs |
| --- | --- |
| Drizzle (the guide's examples) | [orm.drizzle.team](https://orm.drizzle.team/docs/overview) |
| Prisma | [prisma.io/docs](https://www.prisma.io/docs) |
| Kysely | [kysely.dev](https://kysely.dev) |
| node-postgres | [node-postgres.com](https://node-postgres.com) |

kitr adds the typed definition, boot-time validation of `DATABASE_URL`, per-environment settings, the migration check, `useDb()` and clean shutdown.

## Problems it solves

- **A client created in every file.** One `defineDb` and one `useDb()` wherever you need it. See [Connect with Drizzle](/packages/db/guide#connect-with-drizzle).
- **Database code in controllers, actions and jobs looking different.** The same `useDb()` works in all three. See [Query from a controller](/packages/db/guide#query-from-a-controller).
- **A bad connection string found on the first request.** The URL is validated at startup and the server refuses to boot without it. See [Validate DATABASE_URL at startup](/packages/db/guide#validate-database_url-at-startup).
- **Deploying code ahead of its migrations.** The provider can check pending migrations before the server starts listening. See [Check migrations when the server starts](/packages/db/guide#check-migrations-when-the-server-starts).
- **Connections left open on shutdown.** The pool closes after in-flight requests finish. See [Close the connection on shutdown](/packages/db/guide#close-the-connection-on-shutdown).

## Further reading

- [Guide](/packages/db/guide): install, configure and every task.
- [API reference](/packages/db/api): `defineDb`, `DbDefinition`, `dbProvider` and `useDb`.
- [Drizzle ORM docs](https://orm.drizzle.team/docs/overview): schema, queries and migrations.
- [API routes](/packages/api) and [Actions](/packages/actions): the code that reads the database.
- [Server](/packages/server): the lifecycle the provider runs in.
