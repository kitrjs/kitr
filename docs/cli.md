# CLI

`kitr` is installed with the `kitr` package (`pnpm add kitr`) and run as `pnpm kitr <command>` or `pnpm dlx kitr <command>`. Install it globally (`pnpm add -g kitr`) to type `kitr add ...` directly: inside a project that has its own `kitr`, the global binary hands over to that copy, so the version in `package.json` is always the one that edits your files (`KITR_GLOBAL=1` skips the handover). Every command runs from flags alone; nothing prompts.

## Project commands

| Command | What it does |
| --- | --- |
| `kitr new <dir> --kit <kit>` | Create a project. Base kits: `blank` (the wiring files only: no platform, no React, no server, no Vite; `kitr add <platform> <name>` brings each), `app`, `fullstack`, `server`. Presets with real pages, controllers and tests: `saas` (sign-in, guarded app shell, projects CRUD, analytics, monitoring), `site` (SSR + prerender, SEO, i18n en/de, blog, newsletter controller), `realtime` (chat over typed channels), `desktop` (the app kit in an Electron shell with typed IPC), `tauri` (the same in a Tauri shell with typed Rust commands), `mobile` (the app kit as a PWA and a Capacitor shell). `--platform site=web,api=server` replaces the kit's platforms; `--mode`, `--pwa`, `--runtime`, `--targets`, `--port` set their options. Every kit but `blank` is a package (`@kitr/kit-saas`); `--kit @acme/starter` runs a kit from any npm package. See [kits.md](kits.md). `--pm`, `--no-install`, `--no-git`, `--registry <url\|path>`, `--force`. It also writes `.vscode/extensions.json` recommending the kitr VS Code extension (`kitrjs.kitr`) when the project has none; `--no-vscode` skips it. |
| `kitr add <pkg...>` | Install the package(s), ask each one's questions (every question is a flag: `kitr add jobs --no-worker`; `--yes` takes the defaults), register providers in `kitrrc.ts`, write `config/<pkg>.ts` and stubs, update `AGENTS.md`. Follows `requires` (adding `api` adds `server` and `logger`; adding `router` adds `react`). Any npm package that ships a kitr setup module works (`kitr add @acme/stripe`); see [package-contract.md](package-contract.md). `kitr add <pkg> --help` prints its questions. `--dry-run`, `--no-install`. |
| `kitr <pkg>:<cmd>` | Commands the installed packages contribute (`kitr jobs:list`, `kitr jobs:work`). `kitr --help` lists them after the core commands. |
| `kitr add <type> <name> [--option value]` | Adds a platform (`web`, `server`, `desktop`, `tauri`, `mobile`): `kitr add web admin --mode spa`, `kitr add desktop app --title Acme`. Installs the platform package and the packages it needs, writes `platforms.<name>` into `kitrrc.ts`, scaffolds `platforms/<name>/` for native shells and adds the `dev`/`build`/`start` scripts. See [platforms.md](platforms.md). |
| `kitr remove <pkg...>` | Reverse of `add`: unregisters the provider and package, deletes `config/<pkg>.ts`, removes dependencies, then lists files that still import it. |
| `kitr doctor` | Checks `kitrrc.ts` against `package.json`, providers that resolve, missing config files, direct upstream imports where an `@kitr/*` package re-exports them, server-only projects that pull React, version drift from the tested set. `--json`, `--strict`. Exit code 1 on errors. |
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

## Workspaces

A monorepo with several kitr apps (an authed web app, a marketing site, a phone app) puts a `kitr.workspace.ts` at its root:

```ts
// kitr.workspace.ts
import { defineWorkspace } from 'kitr'

export default defineWorkspace({
  apps: { www: 'apps/www', app: 'apps/app', phone: 'apps/phone' },
})
```

Each app is a complete kitr project with its own `kitrrc.ts`; shared code is ordinary workspace packages. The CLI reads the file statically, like `kitrrc.ts`.

| Command | What it does |
| --- | --- |
| `kitr workspace [--json]` | Lists the apps with their platforms and packages. |
| `kitr dev` / `kitr start` (at the root) | Runs the command in every app side by side. |
| `kitr build` / `kitr types` / `kitr doctor` / `kitr platforms` / `kitr info` (at the root) | Runs the command in every app, one after another. Exit code 1 when any fails. |
| `kitr build phone` | An app name as a word selects that app; the rest of the words are passed on (`kitr build phone ios` builds the `ios` platform of the `phone` app). |
| `kitr --app phone add jobs` | Runs any command inside one app without `cd`. `KITR_APP=phone` does the same. |

Inside an app directory every command is the app's own, as if there were no workspace.

## Generators

Every kind of file has one home; [Project structure](/docs/project-structure) explains them. `kitr make` lists the generators your project has, with the path each one writes (`--json` for scripts and agents). `kitr make:<kind> <name>` writes one file from a stub and registers it where the kind is registered. A nested name puts the file in a feature folder inside the kind's home: `make:controller admin/users` writes `server/controllers/admin/users-controller.ts`. File names are kebab-case whatever you type.

`--dry-run` prints what would be written and changed, `--force` overwrites an existing file, and a mistyped kind (`make:controler`) names the one you meant. Stubs can be customised per project: `kitr eject stub <kind>` copies it to `stubs/<kind>.ts`, and `make:*` prefers the ejected version.

| Command | Writes |
| --- | --- |
| `make` | Nothing: lists every generator, its owner, the path it writes and what the kind is |
| `make:page projects` | `app/pages/projects.tsx`, and `.page('/projects', { lazy })` appended to `app/routes.ts` |
| `make:page projects/:id` | `app/pages/projects/id.tsx`, and `.page('/projects/$id', { lazy })` |
| `make:layout admin` | `app/layouts/admin.tsx` with `<Outlet />`, and `.layout('_admin', { lazy }, (admin) => admin)` appended to `app/routes.ts` |
| `make:component user-card` | `app/components/user-card.tsx` |
| `make:form project` | `app/components/forms/project-form.tsx` |
| `make:hook toggle` | `app/hooks/use-toggle.ts` |
| `make:store cart` | `app/stores/cart.ts` (`createKitrStore`) |
| `make:queries projects` | `app/queries/projects.ts` (keys, queries, mutation with effects) |
| `make:query projects/list` | `app/actions/projects/list.ts` (`defineQuery('projects.list', ...)`) |
| `make:mutation projects/create` | `app/actions/projects/create.ts` (`defineMutation('projects.create', ...)`) |
| `make:validator project` | `app/validators/project.ts` (create/update zod schemas) |
| `make:exception payment-failed` | `app/exceptions/payment-failed-error.ts` (a `KitrError` subclass) |
| `make:provider analytics` | `app/providers/analytics-provider.ts`, listed in `kitrrc.ts` `providers` |
| `make:channel chat` | `app/channels/chat.ts` (`defineChannel`) |
| `make:controller projects [--resource]` | `server/controllers/projects-controller.ts` (index/show/store/update/destroy with `--resource`); prints the route line for `server/routes.ts` |
| `make:service billing` | `server/services/billing-service.ts` (a class to bind in a provider) |
| `make:middleware audit` | `server/middleware/audit.ts` |
| `make:job send-digest` | `server/jobs/send-digest.ts` (`defineJob` with a schema and retries; list it in `config/jobs.ts`). Contributed by the `jobs` package: present once it is added |
| `make:mail welcome` | `server/mail/welcome.tsx` (`defineMail` with a preview) |
| `make:test projects` | `test/projects.test.ts`, run by the project's vitest (`createTestApp`) |

A package adds a generator with a `generators` entry in its `kitr.ts`; `generatorFile(project, 'server', 'controllers', name, { suffix: '-controller' })` from `@kitr/core/package` gives it the same naming and nesting as the core ones. See [Building packages](/docs/building-packages).

## Components

| Command | What it does |
| --- | --- |
| `kitr ui add <name...>` | Copies components from a shadcn-compatible registry into `app/components/ui` (and pages into `app/pages`), resolving `registryDependencies` and installing npm dependencies. `--registry`, `--overwrite`. |
| `kitr ui list` | Lists the registry's items. |

The default registry is kitr's own (`registry/dist` in this repo). Point `--registry`, `config/theme.ts` or `KITR_REGISTRY` at any other shadcn-format registry, including a local folder.

## API and server

| Command | What it does |
| --- | --- |
| `kitr api:sync` | Loads the routes file (`server/routes.ts`), writes `openapi.json` (OpenAPI 3.1; schemas from zod, valibot or arktype when present) and `routes.gen.ts`, a plain route table for clients that cannot import the server. `--file`, `--out`. |
| `kitr routes:list` | Prints the route table: method, path, name. |
| `kitr css:types` | Writes a `.d.ts` beside every `*.module.css`. `--check` fails when stale. |

## Type generation

`kitr types` writes the project's generated types under `.kitr/`, a folder that is ignored by git, included in `tsconfig.json` and reachable as `#kitr/*`. `kitr dev` and `kitr build` run it first, the Vite plugin reruns the generator whose files changed while the dev server runs, `kitr new` and `kitr add` run it after installing, and the kits' `typecheck` script is `kitr types && tsc --noEmit`.

| Command | What it does |
| --- | --- |
| `kitr types` | Runs every generator and writes the files whose content changed. |
| `kitr types --check` | Lists stale files and exits non-zero instead of writing. For CI. |
| `kitr types --watch` | Keeps running and regenerates on change, for editors without the dev server. |
| `kitr types --only actions` | Runs one generator by name. |

| Generator | From | Writes |
| --- | --- | --- |
| `platforms` (built in) | `platforms` in `kitrrc.ts` | `.kitr/platforms.d.ts`: the `KitrPlatforms` augmentation, so `app.platform` and `usePlatform().name` are the project's names. |
| `actions` (`@kitr/actions`) | `app/actions/**/*.ts` | `.kitr/actions.ts`: `operations` and `actions` maps and the `Operations` augmentation behind `useQuery('projects.list')`. |

A package adds a generator with `defineTypes()` and points its setup module at it with the `types` hook (`types: () => import('./types')` in `src/kitr.ts`). A package without a setup module can still name the subpath in its manifest (`"kitr": { "types": "./types" }`), which the runner falls back to:

```ts
// packages/<name>/src/types.ts
import { defineTypes } from '@kitr/core'

export default defineTypes({
  name: 'channels',
  watch: (rc) => [`${rc.directories.app ?? 'app'}/channels/**/*.ts`],
  generate: (ctx) => [{ file: 'channels.d.ts', content: render(ctx.glob('app/channels', '**/*.ts')) }],
})
```

```ts
// packages/<name>/src/kitr.ts
import { definePackage } from '@kitr/core/package'

export default definePackage({
  name: 'channels',
  add(ctx) {
    ctx.types.enable()
  },
  types: () => import('./types'),
})
```

`generate` is pure: it returns `{ file, content }` pairs relative to `.kitr/` and the runner writes them. `watch` says which files re-run it in dev. `kitr doctor` warns when `.kitr/` is stale.

## Leaving kitr

`kitr eject stubs` copies every generator stub. `kitr eject all` also prints the import rewrites that remove kitr entirely: each `@kitr/*` import maps to the upstream package it re-exports.
