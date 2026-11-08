---
title: Overview
description: Connect your database so every request can use it.
order: 0
---

# Database

## What it is

`@kitr/db` connects your database to the app lifecycle. Describe the connection once with `defineDb`; the provider opens it at boot, hands it to `useDb()` everywhere on the server and closes it on shutdown.

It ships no ORM and runs on the server only. For data on the device, use [storage](/packages/storage).

## Install

```sh
kitr add db
```

Adds `@kitr/db`, its provider, `config/db.ts` and `DATABASE_URL` in `.env.example`. Bring your own ORM. [Every change](/packages/db/guide#install).

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

Point `DATABASE_URL` at a running database and run `kitr dev`. The provider connects at boot and refuses to start if the database is unreachable. Next in the guide: [Connect with Drizzle](/packages/db/guide#connect-with-drizzle).

## Built on

`@kitr/db` is built on the kitr [server](/packages/server) lifecycle and container. The database client itself is whichever you bring:

| ORM or driver | Docs |
| --- | --- |
| Drizzle (the guide's examples) | [orm.drizzle.team](https://orm.drizzle.team/docs/overview) |
| Prisma | [prisma.io/docs](https://www.prisma.io/docs) |
| Kysely | [kysely.dev](https://kysely.dev) |
| node-postgres | [node-postgres.com](https://node-postgres.com) |

kitr adds the typed definition, startup validation of `DATABASE_URL`, the migration check, `useDb()` and clean shutdown.

## Problems it solves

- **A client created in every file.** [Connect with Drizzle](/packages/db/guide#connect-with-drizzle).
- **Database code in controllers, actions and jobs looking different.** [Query from a controller](/packages/db/guide#query-from-a-controller).
- **A bad connection string found on the first request.** [Validate DATABASE_URL at startup](/packages/db/guide#validate-database_url-at-startup).
- **Deploying code ahead of its migrations.** [Check migrations when the server starts](/packages/db/guide#check-migrations-when-the-server-starts).
- **Connections left open on shutdown.** [Close the connection on shutdown](/packages/db/guide#close-the-connection-on-shutdown).

## Further reading

- [Guide](/packages/db/guide).
- [API reference](/packages/db/api).
- [Drizzle ORM docs](https://orm.drizzle.team/docs/overview).
- [API routes](/packages/api) and [Actions](/packages/actions).
- [Server](/packages/server).
