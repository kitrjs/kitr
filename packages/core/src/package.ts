import type { PlatformFactory } from './platform'
import type { MaybePromise } from './types'

/**
 * The package contract. A kitr package is an npm package that ships, beside its runtime code,
 * a setup module exported as `<package>/kitr`:
 *
 *   import { definePackage } from '@kitr/core/package'
 *   export default definePackage({
 *     name: 'jobs',
 *     requires: ['server'],
 *     questions: [{ name: 'worker', message: 'Run the worker in this process?', type: 'confirm', default: true }],
 *     add(ctx) { ctx.provider.add('@kitr/jobs/provider'); ctx.config('jobs', '...') },
 *     remove(ctx) { ctx.provider.remove('@kitr/jobs/provider') },
 *     commands: () => import('./commands'),
 *     generators: { job: { description: '...', path: (name) => `server/jobs/${name}.ts`, stub: ... } },
 *   })
 *
 * The CLI loads it from the installed package and runs it on `kitr add`, `kitr remove`,
 * `kitr doctor` and `kitr make:*`, and mounts its commands. Core knows no package by name;
 * everything the CLI does for `@kitr/jobs` it does the same way for `@acme/anything`.
 *
 * This module is types and identity functions only: a setup module must stay free of Node
 * imports so it costs nothing to load and can be typechecked anywhere.
 */

export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun'

export type AnswerValue = string | boolean | string[] | undefined
export type Answers = Record<string, AnswerValue>

export type QuestionType = 'select' | 'multiselect' | 'confirm' | 'text'

export interface QuestionOption {
  value: string
  label?: string
  hint?: string
}

/**
 * One question `kitr add <pkg>` asks. Every question is also a flag (`--<name> <value>`,
 * `--no-<name>` for a confirm), so CI and agents never see a prompt; with `--yes`, no TTY,
 * or `CI=1` the default is taken.
 */
export interface Question {
  /** The flag name: `driver` is `--driver`. */
  name: string
  message: string
  type: QuestionType
  /** For `select` and `multiselect`. */
  options?: QuestionOption[]
  default?: AnswerValue
  /** Ask (and apply) only when this returns true. Earlier answers are already filled in. */
  when?: (answers: Answers, project: ProjectInfo) => boolean
  /** Return a message to reject a value, from a prompt or a flag. */
  validate?: (value: AnswerValue, answers: Answers) => string | undefined
}

/** Static facts about the project a package may read. Nothing here writes. */
export interface RcPlatformInfo {
  /** The factory called in kitrrc.ts (`web`, `server`...). */
  factory: string
  source?: string
  options?: Record<string, unknown>
}

export interface RcInfo {
  packages: string[]
  providers: string[]
  directories: Record<string, string>
  platforms: Record<string, RcPlatformInfo>
}

export interface ProjectInfo {
  root: string
  pm: PackageManager
  /** The project's package.json, as it stands (queued dependency edits are not in it yet). */
  pkg: Record<string, any>
  rc: RcInfo
  /** No React anywhere: a pure backend. Client packages are refused here. */
  isServerOnly: boolean
  /** `has('react')`: the dependency is in package.json or queued by this run. */
  has(dependency: string): boolean
  /** `hasPackage('server')` or `hasPackage('@kitr/server')`: listed in kitrrc.ts packages, or added earlier in this run. */
  hasPackage(name: string): boolean
  exists(path: string): boolean
  read(path: string): string
}

export interface Finding {
  level: 'error' | 'warn' | 'info'
  message: string
  fix?: string
}

export interface Logger {
  info(msg: string): void
  success(msg: string): void
  warn(msg: string): void
  error(msg: string): void
  step(msg: string): void
}

export interface DependencySpec {
  name: string
  version?: string
  dev?: boolean
}

/**
 * What a package's `add` and `remove` get. Everything here edits a file kitr owns the shape of
 * (kitrrc.ts, config/*, package.json, .env.example, AGENTS.md, tsconfig.json, vite.config.ts,
 * the route table) or writes a new file. Every call is idempotent and queued: the CLI writes
 * once, installs once, formats once. `--dry-run` prints the plan instead.
 */
export interface AddContext extends ProjectInfo {
  /** Answers to the package's questions, from prompts, flags or defaults. */
  answers: Answers
  dryRun: boolean
  log: Logger
  deps: {
    /** Queue dependencies. A kitr package gets the CLI's version; others the tested version, or `version`. */
    add(...specs: Array<string | DependencySpec>): void
    remove(...names: string[]): void
  }
  provider: {
    /** Add `() => import('<spec>')` to kitrrc.ts providers. */
    add(spec: string): void
    remove(spec: string): void
  }
  /** Write `config/<name>.ts`. Skipped when it exists unless `overwrite`. */
  config(name: string, source: string, options?: { overwrite?: boolean }): void
  /** Write a file relative to the project root. Returns false when it exists and `overwrite` is not set. */
  write(path: string, content: string, options?: { overwrite?: boolean }): boolean
  /** Delete a file kitr wrote earlier. */
  unlink(path: string): void
  /**
   * Edit an existing source file with magicast: `edit('app/main.tsx', (mod, src) => { ... })`.
   * Return a string to replace the file's text instead. Skipped when the file is missing.
   */
  edit(
    path: string,
    fn: (mod: any, src: string) => void | string,
    options?: { quote?: 'single' | 'double' },
  ): void
  scripts: {
    /** Set a package.json script unless it already has that command. */
    add(name: string, command: string): void
    /** Remove a script, only if it still holds `command` when given. */
    remove(name: string, command?: string): void
  }
  packageJson: {
    /** Set a top-level package.json field (`msw`, `browserslist`...). Overwrites. */
    set(field: string, value: unknown): void
    /** Remove a top-level field, only if it still holds `value`. */
    remove(field: string, value: unknown): void
  }
  env: {
    /** Append to `.env.example` (and `.env` when present). */
    add(vars: Record<string, string>, comment?: string): void
    /** Declare a variable in `app/env.ts` (`createEnv`), with its `.env.example` line. */
    schema(scope: 'public' | 'server', name: string, schema: string, example?: string): void
  }
  agents: {
    /** A `## kitr: <name>` section in AGENTS.md. */
    add(name: string, body: string): void
    remove(name: string): void
  }
  tsconfig: {
    addTypes(...types: string[]): void
    removeTypes(...types: string[]): void
    addPaths(paths: Record<string, string[]>): void
    addInclude(...entries: string[]): void
    addLib(...libs: string[]): void
    /** Set one compilerOptions key. */
    set(option: string, value: unknown): void
  }
  vite: {
    /** Add `import <name> from '<spec>'` and `<call>` to `plugins` in vite.config.ts. */
    addPlugin(importName: string, spec: string, call?: string): void
  }
  routes: {
    /**
     * Add a route-table extension to the project's `defineRoutes([...])` call. Pages extend the
     * app table (`directories.routeTable`); endpoints and sockets the server table
     * (`directories.serverRouteTable`, `{ table: 'server' }`), which never imports React. A
     * server-only project has one table.
     */
    extend(spec: string, options?: { table?: 'app' | 'server' }): void
    remove(spec: string, options?: { table?: 'app' | 'server' }): void
    /**
     * Append `.page(path, { lazy: () => import(module) })` to the app table. False when the
     * table is not a method chain, so the caller can print the line to add by hand.
     */
    addPage(path: string, module: string): boolean
    /**
     * Append one link (`.ws('/ws', { channels: [chat] })`) to a table's method chain, adding the
     * imports it needs. False when the table is not a chain. `skipIf` matching the file means
     * the link is already there.
     */
    append(
      link: string,
      options?: {
        table?: 'app' | 'server'
        imports?: Array<{ from: string; local: string; imported?: string }>
        skipIf?: RegExp
      },
    ): boolean
  }
  types: {
    /**
     * Make the project ready for `kitr types` (a package with a `types` generator): the `#kitr/*`
     * path and `.kitr` include in tsconfig.json, `.kitr` in .gitignore, `kitr types` before `tsc`
     * in the typecheck script. Idempotent.
     */
    enable(): void
  }
  app: {
    /** Pass `<name>` to `createApp({ ... })` in `app/app.ts`, importing it from `from`. Idempotent. */
    option(name: string, from: string): void
    removeOption(name: string, from: string): void
  }
  /**
   * Replace one side-effect import (`import 'kitr/theme/styles.css'`) with another in a file,
   * or add `to` after the first import when neither is present. Skipped when the file is missing.
   */
  replaceImport(file: string, from: string | undefined, to: string): void
  server: {
    /**
     * Insert a line (with its import) into the server entry the server platform wrote
     * (`server/main.ts`) once, after `createServer()`. `marker` is the text that proves it is
     * already there; `first` puts the line straight after `createServer()` so middleware that
     * must see every request reads in the order it runs. Skipped when there is no server entry.
     */
    attach(options: { marker: string; import?: string; line: string; first?: boolean }): void
  }
}

/** Name casing helpers for generators and setup modules: `pascal('send-receipt')` is `SendReceipt`. */
export const naming = {
  pascal: (s: string): string =>
    s.replace(/(^|[-_/\s])(\w)/g, (_, __, c: string) => c.toUpperCase()).replace(/[^\w]/g, ''),
  snake: (s: string): string =>
    s
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[-\s/]+/g, '_')
      .toLowerCase(),
  camel: (s: string): string => {
    const p = naming.pascal(s)
    return p.charAt(0).toLowerCase() + p.slice(1)
  },
  /** `send_receipt` → `send-receipt`. */
  kebab: (s: string): string => naming.snake(s).replace(/_/g, '-'),
}

export interface GeneratorVars {
  /** The name as typed. */
  name: string
  [key: string]: string
}

export interface GeneratorArg {
  type: 'boolean' | 'string'
  description?: string
  default?: unknown
}

/** A `kitr make:<kind>` generator. A project overrides the stub with `kitr eject stub <kind>`. */
export interface Generator {
  description: string
  /** Extra flags (`make:controller --resource`). */
  args?: Record<string, GeneratorArg>
  /** Where the file goes and what the stub receives, from the typed name and flags. */
  target(
    name: string,
    project: ProjectInfo,
    args: Record<string, unknown>,
  ): { file: string; vars?: Record<string, string> }
  /** The file's source. */
  stub(vars: GeneratorVars): string
  /** Runs after the file is written: register it where it belongs (`make:page` adds the route). */
  after?(ctx: AddContext, written: { file: string; vars: GeneratorVars }): MaybePromise<void>
}

/** The least a CLI command must look like (citty's `CommandDef` satisfies it). Core does not import citty. */
export interface CommandLike {
  meta?: { name?: string; description?: string } | (() => unknown)
  run?: (...args: any[]) => unknown
  subCommands?: unknown
}

/**
 * What a package needs from the Vite build, declared on its setup module and read by `kitr/vite`
 * at config time, so the plugin knows no package by name.
 */
export interface PackageViteNeeds {
  /** `config/<name>.ts` imports Node APIs; keep it out of browser bundles. */
  serverOnlyConfig?: boolean
  /** Dependencies to pre-bundle in dev so the first start never rediscovers them (only the installed ones are listed). */
  optimizeDeps?: string[]
  /** A module whose default export is a Vite plugin factory to add (`@vitejs/plugin-react`, `@kitr/tailwind/vite`). */
  plugin?: string
  /** Render routes through TanStack Start (SSR, prerender, server functions). Declared by `router`. */
  start?: boolean
  /** `production: false`: the package's provider is dropped from production builds (devtools). */
  provider?: { production?: boolean }
}

export interface PlatformPackage {
  /** The `definePlatform` factory kitrrc.ts calls. */
  factory: PlatformFactory<any>
  /** The export name kitrrc.ts imports (`web` in `import { web } from 'kitr/web'`). */
  export: string
  /** Where kitrrc.ts imports it from. Default: `kitr/<name>` for `@kitr/*`, the package name otherwise. */
  from?: string
  /** The name `kitr add <type>` suggests (`site`, `api`, `app`, `phone`). Default: the type. */
  defaultName?: string
}

export interface KitPackage {
  description: string
  /** Platforms written to kitrrc.ts by name: `{ site: { type: 'web', options: { mode: 'ssr' } } }`. */
  platforms?: Record<string, { type: string; options?: Record<string, unknown> }>
  /** Packages to add, in order, with their answers. */
  packages: Array<string | { name: string; answers?: Answers }>
  /** Registry components to pull. */
  components?: string[]
  /** Runs after the packages: pages, controllers, tests. */
  files?(ctx: AddContext, projectName: string): MaybePromise<void>
}

export interface PackageDefinition {
  /** Short name: `kitr add <name>`, `config/<name>.ts`, the `<name>:` command prefix. */
  name: string
  /** Default `package`. A `platform` is added as `kitr add <name> <platform-name>`; a `kit` by `kitr new --kit`. */
  kind?: 'package' | 'platform' | 'kit'
  /** Other kitr packages (short names or full names) added first. */
  requires?: string[]
  /** Needs React: refused in a server-only project. */
  client?: boolean
  /** Install as a devDependency: tooling the app never imports at run time (testing). */
  dev?: boolean
  questions?: Question[] | ((project: ProjectInfo) => MaybePromise<Question[]>)
  add?(ctx: AddContext): MaybePromise<void>
  remove?(ctx: AddContext): MaybePromise<void>
  /** CLI commands, mounted as `kitr <name>`. Lazy: loaded when one runs or `--help` lists them. */
  commands?: () => Promise<Record<string, CommandLike> | { default: Record<string, CommandLike> }>
  /** `kitr make:<kind>` generators. */
  generators?: Record<string, Generator>
  /** Extra `kitr doctor` checks. Pure: read, never write. */
  doctor?(project: ProjectInfo): MaybePromise<Finding[]>
  /**
   * Upstream libraries this package re-exports, by the kitr entry to import instead:
   * `{ '@tanstack/react-query': 'kitr/query' }`. `kitr doctor` flags direct imports of them.
   */
  wraps?: Record<string, string>
  /** Type generation this package runs on `kitr types` (`defineTypes`). Lazy, like `commands`. */
  types?: () => Promise<unknown>
  vite?: PackageViteNeeds
  /** For `kind: 'platform'`. */
  platform?: PlatformPackage
  /** For `kind: 'kit'`. */
  kit?: KitPackage
  /** Module exporting this package's route-table extension (`@kitr/api/routes`). */
  routes?: string
  /** Import rewrites `kitr eject` prints: `{ 'kitr/router': '@tanstack/react-router' }`. */
  eject?: Record<string, string>
}

export function definePackage<const D extends PackageDefinition>(definition: D): D {
  return definition
}

export function isPackageDefinition(value: unknown): value is PackageDefinition {
  return (
    !!value && typeof value === 'object' && typeof (value as PackageDefinition).name === 'string'
  )
}

/** Resolve the module a `definePackage` export comes from: `export default` or a named `kitr`. */
export function pickPackageDefinition(mod: unknown): PackageDefinition | undefined {
  if (isPackageDefinition(mod)) return mod
  if (!mod || typeof mod !== 'object') return undefined
  const m = mod as Record<string, unknown>
  if (isPackageDefinition(m.default)) return m.default
  if (isPackageDefinition(m.kitr)) return m.kitr
  return undefined
}

/** `jobs` → `@kitr/jobs`; anything scoped or with a slash is taken as written. */
export function resolvePackageName(name: string): string {
  if (name.startsWith('@') || name.includes('/')) return name
  return `@kitr/${name}`
}

/** `@kitr/jobs` → `jobs`; `@acme/thing` → `@acme/thing`. */
export function shortPackageName(name: string): string {
  return name.startsWith('@kitr/') ? name.slice('@kitr/'.length) : name
}

/**
 * The file that renders the HTML document: `app/document.tsx` with code-defined routes, or the
 * root route file of a project still on file routes. Packages that touch the document (theme,
 * tailwind, seo) edit whichever exists.
 */
export function documentFile(project: {
  rc: { directories: { app?: string; routes?: string } }
  exists(path: string): boolean
}): string {
  const app = project.rc.directories.app ?? 'app'
  const document = `${app}/document.tsx`
  if (project.exists(document)) return document
  const root = `${project.rc.directories.routes ?? `${app}/routes`}/__root.tsx`
  return project.exists(root) ? root : document
}
