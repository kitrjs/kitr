import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import {
  coerceOption,
  isPlatformInstance,
  type PlatformContext,
  type PlatformFactory,
  type PlatformInstance,
} from '@kitr/core'
import { builders, generateCode, parseModule } from 'magicast'
import pc from 'picocolors'
import type { Codemods } from './codemods'
import { configurePackages } from './configure'
import { log, type ProjectContext } from './context'
import { manifests } from './manifests.gen'
import { loadPackage } from './packages'

/**
 * Platforms answer "where does this app run?". They are packages, listed by name in kitrrc.ts:
 *
 *   platforms: { site: web({ mode: 'ssr' }), api: server({ runtime: 'node' }), app: desktop() }
 *
 * The CLI executes kitrrc.ts to get the instances, hands each a PlatformContext and runs its
 * `dev` / `build` / `start` / `doctor` / `scaffold` hooks. Core knows no platform by name.
 */

export interface PlatformTypeInfo {
  /** The kitr package that owns the platform. */
  package: string
  /** The module exporting the factory (what kitrrc.ts imports). */
  entry: string
  factory: string
  description: string
  /** The name `kitr add <type>` suggests. */
  defaultName: string
  factoryFn: PlatformFactory<any>
}

/** The official platform types, from the packages whose manifest says `kind: 'platform'`. Any package may declare one. */
export const platformTypeNames = Object.keys(manifests).filter(
  (name) => manifests[name]!.kind === 'platform',
)

export type Flags = Record<string, string | number | boolean | string[] | undefined>

/** `--port 4000 --open --no-sync --target=ios` → flags, plus the bare words. */
export function parseFlags(rawArgs: string[]): {
  words: string[]
  flags: Record<string, string | boolean>
} {
  const words: string[] = []
  const flags: Record<string, string | boolean> = {}
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i]!
    if (!arg.startsWith('--')) {
      words.push(arg)
      continue
    }
    const eq = arg.indexOf('=')
    if (eq > 0) {
      flags[arg.slice(2, eq)] = arg.slice(eq + 1)
      continue
    }
    const key = arg.slice(2)
    if (key.startsWith('no-')) {
      flags[key.slice(3)] = false
      continue
    }
    const next = rawArgs[i + 1]
    if (next !== undefined && !next.startsWith('--')) {
      flags[key] = next
      i++
    } else flags[key] = true
  }
  return { words, flags }
}

function tsconfigAliases(ctx: ProjectContext): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    const ts = JSON.parse(ctx.read('tsconfig.json'))
    for (const [k, v] of Object.entries<string[]>(ts.compilerOptions?.paths ?? {}))
      out[k.replace('/*', '')] = ctx.path(v[0]!.replace('/*', ''))
  } catch {}
  return out
}

async function projectJiti(ctx: ProjectContext) {
  const { createJiti } = await import('jiti')
  return createJiti(ctx.rcPath ?? ctx.path('kitrrc.ts'), {
    alias: tsconfigAliases(ctx),
    interopDefault: true,
  })
}

/** Execute kitrrc.ts and return `platforms`, with `KITR_<NAME>_<OPTION>` env overrides applied. */
export async function loadPlatforms(
  ctx: ProjectContext,
  env: Record<string, string | undefined> = process.env,
): Promise<Record<string, PlatformInstance>> {
  if (!ctx.rcPath) return {}
  const jiti = await projectJiti(ctx)
  const mod = (await jiti.import(ctx.rcPath)) as Record<string, any>
  const rc = mod.default ?? mod
  const out: Record<string, PlatformInstance> = {}
  for (const [name, value] of Object.entries<unknown>(rc.platforms ?? {})) {
    if (!isPlatformInstance(value))
      throw new Error(
        `kitrrc.ts: platforms.${name} is not a platform (expected web(), server(), desktop(), mobile() or another definePlatform() factory)`,
      )
    out[name] = applyEnv(name, value, env)
  }
  return out
}

function applyEnv(
  name: string,
  instance: PlatformInstance,
  env: Record<string, string | undefined>,
) {
  const overrides: Record<string, unknown> = {}
  const prefix = `KITR_${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_`
  for (const [key, spec] of Object.entries(instance.definition.describe ?? {})) {
    const raw = env[`${prefix}${key.toUpperCase()}`]
    if (raw !== undefined) overrides[key] = coerceOption(spec, raw)
  }
  return Object.keys(overrides).length ? instance.with(overrides) : instance
}

/**
 * Copy a child's output to `target` one line at a time, each line through `prefix`, so two
 * platforms running side by side stay readable. A partial last line is held until it ends.
 */
export function pipeLines(
  source: NodeJS.ReadableStream | null,
  target: { write(chunk: string): unknown },
  prefix: (line: string) => string,
) {
  if (!source) return
  let rest = ''
  source.on('data', (chunk: string | Buffer) => {
    const lines = (rest + chunk.toString()).split(/\r?\n/)
    rest = lines.pop() ?? ''
    for (const line of lines) target.write(`${prefix(line)}\n`)
  })
  source.on('end', () => {
    if (rest) target.write(`${prefix(rest)}\n`)
    rest = ''
  })
}

// kitr-allow-module-state: constant list of colour functions, never mutated
const PREFIX_COLORS = [pc.cyan, pc.magenta, pc.yellow, pc.green, pc.blue, pc.red]

/** `[name] ` in a colour that stays the same for a platform (plain when colours are off). */
export function platformPrefix(name: string, index: number): (line: string) => string {
  const colour = PREFIX_COLORS[index % PREFIX_COLORS.length]!
  const label = colour(`[${name}]`)
  return (line) => `${label} ${line}`
}

/** Pick platforms by name; no names means every platform. */
export function selectPlatforms(
  all: Record<string, PlatformInstance>,
  names: string[],
): Array<[string, PlatformInstance]> {
  const entries = Object.entries(all)
  if (!entries.length)
    throw new Error(
      `No platforms in kitrrc.ts. Add one with \`kitr add <type> <name>\` (types: ${platformTypeNames.join(', ')}).`,
    )
  if (!names.length) return entries
  return names.map((name) => {
    const found = all[name]
    if (!found)
      throw new Error(
        `No platform named "${name}" in kitrrc.ts (have: ${Object.keys(all).join(', ')})`,
      )
    return [name, found]
  })
}

/** Apply `--flag value` overrides: known options go through the platform's schema, the rest stay as flags. */
export function withFlags(
  instance: PlatformInstance,
  flags: Record<string, string | boolean>,
): { instance: PlatformInstance; flags: Flags } {
  const overrides: Record<string, unknown> = {}
  const rest: Flags = {}
  for (const [key, raw] of Object.entries(flags)) {
    const spec = instance.definition.describe?.[key]
    if (spec) overrides[key] = typeof raw === 'boolean' ? raw : coerceOption(spec, raw)
    else rest[key] = raw
  }
  return {
    instance: Object.keys(overrides).length ? instance.with(overrides) : instance,
    flags: { ...overrides, ...rest } as Flags,
  }
}

export function createPlatformContext(
  ctx: ProjectContext,
  name: string,
  instance: PlatformInstance,
  options: {
    platforms: PlatformInstance[]
    flags?: Flags
    signal?: AbortSignal
    env?: Record<string, string>
    /** Put this label in front of every line the platform's processes print (`[site]`). */
    prefix?: (line: string) => string
  } = { platforms: [] },
): PlatformContext {
  const baseEnv: Record<string, string | undefined> = {
    ...process.env,
    ...options.env,
    KITR_PLATFORM: name,
  }
  const run = (
    command: string,
    args: string[] = [],
    o: { cwd?: string; env?: Record<string, string> } = {},
  ) =>
    new Promise<void>((resolveRun, reject) => {
      if (options.signal?.aborted) return resolveRun()
      const prefix = options.prefix
      const child = spawn(command, args, {
        cwd: o.cwd ?? ctx.root,
        // With a prefix the output goes through us, line by line; input stays the terminal's.
        stdio: prefix ? ['inherit', 'pipe', 'pipe'] : 'inherit',
        env: {
          // Piped output is not a terminal, so tools would drop their colours: ask for them.
          ...(prefix && process.stdout.isTTY ? { FORCE_COLOR: '1' } : {}),
          ...baseEnv,
          ...o.env,
        },
        signal: options.signal,
        shell: process.platform === 'win32',
      })
      if (prefix) {
        pipeLines(child.stdout, process.stdout, prefix)
        pipeLines(child.stderr, process.stderr, prefix)
      }
      child.on('error', (error) =>
        (error as NodeJS.ErrnoException).name === 'AbortError' ? resolveRun() : reject(error),
      )
      child.on('exit', (code, signal) => {
        if (code === 0 || signal || options.signal?.aborted) resolveRun()
        else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
      })
    })
  return {
    name,
    root: ctx.root,
    options: instance.options,
    pm: ctx.pm,
    flags: options.flags ?? {},
    platforms: options.platforms,
    env: baseEnv,
    signal: options.signal,
    log,
    dir: (...parts) =>
      resolve(ctx.root, ctx.readRc().directories.platforms ?? 'platforms', name, ...parts),
    exists: (path) => existsSync(resolve(ctx.root, path)),
    read: (path) => readFileSync(resolve(ctx.root, path), 'utf8'),
    write(path, content, o = {}) {
      const full = resolve(ctx.root, path)
      if (existsSync(full) && !o.overwrite) return false
      if (ctx.dryRun) {
        log.step(`would write ${relative(ctx.root, full)}`)
        return true
      }
      mkdirSync(dirname(full), { recursive: true })
      writeFileSync(full, content)
      ctx.touched.add(relative(ctx.root, full))
      log.step(`write ${relative(ctx.root, full)}`)
      return true
    },
    run,
    exec(bin, args = [], o = {}) {
      const local = resolve(
        ctx.root,
        'node_modules',
        '.bin',
        process.platform === 'win32' ? `${bin}.cmd` : bin,
      )
      if (existsSync(local)) return run(local, args, o)
      switch (ctx.pm) {
        case 'pnpm':
          return run('pnpm', ['exec', bin, ...args], o)
        case 'yarn':
          return run('yarn', [bin, ...args], o)
        case 'bun':
          return run('bunx', [bin, ...args], o)
        default:
          return run('npx', ['--no-install', bin, ...args], o)
      }
    },
  }
}

/** Resolve a platform type to its package: the setup module must say `kind: 'platform'`. */
export async function resolvePlatformType(
  ctx: ProjectContext,
  type: string,
): Promise<PlatformTypeInfo> {
  let loaded: Awaited<ReturnType<typeof loadPackage>>
  try {
    loaded = await loadPackage(ctx, type)
  } catch (error) {
    throw new Error(
      `Unknown platform type "${type}": ${(error as Error).message}. Types: ${platformTypeNames.join(', ')}, or a package whose setup module declares kind: 'platform'.`,
    )
  }
  const def = loaded?.definition
  if (!loaded || def?.kind !== 'platform' || !def.platform)
    throw new Error(
      `"${type}" is not a platform type. Types: ${platformTypeNames.join(', ')}, or a package whose setup module declares kind: 'platform'.`,
    )
  const entry =
    def.platform.from ?? (loaded.package.startsWith('@kitr/') ? `kitr/${def.name}` : loaded.package)
  return {
    package: loaded.package,
    entry,
    factory: def.platform.export,
    description: def.platform.factory({}).definition.description ?? '',
    defaultName: def.platform.defaultName ?? def.name,
    factoryFn: def.platform.factory,
  }
}

/** Load a platform factory from the package's setup module. */
export async function loadFactory(
  ctx: ProjectContext,
  type: string,
): Promise<PlatformFactory<any>> {
  return (await resolvePlatformType(ctx, type)).factoryFn
}

/** `{ mode: 'ssr', port: 3000 }` as source text, single quotes, no quoted keys. Biome reflows it. */
export function literal(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => literal(v)).join(', ')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== undefined,
    )
    if (!entries.length) return '{}'
    return `{ ${entries.map(([k, v]) => `${/^[a-zA-Z_$][\w$]*$/.test(k) ? k : `'${k}'`}: ${literal(v)}`).join(', ')} }`
  }
  if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`
  return String(value)
}

function editRcSource(
  ctx: ProjectContext,
  edit: (mod: any, target: any, src: string, addImport: (line: string) => void) => void,
) {
  const rcPath = ctx.rcPath ?? ctx.path('kitrrc.ts')
  if (!existsSync(rcPath)) {
    ctx.write(
      'kitrrc.ts',
      `import { defineKitrConfig } from 'kitr/app'\n\nexport default defineKitrConfig({\n  packages: [],\n  providers: [],\n  platforms: {},\n})\n`,
    )
    ctx.rcPath = rcPath
  }
  if (ctx.dryRun) return
  const src = readFileSync(rcPath, 'utf8')
  const mod = parseModule(src)
  const target =
    mod.exports.default?.$type === 'function-call'
      ? mod.exports.default.$args[0]
      : mod.exports.default
  if (!target || typeof target !== 'object')
    throw new Error(`${rcPath}: expected \`export default defineKitrConfig({...})\``)
  const imports: string[] = []
  edit(mod, target, src, (line) => imports.push(line))
  let code = generateCode(mod, { quote: 'single' }).code
  if (imports.length) {
    // Add imports as plain text after the last import so the file keeps its own style.
    const lines = code.split('\n')
    let last = -1
    for (let i = 0; i < lines.length; i++) if (/^import\s/.test(lines[i]!)) last = i
    lines.splice(last + 1, 0, ...imports)
    code = lines.join('\n')
  }
  writeFileSync(rcPath, code)
  ctx.touched.add('kitrrc.ts')
}

/** Write `platforms.<name> = <factory>({...})` into kitrrc.ts with its import. Replaces an existing entry. */
export function writeRcPlatform(
  ctx: ProjectContext,
  name: string,
  info: Pick<PlatformTypeInfo, 'entry' | 'factory'>,
  options: Record<string, unknown>,
) {
  editRcSource(ctx, (_mod, target, src, addImport) => {
    if (
      !new RegExp(
        `import\\s*\\{[^}]*\\b${info.factory}\\b[^}]*\\}\\s*from\\s*['"]${info.entry}['"]`,
      ).test(src)
    )
      addImport(`import { ${info.factory} } from '${info.entry}'`)
    if (!target.platforms) target.platforms = {}
    target.platforms[name] = builders.raw(
      `${info.factory}(${Object.keys(options).length ? literal(options) : ''})`,
    )
  })
}

/**
 * Remove `platforms.<name>` from kitrrc.ts, and the factory's import once no other platform calls it.
 * Returns the factory the entry called, so the caller can drop that type's provider too.
 */
export function removeRcPlatform(ctx: ProjectContext, name: string): string | undefined {
  const platforms = ctx.readRc().platforms
  const factory = platforms[name]?.factory
  const stillUsed = Object.entries(platforms).some(([n, p]) => n !== name && p.factory === factory)
  editRcSource(ctx, (mod, target) => {
    if (target.platforms) delete target.platforms[name]
    if (factory && !stillUsed && mod.imports[factory]) delete mod.imports[factory]
  })
  return factory && !stillUsed ? factory : undefined
}

/** Change one option of a platform in kitrrc.ts (`kitr config site port 4000`). `undefined` removes it. */
export function setRcPlatformOption(
  ctx: ProjectContext,
  name: string,
  key: string,
  value: unknown,
) {
  editRcSource(ctx, (_mod, target) => {
    const call = target.platforms?.[name]
    if (call?.$type !== 'function-call')
      throw new Error(`kitrrc.ts: platforms.${name} is not a factory call`)
    let arg = call.$args[0]
    if (!arg) {
      call.$args.push({})
      arg = call.$args[0]
    }
    if (value === undefined) delete arg[key]
    else arg[key] = value
  })
}

export interface AddPlatformOptions {
  type: string
  name: string
  options?: Record<string, unknown>
  /** Skip the platform's scaffold (files under platforms/<name>/). */
  scaffold?: boolean
  /** Install missing packages before loading them (default true). */
  install?: boolean
  /** Packages configured earlier in this run. */
  added?: Set<string>
}

/**
 * `kitr add <type> <name> --option value`: registers the platform in kitrrc.ts, installs the
 * package and the platform's own dependencies, adds its provider and required packages, writes
 * its files and the `dev`/`build`/`start` scripts.
 */
export async function addPlatform(
  ctx: ProjectContext,
  codemods: Codemods,
  add: AddPlatformOptions,
): Promise<PlatformInstance> {
  const info = await resolvePlatformType(ctx, add.type)
  if (!/^[a-z][a-z0-9_-]*$/i.test(add.name))
    throw new Error(
      `Platform name "${add.name}" must be a short identifier (site, api, app, phone...)`,
    )
  const instance = info.factoryFn(add.options ?? {})
  const rc = ctx.readRc()
  // The platform package itself, what its setup module requires, and what the instance asks for.
  const steps = await configurePackages(
    ctx,
    codemods,
    [info.package, ...(instance.definition.requires ?? [])],
    { install: add.install ?? true, yes: true, report: false, added: add.added },
  )
  for (const step of steps)
    if (step.package !== info.package) log.success(`${step.name} (needed by ${add.type})`)
  codemods.installPackages(instance.dependencies ?? [])
  if (instance.definition.provider) codemods.addProvider(instance.definition.provider)
  writeRcPlatform(ctx, add.name, info, add.options ?? {})
  for (const [script, command] of Object.entries({
    dev: 'kitr dev',
    build: 'kitr build',
    start: 'kitr start',
    ...instance.scripts,
  }))
    codemods.addScript(script, command)
  if (add.scaffold !== false) {
    const others = Object.entries(rc.platforms)
      .filter(([n]) => n !== add.name)
      .map(([, p]) => ({ type: p.factory }) as PlatformInstance)
    await instance.scaffold?.(
      createPlatformContext(ctx, add.name, instance, { platforms: [...others, instance] }),
    )
  }
  if (instance.agents) codemods.addAgentsSection(`platform ${add.name}`, instance.agents)
  return instance
}

/** Run one hook (`dev`, `build`, `start`, `scaffold`) for the named platforms. */
/** `kitr generate` before dev and build, so generated names and the route table are current before anything compiles. */
async function generateAll(ctx: ProjectContext) {
  const { runGenerate } = await import('./generate')
  const result = await runGenerate(ctx, { quiet: !ctx.verbose, strict: false })
  if (result.types.written.length)
    log.step(
      `kitr generate: ${result.types.written.length} type file(s) written (${result.types.generators.join(', ')})`,
    )
}

export async function runPlatforms(
  ctx: ProjectContext,
  hook: 'dev' | 'build' | 'start' | 'scaffold',
  names: string[],
  flags: Record<string, string | boolean> = {},
  mode: 'parallel' | 'sequential' = hook === 'build' ? 'sequential' : 'parallel',
) {
  if (hook === 'dev' || hook === 'build') await generateAll(ctx)
  const all = await loadPlatforms(ctx)
  const selected = selectPlatforms(all, names)
  const controller = new AbortController()
  const stop = () => controller.abort()
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  const everyInstance = Object.values(all)
  // Several platforms running at once print into one terminal: label each line with its platform.
  const labelled = mode === 'parallel' && selected.length > 1 && hook !== 'scaffold'
  const tasks = selected.map(([name, base], index) => {
    const { instance, flags: platformFlags } = withFlags(base, flags)
    const fn = instance[hook]
    return async () => {
      if (!fn) {
        log.info(`${name}: the ${instance.type} platform has no ${hook} step`)
        return
      }
      log.title(`${hook} ${name} (${instance.type})`)
      await fn.call(
        instance,
        createPlatformContext(ctx, name, instance, {
          platforms: everyInstance,
          flags: platformFlags,
          signal: controller.signal,
          ...(labelled ? { prefix: platformPrefix(name, index) } : {}),
        }),
      )
    }
  })
  try {
    if (mode === 'sequential') for (const task of tasks) await task()
    else await Promise.all(tasks.map((task) => task()))
  } finally {
    process.off('SIGINT', stop)
    process.off('SIGTERM', stop)
  }
}
