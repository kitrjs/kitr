import { defineCommand } from 'citty'
import pc from 'picocolors'
import { createAddContext, createProjectInfo } from '../add-context'
import { Codemods } from '../codemods'
import { configurePackages } from '../configure'
import { createContext, type ProjectContext } from '../context'
import { loadPackage, resolvePackageName } from '../packages'
import { parseFlags, platformTypeNames } from '../platforms'
import { describeQuestions } from '../questions'
import { recipeNames, recipes } from '../recipes'
import { generateTypesQuietly } from '../types'
import { addPlatformCommand } from './platforms'

const OWN_FLAGS = new Set(['install', 'dry-run', 'verbose', 'yes', 'y', 'help', 'h'])

/** `kitr add <pkg> --help`: the package's summary and its questions as flags. */
export async function describePackage(name: string): Promise<string> {
  const ctx = createContext()
  const loaded = await loadPackage(ctx, name).catch(() => undefined)
  const lines: string[] = []
  if (loaded) {
    const def = loaded.definition
    lines.push(`${pc.bold(def.name)} (${loaded.package})`)
    if (def.requires?.length) lines.push(`requires: ${def.requires.join(', ')}`)
    const questions =
      typeof def.questions === 'function'
        ? await def.questions(createProjectInfo(ctx))
        : (def.questions ?? [])
    if (questions.length) {
      lines.push('', 'Options (every question is a flag; --yes takes the defaults):')
      for (const l of describeQuestions(questions)) lines.push(`  ${l}`)
    } else lines.push('', `No options: \`kitr add ${def.name}\` asks nothing.`)
    return lines.join('\n')
  }
  const recipe = recipes[name]
  if (recipe) return `${pc.bold(recipe.name)}: ${recipe.description}`
  throw new Error(`Unknown package "${name}"`)
}

export const add = defineCommand({
  meta: {
    name: 'add',
    description:
      "Add kitr packages (`kitr add auth forms`, any npm package that ships a kitr setup module) or a platform (`kitr add web site --mode ssr`). Installs, asks the package's questions (or takes them as flags), registers providers, writes config and stubs.",
  },
  args: {
    packages: {
      type: 'positional',
      description: `A package (${recipeNames.join(', ')}, or @scope/name), or a platform type (${platformTypeNames.join(', ')}) followed by its name`,
      required: true,
    },
    install: {
      type: 'boolean',
      description: 'Run the package manager after editing package.json',
      default: true,
    },
    yes: {
      type: 'boolean',
      alias: 'y',
      description: "Take every question's default instead of prompting",
      default: false,
    },
    'dry-run': { type: 'boolean', description: 'Print what would change', default: false },
    verbose: { type: 'boolean', default: false },
  },
  async run({ args, rawArgs }) {
    const ctx = createContext({ dryRun: args['dry-run'], verbose: args.verbose })
    if (await isPlatformType(ctx, args.packages))
      return addPlatformCommand(args.packages, rawArgs.slice(1), {
        install: args.install,
        dryRun: args['dry-run'],
      })
    const { words, flags } = parseFlags(rawArgs)
    for (const own of OWN_FLAGS) delete flags[own]
    const names = words
    const codemods = new Codemods(ctx)
    ctx.log.title(`Adding ${names.join(', ')}`)
    await configurePackages(ctx, codemods, names, { install: args.install, flags, yes: args.yes })
    await codemods.flush({ install: args.install })
    if (args.install && !ctx.dryRun) await generateTypesQuietly(ctx)
    ctx.log.plain('')
    ctx.log.success(
      `${ctx.dryRun ? 'Would change' : 'Done. Changed'}: ${[...ctx.touched].join(', ') || 'nothing'}`,
    )
    if (names.includes('theme'))
      ctx.log.info('Pull components with `kitr ui add button input form`.')
  },
})

/** A platform type: one of the blessed names, or a package whose setup module says `kind: 'platform'`. */
export async function isPlatformType(ctx: ProjectContext, word: string): Promise<boolean> {
  if (platformTypeNames.includes(word)) return true
  if (recipes[word]) return false
  try {
    const loaded = await loadPackage(ctx, word)
    return loaded?.definition.kind === 'platform'
  } catch {
    return false
  }
}

export const remove = defineCommand({
  meta: {
    name: 'remove',
    description:
      'Remove a kitr package: runs its remove step (provider, config entry, dependency), then lists remaining imports.',
  },
  args: {
    packages: { type: 'positional', required: true },
    install: { type: 'boolean', default: true },
    'dry-run': { type: 'boolean', default: false },
  },
  async run({ args, rawArgs }) {
    const ctx = createContext({ dryRun: args['dry-run'] })
    const names = [args.packages, ...rawArgs.slice(1).filter((a) => !a.startsWith('-'))]
    const codemods = new Codemods(ctx)
    for (const name of names) {
      const pkg = resolvePackageName(name)
      const loaded = await loadPackage(ctx, name).catch(() => undefined)
      const recipe = recipes[name]
      if (!loaded && !recipe) {
        ctx.log.error(`Unknown package "${name}"`)
        continue
      }
      const short = loaded?.name ?? recipe!.name
      if (loaded) {
        await loaded.definition.remove?.(createAddContext(ctx, codemods, {}))
        codemods.removePackage(loaded.package)
        codemods.removePackages([loaded.package])
      } else await recipe!.unconfigure?.(ctx, codemods)
      // kitr owns config/<name>.ts; the package's other files (stubs, routes) stay because the app may have edited them.
      codemods.remove(`${ctx.readRc().directories.config ?? 'config'}/${short}.ts`)
      ctx.log.success(`removed ${short}`)
      const installedPkg = loaded?.package ?? recipe?.package ?? pkg
      if (installedPkg) {
        const { execSync } = await import('node:child_process')
        try {
          const hits = execSync(
            `grep -rl "kitr/${short}\\|${installedPkg}" app config server start 2>/dev/null || true`,
            { cwd: ctx.root },
          )
            .toString()
            .trim()
          if (hits)
            ctx.log.warn(
              `Still imported from:\n${hits
                .split('\n')
                .map((h) => `  ${h}`)
                .join('\n')}`,
            )
        } catch {}
      }
    }
    await codemods.flush({ install: args.install })
  },
})
