import type { StandardSchemaV1 } from '@standard-schema/spec'
import { validateSync } from './schema'
import type { MaybePromise } from './types'

/**
 * The platform contract. A platform answers "where does this app run?" and is a normal
 * package: `@kitr/web`, `@kitr/mobile`, `@kitr/desktop`, `@kitr/server`, or anything a team
 * writes with `definePlatform`. Core knows no platform by name; it only defines this shape,
 * and the CLI runs whatever `kitrrc.ts` lists under `platforms`.
 */

export type PlatformOptionType = 'string' | 'number' | 'boolean' | 'list'

export interface PlatformOptionSpec {
  description: string
  type: PlatformOptionType
  /** Allowed values for `string` and `list` options. */
  values?: readonly string[]
  default?: unknown
}

export interface PlatformDefinition<O extends object = any> {
  /** `web`, `mobile`, `desktop`, `server`, or your own. Shown by `kitr platforms`. */
  type: string
  description?: string
  /** Validates options from kitrrc.ts, `kitr config` and `--flags`. Any Standard Schema. */
  options?: StandardSchemaV1<unknown, O>
  /** What each option means, for `kitr config <name>` and `kitr add <type> --help`. */
  describe?: Record<string, PlatformOptionSpec>
  /** Import path of the runtime provider this platform contributes (drivers, hooks), e.g. `@kitr/mobile/provider`. */
  provider?: string
  /** kitr packages every app with this platform needs (`kitr add` installs them). */
  requires?: string[]
}

export interface PlatformFinding {
  level: 'error' | 'warn' | 'info'
  message: string
  fix?: string
}

export interface PlatformDependency {
  name: string
  version?: string
  dev?: boolean
}

/** What the CLI hands a platform when it runs one of its commands. */
export interface PlatformContext<O extends object = any> {
  /** The key in `platforms: { ... }`. Native projects live in `platforms/<name>/`. */
  name: string
  root: string
  options: O
  pm: 'pnpm' | 'npm' | 'yarn' | 'bun'
  /** Flags after the platform name on the command line (`--target ios`), already validated against `describe`. */
  flags: Record<string, string | number | boolean | string[] | undefined>
  /** Every platform in the project, for cross-platform decisions (a web platform serving the mobile shell, for example). */
  platforms: PlatformInstance[]
  env: Record<string, string | undefined>
  signal?: AbortSignal
  log: {
    info(msg: string): void
    success(msg: string): void
    warn(msg: string): void
    error(msg: string): void
    step(msg: string): void
  }
  /** `platforms/<name>/<rest>` as an absolute path. */
  dir(...parts: string[]): string
  exists(path: string): boolean
  read(path: string): string
  /** Writes a file relative to the project root. Returns false when it exists and `overwrite` is not set. */
  write(path: string, content: string, options?: { overwrite?: boolean }): boolean
  /** Spawn a command with stdio inherited and `KITR_PLATFORM=<name>` in its env. Rejects on a non-zero exit. */
  run(
    command: string,
    args?: string[],
    options?: { cwd?: string; env?: Record<string, string> },
  ): Promise<void>
  /** `pnpm exec <bin>`, `npx <bin>`... whichever the project's package manager uses. */
  exec(
    bin: string,
    args?: string[],
    options?: { cwd?: string; env?: Record<string, string> },
  ): Promise<void>
}

export interface PlatformHooks<O extends object = any> {
  /** Files the platform owns, written once by `kitr add` / `kitr new` and on demand by `kitr platforms scaffold`. */
  scaffold?(ctx: PlatformContext<O>): MaybePromise<void>
  dev?(ctx: PlatformContext<O>): MaybePromise<void>
  build?(ctx: PlatformContext<O>): MaybePromise<void>
  /** Run the production build (`kitr start <name>`). */
  start?(ctx: PlatformContext<O>): MaybePromise<void>
  doctor?(ctx: PlatformContext<O>): MaybePromise<PlatformFinding[]>
  /** npm dependencies the app needs for this platform; `kitr add` installs them. */
  dependencies?: PlatformDependency[]
  /** package.json scripts the platform wants (`cap`, `tauri`...). */
  scripts?: Record<string, string>
  /** Lines for the AGENTS.md section of this platform. */
  agents?: string
}

/**
 * Options core reads for every platform type, built in or third party. They are taken out of
 * the input before the package's own schema sees it, so no platform has to declare them.
 */
export interface PlatformBundleOptions {
  /**
   * Packages left out of this platform's build, by the name in `packages` (`'analytics'` or
   * `'@kitr/analytics'`): their provider and their `config/<name>.ts` do not ship in it.
   */
  without?: string[]
}

/** How `without` reads in `kitr config <name>`, `kitr platforms` and `kitr add <type> --help`. */
export const withoutOption: PlatformOptionSpec = {
  description: "Packages left out of this platform's build (their provider and config file)",
  type: 'list',
  default: [],
}

export interface PlatformInstance<O extends object = any> extends PlatformHooks<O> {
  readonly type: string
  /** Validated options with defaults applied. */
  readonly options: O
  /** Packages left out of this platform's build (`without` in kitrrc.ts). Empty by default. */
  readonly without: string[]
  /** The options as written in kitrrc.ts, before defaults. */
  readonly input: Partial<O>
  readonly definition: PlatformDefinition<O>
  /** The same platform with some options replaced (`kitr dev <name> --port 4000`, `KITR_<NAME>_PORT`). */
  with(overrides: Partial<O> & PlatformBundleOptions): PlatformInstance<O>
}

export type PlatformFactory<O extends object> = (
  options?: Partial<O> & PlatformBundleOptions,
) => PlatformInstance<O>

/**
 * Define a platform package:
 *
 *   export const extension = definePlatform(
 *     { type: 'extension', options: ExtOptions, provider: 'my-platform/provider' },
 *     (options) => ({
 *       scaffold: (ctx) => ctx.write(`platforms/${ctx.name}/manifest.json`, manifest(options)),
 *       dev: (ctx) => ctx.exec('vite', ['build', '--watch']),
 *       build: (ctx) => ctx.exec('vite', ['build']),
 *     }),
 *   )
 *
 * In kitrrc.ts: `platforms: { ext: extension({ ... }) }`.
 */
export function definePlatform<O extends object>(
  definition: PlatformDefinition<O>,
  factory: (options: O) => PlatformHooks<O>,
): PlatformFactory<O> {
  // `without` is core's: listed with the package's own options, never handed to its schema.
  const described: PlatformDefinition<O> = {
    ...definition,
    describe: { ...definition.describe, without: withoutOption },
  }
  const create = (all: Partial<O> & PlatformBundleOptions = {}): PlatformInstance<O> => {
    const { without, ...input } = all as Partial<O> & PlatformBundleOptions
    const options = parseOptions(definition, input as Partial<O>)
    const hooks = factory(options)
    return {
      ...hooks,
      type: definition.type,
      options,
      without: parseWithout(definition.type, without),
      input: input as Partial<O>,
      definition: described,
      // `without` lives outside `input`, so a replacement keeps it unless it names its own.
      with: (overrides) => create({ ...input, without, ...overrides } as Partial<O>),
    }
  }
  return create
}

function parseWithout(type: string, value: unknown): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || !v))
    throw new Error(
      `[kitr] Invalid options for ${type} platform:\n  without: expected a list of package names, such as ['analytics'], got ${JSON.stringify(value)}`,
    )
  return [...value]
}

/** Validate platform options with the definition's schema, or fill defaults from `describe`. */
export function parseOptions<O extends object>(
  definition: PlatformDefinition<O>,
  input: Partial<O>,
): O {
  const withDefaults: Record<string, unknown> = { ...input }
  for (const [key, spec] of Object.entries(definition.describe ?? {}))
    if (withDefaults[key] === undefined && spec.default !== undefined)
      withDefaults[key] = spec.default
  if (!definition.options) return withDefaults as O
  const result = validateSync(definition.options, withDefaults)
  if (!result.success) {
    const issues = Object.entries(result.fieldErrors).map(
      ([field, messages]) => `${field || 'options'}: ${(messages as string[]).join(', ')}`,
    )
    throw new Error(
      `[kitr] Invalid options for ${definition.type} platform:\n  ${issues.join('\n  ')}`,
    )
  }
  return result.data
}

/** Coerce a CLI string (`"3000"`, `"true"`, `"ios,android"`) into the option's declared type. */
export function coerceOption(spec: PlatformOptionSpec | undefined, raw: string): unknown {
  if (!spec) return raw
  switch (spec.type) {
    case 'number': {
      const n = Number(raw)
      if (Number.isNaN(n)) throw new Error(`expected a number, got "${raw}"`)
      return n
    }
    case 'boolean':
      if (raw === 'true' || raw === '1' || raw === '') return true
      if (raw === 'false' || raw === '0') return false
      throw new Error(`expected true or false, got "${raw}"`)
    case 'list':
      return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    default:
      if (spec.values && !spec.values.includes(raw))
        throw new Error(`expected one of ${spec.values.join(', ')}, got "${raw}"`)
      return raw
  }
}

export function isPlatformInstance(value: unknown): value is PlatformInstance {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as PlatformInstance).type === 'string' &&
    typeof (value as PlatformInstance).definition === 'object'
  )
}
