# CLI

Run `kitr` with `pnpm kitr <command>`, or `pnpm dlx @kitr/kitr <command>` without installing. Every command runs from flags alone; nothing prompts.

A global install (`pnpm add -g @kitr/kitr`) lets you type `kitr` directly. Inside a project it hands over to the project's own copy, so the version in `package.json` is the one that edits your files. `KITR_GLOBAL=1` skips the handover.

## Project commands

| Command | What it does |
| --- | --- |
| `kitr new <dir> --kit <kit>` | Create a project from a kit: `kitr new my-app --kit app`. See [Create a project](#create-a-project). |
| `kitr add <pkg...>` | Install a package and wire it into the project: `kitr add jobs`. See [Add a package](#add-a-package). |
| `kitr add <type> <name>` | Add a platform: `kitr add web admin --mode spa`. See [Platforms](platforms.md). |
| `kitr remove <pkg...>` | Undo `add`, then list the files that still import the package. |
| `kitr <pkg>:<cmd>` | Run a command a package adds: `kitr jobs:work`. |
| `kitr doctor` | Check the project for problems. Exits 1 on errors. |
| `kitr info` | Print a JSON summary of the project. |
| `kitr upgrade` | Move every kitr package to one version: `kitr upgrade --to 0.2.0`. |

### Create a project

Kits: `blank`, `app`, `fullstack`, `server`, and the presets `saas`, `site`, `realtime`, `desktop`, `tauri` and `mobile`. [Kits](kits.md) shows what each one writes.

| Flag | What it does |
| --- | --- |
| `--kit <kit>` | The kit to start from. Any npm package that is a kit works: `--kit @acme/starter`. |
| `--platform <name=type,...>` | Replace the kit's platforms: `--platform site=web,api=server`. |
| `--mode`, `--pwa`, `--runtime`, `--targets`, `--port` | Set the platforms' options. |
| `--pm <npm\|pnpm\|yarn\|bun>` | The package manager to use. |
| `--no-install`, `--no-git` | Skip installing dependencies or creating a git repository. |
| `--registry <url\|path>` | Copy components from another registry. |
| `--force` | Write into a folder that is not empty. |

### Add a package

`kitr add` installs the package, registers its provider in `kitrrc.ts`, writes `config/<pkg>.ts` and updates `AGENTS.md`. It also adds the packages it needs: adding `api` adds `server` and `logger`.

Questions a package asks are flags: `kitr add jobs --no-worker`. `--yes` takes the defaults, and `kitr add <pkg> --help` lists the questions. `--dry-run` shows the changes without writing them.

Any npm package with a kitr setup module works: `kitr add @acme/stripe`. See [Package contract](package-contract.md).

### Check and upgrade

`kitr doctor` checks `kitrrc.ts` against `package.json`, missing config files, imports that should go through an `@kitr/*` package, and versions that drift from the tested set. `--json` prints the result for scripts; `--strict` turns warnings into errors.

`kitr upgrade` also moves upstream libraries to the versions that kitr release was tested with. It lists major bumps without applying them; `--majors` applies them.

## Platforms

| Command | What it does |
| --- | --- |
| `kitr dev [names...]` | Run every platform in development, or only the named ones: `kitr dev site`. |
| `kitr build [names...]` | Build for production into `dist/<name>/`. |
| `kitr start [names...]` | Serve the builds. `kitr serve` is an alias. |
| `kitr platforms` | List platforms, their options and the config files each build uses. `types`, `scaffold <name>` and `remove <name>` are subcommands. |
| `kitr config <name> [option] [value]` | Read or set one platform option: `kitr config site port 4000`, `kitr config admin without analytics,consent`. |

To pick a few, list them (`kitr build admin api`) or use `--filter=admin,api`. Both do the same thing.

With more than one platform, `kitr dev` prefixes each line with the platform's name (`[site]`). `KITR_<NAME>_<OPTION>` overrides any option at run time: `KITR_SITE_PORT=4000 kitr dev site`.

The server without Vite imports `config/index.ts`, which `kitr add` regenerates. When a platform has a `config/<platform>/` folder or a `without` list, that file picks the build's object with `forBuildPlatform()`; see [Config per platform](platforms.md#config-per-platform).

## Workspaces

A repository with several kitr apps lists them in `kitr.workspace.ts` at its root:

```ts
// kitr.workspace.ts
import { defineWorkspace } from '@kitr/kitr'

export default defineWorkspace({
  apps: { www: 'apps/www', app: 'apps/app', phone: 'apps/phone' },
})
```

Each app is a complete kitr project with its own `kitrrc.ts`. Shared code goes in ordinary workspace packages.

| Command | What it does |
| --- | --- |
| `kitr workspace` | List the apps with their platforms and packages. |
| `kitr dev`, `kitr start` | Run in every app at once. |
| `kitr build`, `kitr generate`, `kitr typecheck`, `kitr doctor`, ... | Run in every app, one after another. Exits 1 if any fails. |
| `kitr build phone` | Run in one app: `kitr build phone ios` builds its `ios` platform. `kitr build --filter=phone,www` runs in those two. |
| `kitr --app phone <command>` | Run any command in one app without `cd`. `KITR_APP=phone` does the same. |

Inside an app directory every command is the app's own, as if there were no workspace.

## Generators

`kitr make:<kind> <name>` writes one file and registers it where it belongs. `kitr make` lists the generators your project has.

A nested name makes a folder: `make:controller admin/users` writes `server/controllers/admin/users-controller.ts`. `--dry-run` shows what would change, and `--force` overwrites a file. To change a template, `kitr eject stub <kind>` copies it to `stubs/<kind>.ts`. [Project structure](/docs/project-structure) explains where each kind of file lives.

| Command | Writes |
| --- | --- |
| `make` | Nothing. Lists every generator and the path it writes. |
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
| `make:controller projects [--resource]` | `server/controllers/projects-controller.ts` (with all CRUD methods for `--resource`) |
| `make:service billing` | `server/services/billing-service.ts` (a class to bind in a provider) |
| `make:middleware audit` | `server/middleware/audit.ts` |
| `make:job send-digest` | `server/jobs/send-digest.ts` (`defineJob`). Needs the `jobs` package. |
| `make:mail welcome` | `server/mail/welcome.tsx` (`defineMail` with a preview) |
| `make:test projects` | `test/projects.test.ts`, run by the project's vitest (`createTestApp`) |

A package can add its own generators. See [Building packages](/docs/building-packages).

## Components

| Command | What it does |
| --- | --- |
| `kitr ui add <name...>` | Copy components into `app/components/ui`: `kitr ui add button card`. |
| `kitr ui list` | List the components in the registry. |

Components come from kitr's own registry. To use another shadcn-format registry, pass `--registry <url\|path>` or set `KITR_REGISTRY`.

## API and server

| Command | What it does |
| --- | --- |
| `kitr api:sync` | Write `openapi.json` and `routes.gen.ts` from `server/routes.ts`. `kitr generate` runs it for you. |
| `kitr routes:list` | Print every route: method, path, name. |
| `kitr css:types` | Write a `.d.ts` beside every `*.module.css`. |

## Type generation

`kitr generate` writes the project's generated files: types under `.kitr/` (ignored by git), each package's own files, such as the API route table, then the app's own steps from `generate` in `kitrrc.ts`. You rarely run it yourself: `kitr dev`, `kitr build`, `kitr new` and `kitr add` run it, and the dev server reruns it when a file changes.

| Command | What it does |
| --- | --- |
| `kitr generate` | Write every generated file. |
| `kitr generate --check` | Exit non-zero when a file is stale, without writing. Skips package and app steps. For CI. |
| `kitr generate --quiet` | Print only failures; an app step's output shows only when it fails. |
| `kitr generate --watch` | Regenerate on change, for editors without the dev server. |
| `kitr typecheck` | `kitr generate`, then `tsc --noEmit`. The kits' `typecheck` script. |
| `kitr types` | Write only the `.kitr/` types. Takes `--check`, `--watch` and `--only <name>`. |

| Generator | Reads | Writes |
| --- | --- | --- |
| `platforms` | `platforms` in `kitrrc.ts` | `.kitr/platforms.d.ts`, so `app.platform` has your platform names. |
| `actions` | `app/actions/**/*.ts` | `.kitr/actions.ts`, so `useQuery('projects.list')` is typed. |

### Add your own step

An app adds a step of its own, such as a content index, under `generate` in `kitrrc.ts`. `run` is a shell command or a function:

```ts
// kitrrc.ts
import { defineKitrConfig } from '@kitr/kitr/app'

export default defineKitrConfig({
  packages: [],
  providers: [],
  generate: [{ name: 'content', run: 'node scripts/content.mjs', watch: ['content/**/*.md'] }],
})
```

It runs after the type generators and the package steps, in `kitr generate`, `kitr dev`, `kitr build` and `kitr typecheck`, and `kitr doctor` lists it. [Add your own code](/docs/extending#run-your-own-generate-step) has the details.

### Add a type generator to a package

A package adds a generator with `defineTypes()` and points its setup module at it with the `types` hook:

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

`generate` returns `{ file, content }` pairs relative to `.kitr/`, and the runner writes them. `watch` lists the files that rerun it in dev.

## Leaving kitr

`kitr eject stubs` copies every generator template into your project. `kitr eject all` also prints the import rewrites that remove kitr: each `kitr/*` import maps to the library it re-exports.
