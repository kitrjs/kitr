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
import type { Codemods } from './codemods'
import { log, type ProjectContext } from './context'
import { resolveRecipes } from './recipes'

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
  /** The module the CLI loads the factory from (a subpath without runtime deps where needed). */
  module: string
  factory: string
  description: string
}

/** The blessed platforms. Any package exporting a `definePlatform()` factory works the same way. */
export const platformTypes: Record<string, PlatformTypeInfo> = {
  web: {
    package: '@kitr/web',
    entry: 'kitr/web',
    module: '@kitr/web',
    factory: 'web',
    description: 'Browser app: static, SPA or server-rendered, optionally installable (PWA).',
  },
  desktop: {
    package: '@kitr/desktop',
    entry: 'kitr/desktop',
    module: '@kitr/desktop',
    factory: 'desktop',
    description: 'macOS, Windows and Linux app with a Tauri or Electron shell.',
  },
  mobile: {
    package: '@kitr/mobile',
    entry: 'kitr/mobile',
    module: '@kitr/mobile',
    factory: 'mobile',
    description: 'iOS and Android app with Capacitor.',
  },
  server: {
    package: '@kitr/server',
    entry: 'kitr/server',
    module: '@kitr/server/platform',
    factory: 'server',
    description: 'HTTP server on h3: Node, Bun, Deno or Cloudflare Workers.',
  },
}

export const platformTypeNames = Object.keys(platformTypes)

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

/** Pick platforms by name; no names means every platform. */
export function selectPlatforms(
  all: Record<string, PlatformInstance>,
  names: string[],
): Array<[string, PlatformInstance]> {
  const entries = Object.entries(all)
  if (!entries.length)
    throw new Error(
      'No platforms in kitrrc.ts. Add one with `kitr add web site`, `kitr add server api`, `kitr add desktop app` or `kitr add mobile phone`.',
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
      const child = spawn(command, args, {
        cwd: o.cwd ?? ctx.root,
        stdio: 'inherit',
        env: { ...baseEnv, ...o.env },
        signal: options.signal,
        shell: process.platform === 'win32',
      })
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

/** Load a platform factory: from the project when installed there, else from the CLI's own dependencies. */
export async function loadFactory(
  ctx: ProjectContext,
  type: string,
): Promise<PlatformFactory<any>> {
  const info = platformTypes[type]
  if (!info)
    throw new Error(`Unknown platform type "${type}". Types: ${platformTypeNames.join(', ')}`)
  let mod: Record<string, unknown> | undefined
  try {
    const jiti = await projectJiti(ctx)
    mod = (await jiti.import(info.module)) as Record<string, unknown>
  } catch {
    mod = (await import(info.module)) as Record<string, unknown>
  }
  const factory = mod[info.factory]
  if (typeof factory !== 'function')
    throw new Error(`${info.module} does not export ${info.factory}()`)
  return factory as PlatformFactory<any>
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
  type: string,
  options: Record<string, unknown>,
) {
  const info = platformTypes[type]
  if (!info) throw new Error(`Unknown platform type "${type}"`)
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

export function removeRcPlatform(ctx: ProjectContext, name: string) {
  editRcSource(ctx, (_mod, target) => {
    if (target.platforms) delete target.platforms[name]
  })
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
  const info = platformTypes[add.type]
  if (!info)
    throw new Error(`Unknown platform type "${add.type}". Types: ${platformTypeNames.join(', ')}`)
  if (!/^[a-z][a-z0-9_-]*$/i.test(add.name))
    throw new Error(
      `Platform name "${add.name}" must be a short identifier (site, api, app, phone...)`,
    )
  const factory = await loadFactory(ctx, add.type)
  const instance = factory(add.options ?? {})
  const rc = ctx.readRc()
  codemods.installPackages([info.package, ...(instance.dependencies ?? [])])
  codemods.addPackage(info.package)
  if (instance.definition.provider) codemods.addProvider(instance.definition.provider)
  writeRcPlatform(ctx, add.name, add.type, add.options ?? {})
  for (const recipe of resolveRecipes(instance.definition.requires ?? [], rc.packages)) {
    if (recipe.package && rc.packages.includes(recipe.package)) continue
    await recipe.configure(ctx, codemods)
    log.success(`${recipe.name} (needed by ${add.type})`)
  }
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
export async function runPlatforms(
  ctx: ProjectContext,
  hook: 'dev' | 'build' | 'start' | 'scaffold',
  names: string[],
  flags: Record<string, string | boolean> = {},
  mode: 'parallel' | 'sequential' = hook === 'build' ? 'sequential' : 'parallel',
) {
  const all = await loadPlatforms(ctx)
  const selected = selectPlatforms(all, names)
  const controller = new AbortController()
  const stop = () => controller.abort()
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  const everyInstance = Object.values(all)
  const tasks = selected.map(([name, base]) => {
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
