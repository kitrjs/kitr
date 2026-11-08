---
title: Project structure
description: Where every kind of file in a kitr app lives, what it is called, and the command that writes it.
---

# Project structure

A kitr app has one place for each kind of file. A controller is always in `server/controllers/`, a layout always in `app/layouts/`, a hook always in `app/hooks/`. This page is that list, with the naming rules and the `kitr make` command for each kind, so you never have to decide where something goes.

The one rule behind it: code that imports React lives in `app/`; code that imports `@kitr/api`, `@kitr/server`, `@kitr/jobs`, `@kitr/mail` or Node lives in `server/`; a declaration both sides read (a zod schema, an error class, a realtime channel) lives in `app/` next to its kind.

## The tree

A `fullstack` app, with every folder a package can bring:

```
my-app/
├── kitrrc.ts                 # packages, providers, platforms: the one place wiring is declared
├── config/<package>.ts       # one options file per package (config/api.ts, config/jobs.ts, ...)
├── app/                      # the application: bundled by Vite, runs in the browser and in Start
│   ├── app.ts                # createApp(): providers, config and env
│   ├── env.ts                # environment variables, validated at startup
│   ├── routes.ts             # the page table: every .page() and .layout(), with loaders and guards
│   ├── router.tsx            # creates the router from app/routes.ts
│   ├── document.tsx          # the HTML document around every page
│   ├── api/                  # client.ts, the typed client for server/routes.ts
│   ├── pages/                # one component per route; the file path is the URL path
│   ├── layouts/              # components that wrap a group of pages through <Outlet />
│   ├── components/           # reusable React: ui/ (copied by kitr ui add), forms/, <feature>/
│   ├── hooks/                # use-*.ts
│   ├── stores/               # client-only state
│   ├── queries/              # typed queries and mutations, one file per resource
│   ├── actions/<feature>/    # server functions the client calls by name
│   ├── validators/           # zod schemas shared by forms, actions and controllers
│   ├── exceptions/           # KitrError subclasses
│   ├── providers/            # your own lifecycle providers
│   ├── channels/             # realtime channel definitions
│   ├── lib/                  # plain functions and constants that are none of the above
│   ├── locales/              # translation bundles, one per language
│   ├── content/              # static content modules a site renders
│   ├── mocks/                # MSW handlers for development without a backend
│   └── styles/               # app.css and tokens
├── server/                   # the standalone server: Node, never React
│   ├── main.ts               # createServer({ providers, config, routes })
│   ├── routes.ts             # endpoints and sockets: .get, .post, .resource, .ws
│   ├── controllers/          # classes whose methods answer routes
│   ├── services/             # plain classes with business logic, bound in the container
│   ├── middleware/           # defineMiddleware around controllers
│   ├── jobs/                 # background work
│   ├── mail/                 # email templates
│   └── db/                   # schema, migrations and seeders, owned by your ORM
├── platforms/<name>/         # native shells, when a desktop or mobile platform is added
├── test/                     # app-level tests; unit tests may sit beside their file
├── stubs/                    # generator templates you ejected (kitr eject stub <kind>)
├── .kitr/                    # generated types (kitr types); import them from #kitr/*
└── AGENTS.md                 # these rules for coding agents, kept current by kitr add
```

No project starts with all of it. A `blank` project is `kitrrc.ts`, `package.json`, `tsconfig.json`, `biome.json`, `.env.example`, `.gitignore` and `AGENTS.md`; every folder arrives with the package or the generator that needs it. Run `kitr make` in your project to see the kinds it has, with the path each one writes:

```sh
kitr make
#   make:query       app/actions/<feature>/<name>.ts          A server function the client reads by name
#   make:component   app/components/<name>.tsx                A reusable piece of UI with no route of its own.
#   make:layout      app/layouts/<name>.tsx                   A component that wraps a group of pages through <Outlet />
#   make:controller  server/controllers/<name>-controller.ts  A class whose methods answer routes
#   ...
```

## The three files that wire everything

**`kitrrc.ts`** lists the kitr packages in the project and their providers. Nothing is discovered by magic: if a package affects your app at startup, it's in this list.

**`config/<package>.ts`** holds one package's options, typed by that package's `defineConfig`. `config/query.ts` configures [Query](/packages/query), `config/http.ts` configures [HTTP](/packages/http), and so on.

**`app/env.ts`** declares your environment variables. Public ones (prefixed `VITE_`) reach the browser; server ones throw if browser code reads them. A missing or malformed variable stops the app at startup with a clear message, not halfway through a request.

## app and server

`app/` is everything Vite bundles. It runs in the browser, and with a web platform in `ssr` or `static` mode it also runs in TanStack Start on the server. Server functions in `app/actions/` live here too: the client imports them by name, and Start runs their handlers on the server.

`server/` is the standalone server that `kitr dev api` runs (`server/main.ts`). It never imports React, so it starts fast and its bundle has no client code. It imports from `app/` freely: a controller validates with `#app/validators/orders`, throws `#app/exceptions/payment-failed-error`, publishes on `#app/channels/orders`.

A `server` app (no React at all) keeps the same split. Its `app/` holds only `env.ts` and the shared declarations, so a web or mobile platform can be added later without moving a file. See [Build an API server without React](/guides/api-server).

## Kinds

What each kind is, where it lives and what it exports. `<name>` is kebab-cased as typed: `kitr make:service BillingUsage` writes `billing-usage-service.ts`.

### In app/

| Kind | What it is | File | Export | Command |
| --- | --- | --- | --- | --- |
| page | The component a route renders; options (loader, guards, head) live on its link in `app/routes.ts`. | `app/pages/<path>.tsx` | `export default function ProjectsPage` | `make:page <path>` |
| layout | A pathless component that wraps a group of pages through `<Outlet />`; guards go on its route. | `app/layouts/<name>.tsx` | `export default function AdminLayout` | `make:layout <name>` |
| component | A reusable piece of UI with no route of its own. | `app/components/<name>.tsx` | `export function ProjectCard` | `make:component <name>` |
| form | A component that owns one schema-validated form and its submit. | `app/components/forms/<name>-form.tsx` | `export function ProjectForm` | `make:form <name>` |
| hook | A `use*` function that packages React state or effects for reuse. | `app/hooks/use-<name>.ts` | `export function useDisclosure` | `make:hook <name>` |
| store | Client-only state. Server data belongs in queries, never here. | `app/stores/<name>.ts` | `[useCartStore, CartStoreProvider, cartStore]` | `make:store <name>` |
| queries | Typed queries and mutations for one HTTP resource, with their cache keys. | `app/queries/<resource>.ts` | `projectsKeys`, `projectsListQuery`, `updateProjects` | `make:queries <resource>` |
| query, mutation | A server function the client calls by name (`useQuery('projects.list')`). | `app/actions/<feature>/<name>.ts` | `export const list = defineQuery(...)` | `make:query <feature>/<name>`, `make:mutation` |
| validator | A zod schema and its type, shared by a form, an action and a controller. | `app/validators/<name>.ts` | `projectSchema`, `createProjectSchema`, `ProjectInput` | `make:validator <name>` |
| exception | A `KitrError` subclass with a code, turned into a typed error on every transport. | `app/exceptions/<name>-error.ts` | `export class PaymentFailedError` | `make:exception <name>` |
| provider | A lifecycle object: `register` bindings, `boot`, `wrap` the React tree. Listed in `kitrrc.ts`. | `app/providers/<name>-provider.ts` | `export default defineProvider(...)` | `make:provider <name>` |
| channel | A realtime channel: params, events with cache effects, and who may join. | `app/channels/<name>.ts` | `export const chatChannel` | `make:channel <name>` |
| lib | Plain functions and constants: formatting, calculations, glue. | `app/lib/<name>.ts` | named exports | none |
| locale | A translation bundle; the keys are typed from `en`. | `app/locales/<lang>.ts` | `export default { ... }` | none |

### In server/ and test/

| Kind | What it is | File | Export | Command |
| --- | --- | --- | --- | --- |
| controller | A class whose methods answer routes; validation goes in `static validation`. | `server/controllers/<name>-controller.ts` | `export default class UsersController` | `make:controller <name> [--resource]` |
| service | A plain class holding business logic, bound in the container by a provider. | `server/services/<name>-service.ts` | `export class BillingService` | `make:service <name>` |
| middleware | A function that runs before and after a controller: auth, audit, rate limits. | `server/middleware/<name>.ts` | `export const audit = defineMiddleware(...)` | `make:middleware <name>` |
| job | A background unit of work with a payload schema, retries and an optional schedule. | `server/jobs/<name>.ts` | `export const sendReceipt = defineJob(...)` | `make:job <name>` |
| mail | A React email template with its subject and preview props. | `server/mail/<name>.tsx` | `export const welcomeMail = defineMail(...)` | `make:mail <name>` |
| model, migration, seeder | Your ORM's own files. kitr connects the ORM (`config/db.ts`) and stays out of its folder. | `server/db/` | the ORM's | the ORM's CLI |
| test | A Vitest file. App-level tests go in `test/`; a unit test may sit beside its file as `<name>.test.ts`. | `test/<name>.test.ts` | | `make:test <name>` |

Packages add kinds when you add them: `make:job` exists once `kitr add jobs` has run, `make:channel` once `kitr add realtime` has. `kitr make` lists what your project has.

## Naming

- **Files are kebab-case**, on both sides: `order-summary.tsx`, `send-receipt.ts`, `health-controller.ts`. It matches the components `kitr ui add` copies and the URLs pages map to.
- **A file carries the kind's suffix exactly when its export does.** `UsersController` lives in `users-controller.ts`, `BillingService` in `billing-service.ts`, `PaymentFailedError` in `payment-failed-error.ts`, `FlagsProvider` in `flags-provider.ts`, `ProjectForm` in `project-form.tsx`. A file whose one export comes from `define*()` has no suffix, because the folder already names the kind: `server/jobs/send-receipt.ts`, `server/mail/welcome.tsx`.
- **Pages are named by their URL.** `/projects/$id` is `app/pages/projects/id.tsx`, even though the component inside is `ProjectsIdPage`.
- **Exports follow what they are.** Classes and components are PascalCase; `define*()` results, schemas and functions are camelCase; hooks start with `use`. Controllers and pages are the only default exports, because routes import them lazily.

## Group by feature inside a kind

A kind folder is flat until it gets crowded. Then give the file a feature folder by typing a nested name:

```sh
kitr make:controller admin/users     # server/controllers/admin/users-controller.ts
kitr make:component projects/card    # app/components/projects/card.tsx
kitr make:query projects/list        # app/actions/projects/list.ts
kitr make:layout settings            # app/layouts/settings.tsx
```

The same `projects/` folder in each kind is the feature. A feature never gets its own top-level folder with every kind mixed inside: a reader looking for a hook looks in `app/hooks/`, always.

## Imports

Five aliases reach every top-level folder, in TypeScript, in Vite and in Node (they are [subpath imports](https://nodejs.org/api/packages.html#subpath-imports) in `package.json`):

| Alias | Folder |
| --- | --- |
| `#app/*` | `app/` |
| `#components/*` | `app/components/` |
| `#server/*` | `server/` |
| `#config/*` | `config/` |
| `#kitr/*` | `.kitr/` (generated) |

Import across folders with an alias (`#app/validators/orders`) and inside one folder with a relative path (`./order-row`). Never `../` across folders: the alias says where the file lives.

## Generators

`kitr make:<kind> <name>` writes one file from a template and, where the kind is registered somewhere, registers it: `make:page` and `make:layout` add their link to `app/routes.ts`, `make:provider` adds the provider to `kitrrc.ts`, and `make:controller` prints the route line to paste into `server/routes.ts`.

| Flag | Effect |
| --- | --- |
| `--dry-run` | Prints what it would write and register; writes nothing. |
| `--force` | Overwrites an existing file. |
| `--resource` | `make:controller` only: `index`, `show`, `store`, `update` and `destroy` with zod validation. |

`kitr eject stub <kind>` copies a template to `stubs/<kind>.ts`; every `make:<kind>` after that uses your copy. `kitr make --json` prints the list for scripts and agents. The full command list is in the [CLI reference](/docs/cli#generators).

## Tests

App-level tests (boot the app, call the API, run a flow) go in `test/`, where the kits' Vitest config and `tsconfig.json` already look. A unit test may sit beside the file it tests instead: `app/components/orders/order-row.test.tsx`. `kitr make:test <name>` writes the first kind. See [Testing](/guides/testing).
