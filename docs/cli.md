# CLI

`kitr` is installed with the `kitr` package (`pnpm add kitr`) and run as `pnpm kitr <command>` or `pnpm dlx kitr <command>`. Install it globally (`pnpm add -g kitr`) to type `kitr add ...` directly: inside a project that has its own `kitr`, the global binary hands over to that copy, so the version in `package.json` is always the one that edits your files (`KITR_GLOBAL=1` skips the handover). Every command runs from flags alone; nothing prompts.

## Project commands

| Command | What it does |
| --- | --- |
| `kitr new <dir> --kit <kit>` | Create a project. Base kits: `blank`, `app`, `fullstack`, `server`. Presets with real pages, controllers and tests: `saas` (sign-in, guarded app shell, projects CRUD, analytics, monitoring), `site` (SSR + prerender, SEO, i18n en/de, blog, newsletter controller), `realtime` (chat over typed channels), `desktop` (the app kit in an Electron shell with typed IPC), `mobile` (the app kit as a PWA and a Capacitor shell). `--platform site=web,api=server` replaces the kit's platforms; `--mode`, `--pwa`, `--runtime`, `--shell`, `--targets`, `--port` set their options. `--pm`, `--no-install`, `--no-git`, `--registry <url\|path>`, `--force`. |
| `kitr add <pkg...>` | Install the package(s), register providers in `kitrrc.ts`, write `config/<pkg>.ts` and stubs, update `AGENTS.md`. Follows `requires` (adding `api` adds `server` and `logger`; adding `router` adds `react`). `--dry-run`, `--no-install`. |
| `kitr add <type> <name> [--option value]` | Adds a platform (`web`, `server`, `desktop`, `mobile`): `kitr add web admin --mode spa`, `kitr add desktop app --shell tauri`. Installs the platform package and the packages it needs, writes `platforms.<name>` into `kitrrc.ts`, scaffolds `platforms/<name>/` for native shells and adds the `dev`/`build`/`start` scripts. See [platforms.md](platforms.md). |
| `kitr remove <pkg...>` | Reverse of `add`: unregisters the provider and package, deletes `config/<pkg>.ts`, removes dependencies, then lists files that still import it. |
| `kitr doctor` | Checks `kitrrc.ts` against `package.json`, providers that resolve, missing config files, direct upstream imports where a `kitr/*` entry exists, server-only projects that pull React, version drift from the tested set. `--json`, `--strict`. Exit code 1 on errors. |
| `kitr info` | JSON summary: version, package manager, packages, providers, platforms, directories, server-only or not. |
| `kitr upgrade [--to x.y.z] [--majors]` | Moves `kitr` and every `@kitr/*` to one version and aligns upstream libraries with the versions that release was tested with. Major bumps are listed, not applied, unless `--majors`. |

## Platforms

| Command | What it does |
| --- | --- |
| `kitr dev [names...]` | Runs every platform in `kitrrc.ts`, or the named ones, in development: `kitr dev`, `kitr dev site api`, `kitr dev site --port 4000`. |
| `kitr build [names...]` | Production builds into `dist/<name>/`. |
| `kitr start [names...]` | Serves the builds (`kitr serve` is an alias). |
| `kitr platforms [types\|scaffold <name>\|remove <name>]` | Lists platforms and their effective options; lists the available types; rewrites a platform's scaffold; removes one from `kitrrc.ts`. |
| `kitr config <name> [option] [value] [--unset]` | Reads or sets one platform option in `kitrrc.ts`, validated against the platform's schema: `kitr config site port 4000`. `KITR_<NAME>_<OPTION>` overrides any option at run time. |

## Generators

`kitr make:<kind> <name>` writes one file from a stub. `--force` overwrites. Stubs can be customised per project: `kitr eject stub <kind>` copies it to `stubs/<kind>.ts`, and `make:*` prefers the ejected version.

| Command | Writes |
| --- | --- |
| `make:route projects/index` | `app/routes/projects/index.tsx` with route path `/projects/` |
| `make:route projects/:id` | `app/routes/projects/$id.tsx` |
| `make:action projects/create` | `app/actions/projects/create.ts` (`defineAction`) |
| `make:controller projects [--resource]` | `server/controllers/projects_controller.ts` (index/show/store/update/destroy with `--resource`) |
| `make:middleware audit` | `app/middleware/audit.ts` |
| `make:channel chat` | `app/channels/chat.ts` (`defineChannel`) |
| `make:store cart` | `app/stores/cart.ts` (`createKitrStore`) |
| `make:form project` | `app/components/forms/project_form.tsx` |
| `make:queries projects` | `app/features/projects/queries.ts` (keys, queries, mutation with effects) |
| `make:provider analytics` | `app/providers/analytics_provider.ts` |
| `make:job send_digest` | `server/jobs/send_digest.ts` (`defineJob` with a schema and retries) |
| `make:mail welcome` | `server/mail/welcome.tsx` (`defineMail` with a preview) |
| `make:service billing` | `server/services/billing_service.ts` (a class to bind in a provider) |
| `make:validator project` | `app/validators/project.ts` (create/update zod schemas) |
| `make:test projects` | `tests/projects.test.ts` (`createTestApp` + `createTestClient`) |
| `make:component user-card` | `app/components/user-card.tsx` |
| `make:hook toggle` | `app/hooks/use-toggle.ts` |
| `make:exception payment_failed` | `app/exceptions/payment_failed_error.ts` (a `KitrError` subclass) |

## Components

| Command | What it does |
| --- | --- |
| `kitr ui add <name...>` | Copies components from a shadcn-compatible registry into `app/components/ui` (and pages into `app/routes`), resolving `registryDependencies` and installing npm dependencies. `--registry`, `--overwrite`. |
| `kitr ui list` | Lists the registry's items. |

The default registry is kitr's own (`registry/dist` in this repo). Point `--registry`, `config/theme.ts` or `KITR_REGISTRY` at any other shadcn-format registry, including a local folder.

## API and server

| Command | What it does |
| --- | --- |
| `kitr api:sync` | Loads the routes file (`server/routes.ts`), writes `openapi.json` (OpenAPI 3.1; schemas from zod, valibot or arktype when present) and `routes.gen.ts`, a plain route table for clients that cannot import the server. `--file`, `--out`. |
| `kitr routes:list` | Prints the route table: method, path, name. |
| `kitr css:types` | Writes a `.d.ts` beside every `*.module.css`. `--check` fails when stale. |

## Leaving kitr

`kitr eject stubs` copies every generator stub. `kitr eject all` also prints the import rewrites that remove kitr entirely: each `kitr/*` entry maps to the upstream package it re-exports.
