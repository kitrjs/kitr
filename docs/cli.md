# CLI

`kitr` is installed with the `kitr` package (`pnpm add kitr`) and run as `pnpm kitr <command>` or `pnpm dlx kitr <command>`. Install it globally (`pnpm add -g kitr`) to type `kitr add ...` directly: inside a project that has its own `kitr`, the global binary hands over to that copy, so the version in `package.json` is always the one that edits your files (`KITR_GLOBAL=1` skips the handover). Every command runs from flags alone; nothing prompts.

## Project commands

| Command | What it does |
| --- | --- |
| `kitr new <dir> --kit <kit>` | Create a project. Base kits: `blank` (the wiring files only: no platform, no React, no server, no Vite; `kitr add <platform> <name>` brings each), `app`, `fullstack`, `server`. Presets with real pages, controllers and tests: `saas` (sign-in, guarded app shell, projects CRUD, analytics, monitoring), `site` (SSR + prerender, SEO, i18n en/de, blog, newsletter controller), `realtime` (chat over typed channels), `desktop` (the app kit in an Electron shell with typed IPC), `tauri` (the same in a Tauri shell with typed Rust commands), `mobile` (the app kit as a PWA and a Capacitor shell). `--platform site=web,api=server` replaces the kit's platforms; `--mode`, `--pwa`, `--runtime`, `--targets`, `--port` set their options. Every kit but `blank` is a package (`@kitr/kit-saas`); `--kit @acme/starter` runs a kit from any npm package. See [kits.md](kits.md). `--pm`, `--no-install`, `--no-git`, `--registry <url\|path>`, `--force`. |
| `kitr add <pkg...>` | Install the package(s), ask each one's questions (every question is a flag: `kitr add jobs --no-worker`; `--yes` takes the defaults), register providers in `kitrrc.ts`, write `config/<pkg>.ts` and stubs, update `AGENTS.md`. Follows `requires` (adding `api` adds `server` and `logger`; adding `router` adds `react`). Any npm package that ships a kitr setup module works (`kitr add @acme/stripe`); see [package-contract.md](package-contract.md). `kitr add <pkg> --help` prints its questions. `--dry-run`, `--no-install`. |
| `kitr <pkg>:<cmd>` | Commands the installed packages contribute (`kitr jobs:list`, `kitr jobs:work`). `kitr --help` lists them after the core commands. |
| `kitr add <type> <name> [--option value]` | Adds a platform (`web`, `server`, `desktop`, `tauri`, `mobile`): `kitr add web admin --mode spa`, `kitr add desktop app --title Acme`. Installs the platform package and the packages it needs, writes `platforms.<name>` into `kitrrc.ts`, scaffolds `platforms/<name>/` for native shells and adds the `dev`/`build`/`start` scripts. See [platforms.md](platforms.md). |
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

`kitr make:<kind> <name>` writes one file from a stub. `--force` overwrites. Stubs can be customised per project: `kitr eject stub <kind>` copies it to `stubs/<kind>.ts`, and `make:*` prefers the ejected version.

| Command | Writes |
| --- | --- |
| `make:page projects` | `app/pages/projects.tsx`, and `.page('/projects', { lazy })` appended to `app/routes.ts` |
| `make:page projects/:id` | `app/pages/projects/id.tsx`, and `.page('/projects/$id', { lazy })` |
| `make:query projects/list` | `app/actions/projects/list.ts` (`defineQuery('projects.list', ...)`) |
| `make:mutation projects/create` | `app/actions/projects/create.ts` (`defineMutation('projects.create', ...)`) |
| `make:controller projects [--resource]` | `server/controllers/projects_controller.ts` (index/show/store/update/destroy with `--resource`) |
| `make:middleware audit` | `app/middleware/audit.ts` |
| `make:channel chat` | `app/channels/chat.ts` (`defineChannel`) |
| `make:store cart` | `app/stores/cart.ts` (`createKitrStore`) |
| `make:form project` | `app/components/forms/project_form.tsx` |
| `make:queries projects` | `app/features/projects/queries.ts` (keys, queries, mutation with effects) |
| `make:provider analytics` | `app/providers/analytics_provider.ts` |
| `make:job send_digest` | `server/jobs/send_digest.ts` (`defineJob` with a schema and retries; list it in `config/jobs.ts`). Contributed by the `jobs` package: present once it is added |
| `make:mail welcome` | `server/mail/welcome.tsx` (`defineMail` with a preview) |
| `make:service billing` | `server/services/billing_service.ts` (a class to bind in a provider) |
| `make:validator project` | `app/validators/project.ts` (create/update zod schemas) |
| `make:test projects` | `test/projects.test.ts`, run by the project's vitest (`createTestApp`) |
| `make:component user-card` | `app/components/user-card.tsx` |
| `make:hook toggle` | `app/hooks/use-toggle.ts` |
| `make:exception payment_failed` | `app/exceptions/payment_failed_error.ts` (a `KitrError` subclass) |

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

`kitr eject stubs` copies every generator stub. `kitr eject all` also prints the import rewrites that remove kitr entirely: each `kitr/*` entry maps to the upstream package it re-exports.

## CI and releases

`.github/workflows/ci.yml` builds once and fans out. The `build` job installs, builds every package, the component registry, the examples and the docs site, and uploads the result as one artifact. Every other Linux job downloads it and skips the build, then runs in parallel:

| Job | What it checks |
| --- | --- |
| `verify` | Generated manifests, READMEs and API pages, the docs rules, Biome, that the examples are unmodified kit output, the production bundle checks, and `pnpm versions:check`. |
| `typecheck` | `pnpm typecheck` across every package and example. |
| `unit` | `pnpm test:coverage` on Node 22 and 24, with a real Redis. |
| `integration` | `pnpm test:integration`: the CLI scaffolding every kit, generators, add and remove, the backend over the network. |
| `e2e` | Playwright against production and dev builds. |
| `registry-smoke` | `pnpm smoke:registry`, below. |
| `windows` | The CLI integration suite (`tests/integration/cli.test.ts`) on `windows-latest`. It builds for itself, since the artifact comes from Linux. |

### The registry smoke test

Nothing else in CI installs from a registry, so `scripts/verdaccio-smoke.mjs` does. It starts a throwaway [Verdaccio](https://verdaccio.org) (`scripts/verdaccio.yaml`), packs every public package under a prerelease version such as `0.1.0-smoke.1731000000000` and publishes them, then:

- checks that every peer of the `kitr` package, every dependency of every package, every library pinned in `packages/cli/src/versions.ts` and every `builtOn` library can be installed from the registry,
- installs the published `kitr` CLI, then runs `kitr new --kit app` and `--kit fullstack` against the registry, followed by `typecheck` and `build` in each project.

A peer that names a missing package or an unpublished version fails the run, and so does a setup module that adds one. Package files are bumped only while packing and restored afterwards, so versions and changesets stay as they are. On `main` the run adds `--all-packages`, which runs `kitr add` for every released package in one project.

Run it locally after `pnpm build` and `pnpm -C registry build`: `pnpm smoke:registry`. Options: `--kits app,saas`, `--all-packages`, `--skip-projects` (publish and resolve checks only), `--keep` (keep the scratch directory), `--port`.

### Upstream versions

`packages/cli/src/versions.ts` is the set of upstream versions `kitr new` writes and `kitr upgrade` moves to. `pnpm versions:check` fails when a workspace `package.json` declares a range that cannot overlap the one in that file, when the lockfile resolved a version outside it, or when the lockfile no longer matches a manifest. `renovate.json` groups those libraries into a few weekly pull requests (TanStack, Vite and Vitest, Biome and TypeScript, the server runtime, React, Zod and ky, Tailwind, the native shells) and opens each major on its own. The examples are generated, so on a Renovate pull request that changes `versions.ts` run `pnpm sync:examples` and commit the result.

### The nightly canary

`.github/workflows/canary.yml` runs every night and on demand. It checks out `main`, runs `pnpm update --latest --recursive`, builds and runs the unit tests. Nothing is pushed. On a failure it opens one issue, "Canary: upstream update breaks the build" (label `canary`), with the failing step, the tail of its log and the dependency diff. Later failures update that issue, and a green run closes it.

### Publishing

`release.yml` runs Changesets on `main`: it opens a "Version packages" pull request and publishes to npm when that is merged. It needs an `NPM_TOKEN` secret and does nothing without it.
