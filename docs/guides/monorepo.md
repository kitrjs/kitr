---
title: Keep several apps in one repository
description: A pnpm workspace with a web app, an API server, a shared package of schemas and types, and a private kitr package, all checked and tested together.
packages: web, server, api, http, query
platforms: web, server
time: 35 min
---

# Keep several apps in one repository

A product rarely stays one app. Acme starts with a web app and an API, then adds an admin panel, then a marketing site, and the order type is now copied into four folders that slowly stop agreeing. A monorepo keeps them in one repository with one install, so a shared schema is a package every app imports and a change to it is one pull request that the type checker follows into every app.

kitr does not need a special monorepo mode. Each app is an ordinary kitr project in its own folder, and [pnpm workspaces](https://pnpm.io/workspaces) link them. You will build `acme`: a web app in `apps/web`, an API server in `apps/api`, a `@acme/contracts` package with the order schema and types both use, and a private kitr package, `@acme/slack`, that `kitr add` wires into the API without publishing it anywhere.

## Before you start

You need [Node.js](https://nodejs.org) 22 or newer, [pnpm](https://pnpm.io/installation) 10 and the kitr CLI (`npm install -g kitr`). The guide uses pnpm because its workspaces link packages without copying them; npm, Yarn and Bun workspaces work the same way with their own commands.

## Create the workspace

Make the root folder and tell pnpm where the packages live:

```sh
mkdir acme && cd acme
git init
```

```yaml
# pnpm-workspace.yaml
packages:
  - apps/*
  - packages/*
```

```json
{
  "name": "acme",
  "private": true,
  "scripts": {
    "dev": "pnpm --parallel --filter \"./apps/*\" dev",
    "build": "pnpm --recursive build",
    "typecheck": "pnpm --recursive typecheck",
    "test": "pnpm --recursive test"
  }
}
```

The root `package.json` holds no code, only scripts that run each app's own script. `--parallel` keeps both dev servers running side by side; `--recursive` runs in dependency order, so `@acme/contracts` is checked before the apps that import it.

## Add the apps

Create each app inside the workspace. `--no-git` because the repository already exists at the root, and `--no-install` because one `pnpm install` at the root installs everything at once:

```sh
kitr new apps/web --kit app --pm pnpm --no-git --no-install
kitr new apps/api --kit server --pm pnpm --no-git --no-install
pnpm install
```

```
acme/
├── apps/
│   ├── web/                # the app kit: a SPA on port 3000 (two pages, Query, Tailwind)
│   │   ├── app/
│   │   ├── config/
│   │   └── kitrrc.ts       # platforms: { site: web({ mode: 'spa' }) }
│   └── api/                # the server kit: h3 on port 3001, no React
│       ├── server/
│       ├── config/
│       └── kitrrc.ts       # platforms: { api: server() }
├── packages/               # shared code, next section
├── package.json
├── pnpm-lock.yaml          # one lockfile for every app
└── pnpm-workspace.yaml
```

Each app keeps its own `kitrrc.ts`, `config/`, `AGENTS.md` and `node_modules`. Run kitr commands from inside the app they change:

```sh
cd apps/api && kitr make:controller orders --resource
```

From the root, `pnpm dev` starts both: the web app on `http://localhost:3000` and the API on `http://localhost:3001`. To run one, use pnpm's filter with the app's package name: `pnpm --filter api dev`.

Rename the apps' packages so the filters and imports read well. Set `"name": "@acme/web"` in `apps/web/package.json` and `"name": "@acme/api"` in `apps/api/package.json`.

## Run kitr from the root

pnpm's filters run package scripts. For kitr's own commands, a `kitr.workspace.ts` at the root names the apps, and the CLI then works from the root as well as from inside each app:

```ts
// kitr.workspace.ts
import { defineWorkspace } from 'kitr'

export default defineWorkspace({
  apps: { web: 'apps/web', api: 'apps/api' },
})
```

The CLI reads the file without running it, the same way it reads `kitrrc.ts`, so the names are plain strings. At the root:

| Command | What it does |
| --- | --- |
| `kitr workspace` | Lists the apps with their platforms and packages. |
| `kitr dev` | Starts every app side by side: the web app on port 3000, the API on 3001. |
| `kitr build`, `kitr types`, `kitr doctor` | Runs in each app, one after another, and stops at the first that fails. |
| `kitr build api` | An app name selects that app: this builds the API only. `--filter=api,web` picks several. |
| `kitr --app api make:controller invoices --resource` | Runs any command inside one app without `cd`. |

Inside `apps/web` or `apps/api` every command is that app's own, as if there were no workspace. Flags pass through, so `kitr doctor --strict` at the root checks both apps.

## Share schemas and types

Put what both sides agree on into a package of its own: the shape of an order, the schema that validates a new one, and the routes' response types. Neither app owns it, so neither can change it without the other noticing:

```json
{
  "name": "@acme/contracts",
  "private": true,
  "type": "module",
  "exports": {
    "./*": "./src/*.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^4.6.7"
  },
  "devDependencies": {
    "typescript": "^5.9.3"
  }
}
```

```ts
// packages/contracts/src/orders.ts
import { z } from 'zod'

export const newOrderSchema = z.object({
  customer: z.string().trim().min(2, 'Name the customer'),
  total: z.number().positive('The total must be more than zero'),
})

export type NewOrder = z.output<typeof newOrderSchema>

export interface Order extends NewOrder {
  id: string
  status: 'open' | 'paid' | 'refunded'
  placedAt: string
}

export interface OrdersPage {
  rows: Order[]
  total: number
}
```

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

The package exports its TypeScript source directly (`"./*": "./src/*.ts"`), so there is no build step: Vite compiles it for the web app and `tsx` for the API, as if the files were in the app. Inside the package, import with relative paths (`./orders`), never with an app's `#app/*` alias, which means something different in each app.

Add it to both apps:

```sh
pnpm --filter @acme/web --filter @acme/api add @acme/contracts@workspace:*
```

`workspace:*` links the package from `packages/contracts`. A change there reaches both apps on the next reload, with no publish and no reinstall.

## Use the contracts in the API

The API validates request bodies with the shared schema, so the rules the form checks in the browser are the rules the server enforces:

```ts
// apps/api/server/controllers/orders-controller.ts
import { type NewOrder, newOrderSchema, type Order } from '@acme/contracts/orders'
import type { HttpContext } from '@kitr/api'

const orders = new Map<string, Order>()

export default class OrdersController {
  static validation = { store: { body: newOrderSchema } }

  async index() {
    const rows = [...orders.values()]
    return { rows, total: rows.length }
  }

  async store({ body, response }: HttpContext<{}, {}, NewOrder>) {
    const order: Order = { ...body, id: `ord_${orders.size + 1}`, status: 'open', placedAt: new Date().toISOString() }
    orders.set(order.id, order)
    response.status(201)
    return order
  }
}
```

The browser runs on another origin in development (`localhost:3000` calling `localhost:3001`), so allow it in the routes:

```ts
// apps/api/server/routes.ts
import { cors } from '@kitr/api'
import { defineRoutes } from 'kitr/app'
import api from '@kitr/api/routes'
import OrdersController from '#server/controllers/orders-controller'

export const routes = defineRoutes([api], (router) =>
  router.group({ prefix: '/api', middleware: [cors({ origin: ['http://localhost:3000', 'https://app.acme.com'] })] }, (r) =>
    r.get('/health', () => ({ ok: true }), { name: 'health' }).resource('orders', OrdersController),
  ),
)

export type ServerRoutes = typeof routes.$types
```

`curl -X POST localhost:3001/api/orders -H 'content-type: application/json' -d '{"customer":"G","total":-1}'` answers `422` with `fieldErrors` for both fields, worded by the shared schema.

## Use the contracts in the web app

Point the web app at the API, and type its requests with the same `Order`:

```sh
# apps/web/.env
VITE_API_URL=http://localhost:3001/api
```

```ts
// apps/web/app/queries/orders.ts
import type { NewOrder, Order, OrdersPage } from '@acme/contracts/orders'
import { createKeys } from 'kitr/app'
import { httpMutation, httpQuery } from '@kitr/http'
import { mutationFrom, queryFrom } from '@kitr/query'
import { app } from '#app/app'

const http = () => app.container.use('http')
export const orderKeys = createKeys('orders')

export const ordersQuery = queryFrom(
  httpQuery<void, OrdersPage>(http, { path: 'orders', key: () => orderKeys.lists() }),
)

export const createOrder = mutationFrom(
  httpMutation<NewOrder, Order>(http, { path: 'orders', effects: { invalidate: [orderKeys.lists()] } }),
)
```

The form uses `newOrderSchema` from the same import, so "Name the customer" appears under the field before the request is sent, and the server says the same if the browser is bypassed. Rename `customer` to `customerName` in `@acme/contracts` and `pnpm typecheck` fails in the controller, the query and the form, in one run.

> **Warning**
> Don't import types from `apps/api` into `apps/web`, such as `ServerRoutes` for the typed API client. Both apps map `#app/*` and `#server/*` to their own folders, and TypeScript applies the web app's mapping to every file it reads, including the API's. Types then resolve against the wrong files, or not at all. Share through a package with relative imports, as above.

## Add a private kitr package

A package in the workspace can be a full kitr package: a provider, a config file, `kitr add` support, commands and generators. Move the `@acme/slack` package from [Create a package](/guides/create-a-package) into `packages/slack`, and point its exports at the source so it needs no build either:

```json
{
  "name": "@acme/slack",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./provider": "./src/provider.ts",
    "./kitr": "./src/kitr.ts",
    "./package.json": "./package.json"
  },
  "peerDependencies": { "@kitr/core": ">=0.1.0" },
  "kitr": {
    "name": "slack",
    "title": "Slack",
    "summary": "Post messages to a Slack channel when something happens in your app.",
    "category": "backend",
    "runsOn": "server",
    "requires": ["server"],
    "setup": "./kitr"
  }
}
```

Install it into the API, then let kitr wire it:

```sh
pnpm --filter @acme/api add @acme/slack@workspace:*
cd apps/api && kitr add @acme/slack
```

The CLI finds `@acme/slack` in the API's `node_modules`, loads `@acme/slack/kitr` from its TypeScript source and runs it, exactly as for a package from npm: the provider goes into `kitrrc.ts`, `config/slack.ts` and the env variable are written, `AGENTS.md` gets its section, and `kitr slack:ping` works from `apps/api`. Every app in the company can add it the same way, and a fix to the package reaches all of them in one commit.

`"private": true` keeps `pnpm publish` from ever sending it to npm by mistake.

## Keep kitr versions together

Every app in the workspace should run the same kitr release, or a shared package that compiles against one app's `@kitr/core` types fails against another's. Upgrade every app in one pull request:

```sh
pnpm --filter "./apps/*" exec kitr upgrade
pnpm install
```

`kitr upgrade` moves `kitr` and every `@kitr/*` package in one app to one version and aligns the upstream libraries with the versions that release was tested with. Running it through the filter does it for each app. To pin shared versions in one place, list them in a [pnpm catalog](https://pnpm.io/catalogs) and reference `catalog:` from each app.

## Check and test everything

From the root, the scripts run each package's own:

```sh
pnpm typecheck
pnpm test
```

`pnpm typecheck` runs `kitr types && tsc --noEmit` in each app and `tsc --noEmit` in `@acme/contracts`. `pnpm test` runs each app's Vitest suite, which [Test your app](/guides/testing) builds out. Add `kitr doctor` from the root, which runs in each app, so a missing provider or a React import in the API fails CI:

```sh
kitr doctor --strict
```

In CI, run only what a change touched with pnpm's change filter: `pnpm --filter "...[origin/main]" test` tests the packages changed since `main` and everything that depends on them, so a change to `@acme/contracts` tests both apps and a change to the web app tests only the web app.

## Deploy each app on its own

The apps share a repository, not a release. Build and deploy each with its own pipeline, from the root:

```sh
pnpm --filter @acme/web build
pnpm --filter @acme/api build
```

For a container per app, [`pnpm deploy`](https://pnpm.io/cli/deploy) copies one app and everything it needs, workspace packages included, into a folder you can build an image from. pnpm 10 requires `inject-workspace-packages=true` in the root `.npmrc` for it:

```sh
pnpm --filter @acme/api deploy out/api
```

Leave off `--prod`: the API runs from its TypeScript source through `tsx`, a dev dependency. [Deploy to production](/guides/deploy) covers the Dockerfile, environment variables and migrations for each kind of app.

## Next steps

- [Create a package](/guides/create-a-package): the setup module, commands, generators and tests behind `@acme/slack`.
- [Build an API server without React](/guides/api-server): controllers, a database and auth for `apps/api`.
- [Build a dashboard](/guides/dashboard): tables, forms and sign-in for `apps/web`.
- [pnpm workspaces](https://pnpm.io/workspaces): filters, catalogs and `workspace:` versions.
