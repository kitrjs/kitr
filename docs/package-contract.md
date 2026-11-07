# The package contract

Everything in kitr beyond the core is a package you add, and every package, official or not, plugs in the same way. A kitr package is an npm package with two additions: a static `kitr` block in `package.json`, read by the site, the registry and `kitr add --list` without executing anything, and a setup module exported as `<package>/kitr`, which the CLI loads from the installed package and runs on `kitr add`, `kitr remove`, `kitr doctor` and `kitr make:*`. Core knows no package by name: `kitr add @acme/anything` does exactly what `kitr add jobs` does.

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
| `commands` | `() => import(...)` | A module of command objects (citty's shape), mounted as `kitr <name>`. The `<name>:` prefix is the convention; a core name or a name another package took is an error |
| `generators` | `Record<string, Generator>` | Mounted as `kitr make:<kind>`; the project's `stubs/<kind>.ts` overrides the stub |
| `doctor(project)` | `Finding[]` | Appended to `kitr doctor`. Pure: read, never write |
| `types` | `() => import(...)` | A module exporting a `defineTypes()` generator that `kitr types` runs into `.kitr/` |
| `wraps` | `Record<string, string>` | Upstream libraries this package re-exports, by the kitr entry to import instead; `kitr doctor` flags direct imports |
| `vite` | `{ serverOnlyConfig, optimizeDeps, plugin, start, provider }` | Read by `@kitr/vite` at config time from every package in `kitrrc.ts`: the plugin to add (`@vitejs/plugin-react`, `@kitr/tailwind/vite`), the deps to pre-bundle, the config file to keep out of browser bundles, whether to render through TanStack Start, whether the provider ships in production. The plugin knows no package by name. |
| `platform` | `{ factory, export, from, defaultName }` | For `kind: 'platform'`: the `definePlatform` factory `kitrrc.ts` calls, how it imports it, and the name `kitr add <type>` suggests |
| `kit` | `{ description, platforms, packages, components, files }` | For `kind: 'kit'`: the platforms `kitr new --kit` writes to `kitrrc.ts`, the packages it adds (a name, or `{ name, answers }` to pre-fill a package's questions), the registry components it pulls and `files(ctx, projectName)`, which writes the kit's pages, controllers and tests with the same `ctx` as `add`. The kit itself is never installed into the project |
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
| `ctx.routes.extend('@kitr/api/routes')`, `.remove(...)` | the extensions list of the project's `defineRoutes([...])` call, in `directories.routeTable` (default `app/routes.ts`); created when missing |
| `ctx.server.attach({ marker, import, line, first })` | one line (and its import) after `createServer()` in the server platform's entry, once; `first` puts it straight after `createServer()` for middleware that must see every request |
| `ctx.replaceImport(file, from, to)` | swap one side-effect import for another (`kitr/theme/styles.css` for the Tailwind preset) |
| `ctx.types.enable()` | the `#kitr/*` path and `.kitr` include in `tsconfig.json`, `.kitr` in `.gitignore`, `kitr types` before `tsc` in the typecheck script |
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

`jobs` means `@kitr/jobs`; anything with a scope or a slash is taken as written. When the package is not resolvable from the project, the CLI installs it first (`pnpm add @kitr/jobs`) and then loads its `kitr` module; with `--no-install` that is an error naming the flag. Inside this monorepo the module resolves from the CLI's own tree, which is how `kitr new --no-install` regenerates the examples. A package with no setup module falls back to the recipe of the same name inside the CLI, until every official package has moved its setup into its own code.

## Commands

A `commands` module exports plain command objects in citty's shape (`meta`, `args`, `run`); the kitr CLI mounts them next to its own. The `<name>:` prefix (`jobs:work`) is the convention, so a project with several packages never sees two meanings of one word; a bare name is allowed, and a collision with a core command or another package's command is an error at load time. Commands are loaded only when `kitr --help` runs or the word typed is not a core command, so an unrelated `kitr dev` pays nothing for them.

## Where the official setups are

| Package | Setup |
| --- | --- |
| `jobs`, `web` | `packages/<name>/src/kitr.ts` (the contract above) |
| every other package | `packages/cli/src/recipes*.ts` (legacy recipes, moving into their packages next) |
