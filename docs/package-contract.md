# The package contract

A kitr package is an npm package with two additions:

- a `kitr` block in `package.json` that describes it, and
- a setup module exported as `<package>/kitr` that `kitr add`, `kitr remove`, `kitr doctor` and `kitr make:*` run.

Official and third-party packages work the same way: `kitr add @acme/anything` does what `kitr add jobs` does.

## The setup module

```ts
// src/kitr.ts, published as the "./kitr" export
import { definePackage } from '@kitr/core/package'

export default definePackage({
  name: 'jobs',
  requires: ['server'],

  // Asked by `kitr add jobs`. Every question is also a flag (`--worker` / `--no-worker`),
  // so CI and agents never see a prompt; `when` makes a question depend on earlier answers.
  questions: [
    { name: 'worker', type: 'confirm', message: 'Run the job worker inside the server process?', default: true },
  ],

  // Codemods. Every call is idempotent and queued: the CLI writes once, installs once, formats once.
  add(ctx) {
    ctx.provider.add('@kitr/jobs/provider')
    ctx.config('jobs', jobsConfig(ctx.answers.worker !== false))   // writes config/jobs.ts
    ctx.write('server/jobs/example.ts', exampleJob)                 // skipped when it exists
    if (ctx.answers.worker === false) ctx.scripts.add('worker', 'kitr jobs:work')
    ctx.agents.add('jobs', '- Background work is a job in server/jobs/*.ts ...')
  },
  remove(ctx) {
    ctx.provider.remove('@kitr/jobs/provider')
    ctx.scripts.remove('worker', 'kitr jobs:work')
    ctx.agents.remove('jobs')
  },

  commands: () => import('./commands'),       // `kitr jobs:list`, `kitr jobs:work`
  generators: { job: { description: 'A job with a schema, retries and a schedule', target, stub } },
  doctor: (project) => [],                    // extra `kitr doctor` findings
  vite: { serverOnlyConfig: true },           // config/jobs.ts never reaches a browser bundle
})
```

The CLI installs the package itself and lists it in `kitrrc.ts` `packages`; `add` only does what is specific to the package. The service a package exposes is a container binding, declared the way every kitr package already does it: augment `ContainerBindings` in `@kitr/core` and bind it in the provider's `register`.

| Field | Type | What the CLI does with it |
| --- | --- | --- |
| `name` | string | The short name: `kitr add jobs`, `config/jobs.ts`, the `jobs:` command prefix |
| `kind` | `'package'` (default), `'platform'`, `'kit'` | A platform is added as `kitr add web site`; a kit is used by `kitr new --kit` |
| `requires` | string[] | Added first, in order, each with its own questions. Short names or full package names |
| `client` | boolean | Refused in a project with no React |
| `dev` | boolean | Installed as a devDependency (tooling the app never imports at run time, such as `testing`) |
| `questions` | `Question[]` or `(project) => Question[]` | Asked on `add`; `--yes`, `CI` or no TTY takes the defaults |
| `add(ctx)` / `remove(ctx)` | codemods | Run with the answers; `--dry-run` prints the plan |
| `commands` | `() => import(...)` | Commands mounted as `kitr <name>`, such as `kitr jobs:work` |
| `generators` | `Record<string, Generator>` | Mounted as `kitr make:<kind>`; the project's `stubs/<kind>.ts` overrides the stub |
| `doctor(project)` | `Finding[]` | Appended to `kitr doctor`. Pure: read, never write |
| `types` | `() => import(...)` | A module exporting a `defineTypes()` generator that `kitr types` runs into `.kitr/` |
| `wraps` | `Record<string, string>` | Upstream libraries this package re-exports, by the kitr entry to import instead; `kitr doctor` flags direct imports |
| `vite` | `{ serverOnlyConfig, optimizeDeps, plugin, start, provider }` | What the package adds to the Vite build, such as a plugin: `@kitr/tailwind/vite` |
| `platform` | `{ factory, export, from, defaultName }` | For `kind: 'platform'`: the `definePlatform` factory `kitrrc.ts` calls, how it imports it, and the name `kitr add <type>` suggests |
| `kit` | `{ description, platforms, packages, components, files }` | For `kind: 'kit'`: what `kitr new --kit` sets up. See [Writing a kit](kits.md#writing-a-kit) |
| `routes` | string | The module exporting this package's route-table extension |
| `eject` | `Record<string, string>` | Import rewrites `kitr eject all` prints |

### Questions

| Type | Flag | Answer |
| --- | --- | --- |
| `select` | `--driver redis` | one of `options` |
| `multiselect` | `--targets ios,android` | a list of `options` |
| `confirm` | `--worker` / `--no-worker` | boolean |
| `text` | `--port 4000` | string |

`when(answers, project)` skips a question (and its answer) when it returns false; `validate(value)` rejects a prompt or a flag with a message. `kitr add <pkg> --help` prints the questions as flags, read from the module, so the help is never stale.

### What `ctx` can do

`ctx` owns the wiring files and nothing else. Every call is idempotent.

| | |
| --- | --- |
| `ctx.deps.add('ioredis', { name: 'vite', dev: true })`, `ctx.deps.remove(...)` | `package.json` dependencies, installed once at the end |
| `ctx.packageJson.set('msw', { workerDirectory: ['public'] })`, `ctx.packageJson.remove(...)` | A top-level `package.json` field; `remove` only when it still holds that value |
| `ctx.provider.add('@kitr/jobs/provider')`, `.remove(...)` | the `providers` list in `kitrrc.ts` |
| `ctx.config('jobs', source)` | `config/jobs.ts`, skipped when it exists |
| `ctx.write(path, content, { overwrite })`, `ctx.unlink(path)` | any new file; delete a file kitr wrote |
| `ctx.edit(path, (mod, src) => ...)` | an existing file through magicast, or return replacement text |
| `ctx.scripts.add('worker', 'kitr jobs:work')`, `.remove(name, command?)` | `package.json` scripts |
| `ctx.env.add({ REDIS_URL: '...' })`, `ctx.env.schema('server', 'REDIS_URL', "e.url()")` | `.env.example` and `app/env.ts` |
| `ctx.agents.add('jobs', body)`, `.remove('jobs')` | a `## kitr: jobs` section in `AGENTS.md` |
| `ctx.tsconfig.addTypes(...)`, `.addLib(...)`, `.addInclude(...)`, `.addPaths({...})`, `.set(option, value)` | `tsconfig.json` |
| `ctx.vite.addPlugin('tailwind', '@tailwindcss/vite')` | `plugins` in `vite.config.ts`, when the file exists |
| `ctx.routes.extend('@kitr/api/routes')`, `.remove(...)` | the extensions in the project's `defineRoutes([...])` call |
| `ctx.server.attach({ marker, import, line, first })` | one line and its import after `createServer()` in the server entry. `first` puts it before the others |
| `ctx.replaceImport(file, from, to)` | swap one side-effect import for another (`@kitr/theme/styles.css` for the Tailwind preset) |
| `ctx.types.enable()` | generated types in `.kitr/`, wired into `tsconfig.json` and `.gitignore` |
| `ctx.app.option('operations', '#kitr/actions')`, `.removeOption(...)` | pass a named value to `createApp({ ... })` in `app/app.ts`, imported from the given module |

The project facts it may read: `ctx.root`, `ctx.pm`, `ctx.pkg`, `ctx.rc` (packages, providers, directories, platforms), `ctx.isServerOnly`, `ctx.has('react')` (a dependency, present or queued), `ctx.hasPackage('server')` (in `kitrrc.ts`, or added earlier in this run), `ctx.exists(path)`, `ctx.read(path)`, and `ctx.answers`.

## The static block

```json
{
  "name": "@kitr/jobs",
  "exports": { ".": "./dist/index.js", "./provider": "./dist/provider.js", "./kitr": "./dist/kitr.js" },
  "kitr": {
    "name": "jobs",
    "title": "Jobs",
    "summary": "Run work in the background or on a schedule, with retries when it fails.",
    "category": "backend",
    "runsOn": "server",
    "requires": ["server"],
    "docs": "docs",
    "setup": "./kitr"
  }
}
```

`setup` says the package ships a setup module; the CLI looks for the `./kitr` export either way. `kitr package:check` validates the block, and the generated manifest table in the CLI (`pnpm manifests`) is what the site lists.

## How `kitr add` resolves a name

`jobs` means `@kitr/jobs`; a name with a scope is used as written. If the package is not installed, the CLI installs it, then runs its `kitr` module. A package without a setup module is installed and listed in `kitrrc.ts`, and nothing else happens.

## Commands

A `commands` module exports command objects in [citty](https://github.com/unjs/citty)'s shape (`meta`, `args`, `run`). Prefix them with the package name (`jobs:work`) so they never clash. A name that clashes with a core command or another package is an error.

## Platforms and kits

A platform package (`kind: 'platform'`) adds a `platform` block: the `definePlatform` factory `kitrrc.ts` calls, the export and module it is imported from, and the name `kitr add <type>` suggests. See [Platforms](platforms.md).

A kit package (`kind: 'kit'`) adds a `kit` block and runs on `kitr new --kit <name>`. See [Kits](kits.md).

## Where the official setups are

Every official package keeps its setup in `packages/<name>/src/kitr.ts`, and every kit in `packages/kit-<name>/src/kitr.ts`. The CLI has no package-specific code.
