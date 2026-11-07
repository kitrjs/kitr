# CLI

`kitr` is installed with the `kitr` package (`pnpm add kitr`) and run as `pnpm kitr <command>` or `pnpm dlx kitr <command>`. Every command runs from flags alone; nothing prompts.

## Project commands

| Command | What it does |
| --- | --- |
| `kitr new <dir> --kit blank\|app\|fullstack\|server` | Create a project. `--pm`, `--no-install`, `--no-git`, `--registry <url\|path>`, `--force`. |
| `kitr add <pkg...>` | Install the package(s), register providers in `kitrrc.ts`, write `config/<pkg>.ts` and stubs, update `AGENTS.md`. Follows `requires` (adding `api` adds `server` and `logger`). `--dry-run`, `--no-install`. |
| `kitr remove <pkg...>` | Reverse of `add`: unregisters the provider and package, deletes `config/<pkg>.ts`, removes dependencies, then lists files that still import it. |
| `kitr doctor` | Checks `kitrrc.ts` against `package.json`, providers that resolve, missing config files, direct upstream imports where a `kitr/*` entry exists, server-only projects that pull React, version drift from the tested set. `--json`, `--strict`. Exit code 1 on errors. |
| `kitr info` | JSON summary: version, package manager, packages, providers, directories, server-only or not. |
| `kitr upgrade [--to x.y.z] [--majors]` | Moves `kitr` and every `@kitr/*` to one version and aligns upstream libraries with the versions that release was tested with. Major bumps are listed, not applied, unless `--majors`. |

## Generators

`kitr make:<kind> <name>` writes one file from a stub. `--force` overwrites. Stubs can be customised per project: `kitr eject stub <kind>` copies it to `stubs/<kind>.ts`, and `make:*` prefers the ejected version.

| Command | Writes |
| --- | --- |
| `make:route projects/index` | `app/routes/projects/index.tsx` with route path `/projects/` |
| `make:route projects/:id` | `app/routes/projects/$id.tsx` |
| `make:action projects/create` | `app/actions/projects/create.ts` (`defineAction`) |
| `make:controller projects [--resource]` | `app/controllers/projects_controller.ts` (index/show/store/update/destroy with `--resource`) |
| `make:middleware audit` | `app/middleware/audit.ts` |
| `make:channel chat` | `app/channels/chat.ts` (`defineChannel`) |
| `make:store cart` | `app/stores/cart.ts` (`createKitrStore`) |
| `make:form project` | `app/components/forms/project_form.tsx` |
| `make:queries projects` | `app/features/projects/queries.ts` (keys, queries, mutation with effects) |
| `make:provider analytics` | `app/providers/analytics_provider.ts` |

## Components

| Command | What it does |
| --- | --- |
| `kitr ui add <name...>` | Copies components from a shadcn-compatible registry into `app/components/ui` (and pages into `app/routes`), resolving `registryDependencies` and installing npm dependencies. `--registry`, `--overwrite`. |
| `kitr ui list` | Lists the registry's items. |

The default registry is kitr's own (`registry/dist` in this repo). Point `--registry`, `config/ui.ts` or `KITR_REGISTRY` at any other shadcn-format registry, including a local folder.

## API and server

| Command | What it does |
| --- | --- |
| `kitr api:sync` | Loads the routes file (`app/api/routes.ts` or `start/routes.ts`), writes `openapi.json` (OpenAPI 3.1; schemas from zod, valibot or arktype when present) and `routes.gen.ts`, a plain route table for clients that cannot import the server. `--file`, `--out`. |
| `kitr routes:list` | Prints the route table: method, path, name. |
| `kitr serve` | Serves a TanStack Start production build (`dist/server/server.js`) with srvx, adding `PORT`/`HOST` and WebSocket upgrades. Pure backends run `server.ts` directly instead. |
| `kitr css:types` | Writes a `.d.ts` beside every `*.module.css`. `--check` fails when stale. |

## Leaving kitr

`kitr eject stubs` copies every generator stub. `kitr eject all` also prints the import rewrites that remove kitr entirely: each `kitr/*` entry maps to the upstream package it re-exports.
