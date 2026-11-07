import { coerceOption, type PlatformOptionSpec } from '@kitr/core'
import { defineCommand } from 'citty'
import pc from 'picocolors'
import { Codemods } from '../codemods'
import { createContext } from '../context'
import {
  addPlatform,
  loadPlatforms,
  parseFlags,
  platformTypeNames,
  removeRcPlatform,
  resolvePlatformType,
  runPlatforms,
  selectPlatforms,
  setRcPlatformOption,
} from '../platforms'

const hookCommand = (hook: 'dev' | 'build' | 'start', description: string) =>
  defineCommand({
    meta: { name: hook, description },
    args: {
      names: {
        type: 'positional',
        description: 'Platform names from kitrrc.ts (default: all)',
        required: false,
      },
    },
    async run({ rawArgs }) {
      const ctx = createContext()
      const { words, flags } = parseFlags(rawArgs)
      await runPlatforms(ctx, hook, words, flags)
    },
  })

export const dev = hookCommand(
  'dev',
  'Run platforms in development: `kitr dev` (all) or `kitr dev site api --port 4000`.',
)
export const build = hookCommand(
  'build',
  'Build platforms for production into dist/<name>: `kitr build` or `kitr build site`.',
)
export const start = hookCommand(
  'start',
  'Run production builds: `kitr start` or `kitr start api --port 8080`.',
)

export const platforms = defineCommand({
  meta: {
    name: 'platforms',
    description:
      'List the platforms in kitrrc.ts, or `kitr platforms scaffold <name>` to (re)write their files.',
  },
  args: {
    action: { type: 'positional', description: 'scaffold | remove | types', required: false },
    name: { type: 'positional', required: false },
  },
  async run({ args, rawArgs }) {
    const ctx = createContext()
    if (args.action === 'types') {
      for (const type of platformTypeNames) {
        try {
          const info = await resolvePlatformType(ctx, type)
          ctx.log.plain(
            `  ${pc.bold(type.padEnd(9))} ${info.description} ${pc.dim(`(${info.package})`)}`,
          )
        } catch {
          ctx.log.plain(`  ${pc.bold(type.padEnd(9))} ${pc.dim('(not installed)')}`)
        }
      }
      return
    }
    if (args.action === 'scaffold') {
      const { words, flags } = parseFlags(rawArgs.slice(1))
      await runPlatforms(ctx, 'scaffold', words, flags)
      return
    }
    if (args.action === 'remove') {
      if (!args.name) throw new Error('kitr platforms remove <name>')
      const rc = ctx.readRc()
      if (!rc.platforms[args.name]) throw new Error(`No platform named "${args.name}"`)
      removeRcPlatform(ctx, args.name)
      ctx.log.success(
        `removed platforms.${args.name} from kitrrc.ts (files under platforms/${args.name} are yours to delete)`,
      )
      return
    }
    const all = await loadPlatforms(ctx)
    const entries = Object.entries(all)
    if (!entries.length) {
      ctx.log.info(`No platforms yet. Add one: kitr add ${platformTypeNames.join('|')} <name>`)
      return
    }
    for (const [name, p] of entries) {
      const opts = Object.entries(p.options)
        .filter(([, v]) => v !== undefined)
        .map(
          ([k, v]) =>
            `${k}=${Array.isArray(v) ? v.join(',') : typeof v === 'object' ? '{…}' : String(v)}`,
        )
        .join(' ')
      ctx.log.plain(`  ${pc.bold(name.padEnd(10))} ${p.type.padEnd(8)} ${pc.dim(opts)}`)
    }
  },
})

export const config = defineCommand({
  meta: {
    name: 'config',
    description:
      'Read or set a platform option in kitrrc.ts: `kitr config site` lists, `kitr config site port 4000` sets, `--unset` removes.',
  },
  args: {
    name: { type: 'positional', description: 'Platform name', required: true },
    key: { type: 'positional', required: false },
    value: { type: 'positional', required: false },
    unset: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const ctx = createContext()
    const all = await loadPlatforms(ctx, {})
    const [name, instance] = selectPlatforms(all, [args.name])[0]!
    const describe: Record<string, PlatformOptionSpec> = instance.definition.describe ?? {}
    if (!args.key) {
      ctx.log.title(`${name} (${instance.type})`)
      for (const [key, spec] of Object.entries(describe)) {
        const current = (instance.options as Record<string, unknown>)[key]
        const shown =
          current === undefined
            ? pc.dim('unset')
            : Array.isArray(current)
              ? current.join(',')
              : String(current)
        const values = spec.values ? pc.dim(` [${spec.values.join('|')}]`) : ''
        ctx.log.plain(
          `  ${pc.bold(key.padEnd(12))} ${shown.padEnd(14)} ${pc.dim(spec.description)}${values}`,
        )
      }
      ctx.log.plain(
        pc.dim(
          `\n  Override at runtime with KITR_${name.toUpperCase()}_<OPTION>=... or \`kitr dev ${name} --<option> value\`.`,
        ),
      )
      return
    }
    const spec = describe[args.key]
    if (!spec && !(args.key in (instance.options as object)))
      throw new Error(
        `${name} has no option "${args.key}" (options: ${Object.keys(describe).join(', ')})`,
      )
    if (args.unset) {
      instance.with({ [args.key]: undefined })
      setRcPlatformOption(ctx, name, args.key, undefined)
      ctx.log.success(`${name}.${args.key} unset`)
      return
    }
    if (args.value === undefined) throw new Error(`kitr config ${name} ${args.key} <value>`)
    let value: unknown
    try {
      value = spec ? coerceOption(spec, args.value) : JSON.parse(args.value)
    } catch (error) {
      if (!spec) value = args.value
      else throw new Error(`${name}.${args.key}: ${(error as Error).message}`)
    }
    // The platform's own schema decides what is valid.
    instance.with({ [args.key]: value })
    setRcPlatformOption(ctx, name, args.key, value)
    ctx.log.success(`${name}.${args.key} = ${JSON.stringify(value)}`)
  },
})

/** `kitr add web site --mode ssr`: handled by `add` when the first word is a platform type. */
export async function addPlatformCommand(
  type: string,
  rawArgs: string[],
  options: { install: boolean; dryRun: boolean },
) {
  const ctx = createContext({ dryRun: options.dryRun })
  const { words, flags } = parseFlags(rawArgs)
  const info = await resolvePlatformType(ctx, type)
  // `kitr add server` alone takes the usual name for that type (api, site, app, phone).
  const name = words[0] ?? info.defaultName
  if (!words[0]) ctx.log.info(`No name given: calling the ${type} platform "${name}".`)
  const platformOptions: Record<string, unknown> = {}
  const describe = info.factoryFn({}).definition.describe ?? {}
  for (const [key, raw] of Object.entries(flags)) {
    if (key === 'install' || key === 'dry-run' || key === 'scaffold') continue
    const spec = describe[key]
    if (!spec)
      throw new Error(
        `${type} has no option "${key}" (options: ${Object.keys(describe).join(', ')})`,
      )
    platformOptions[key] = typeof raw === 'boolean' ? raw : coerceOption(spec, raw)
  }
  const codemods = new Codemods(ctx)
  ctx.log.title(`Adding platform ${name} (${type})`)
  await addPlatform(ctx, codemods, {
    type,
    name,
    options: platformOptions,
    scaffold: flags.scaffold !== false,
    install: options.install,
  })
  await codemods.flush({ install: options.install })
  ctx.log.success(`${name}: kitr dev ${name} · kitr build ${name} · kitr config ${name}`)
}
