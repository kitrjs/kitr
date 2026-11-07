import { defineCommand } from 'citty'
import { Codemods } from '../codemods'
import { createContext } from '../context'
import { recipeNames, recipes, resolveRecipes } from '../recipes'

export const add = defineCommand({
  meta: {
    name: 'add',
    description: 'Add kitr packages: installs deps, registers providers, writes config and stubs.',
  },
  args: {
    packages: {
      type: 'positional',
      description: `One or more of: ${recipeNames.join(', ')}`,
      required: true,
    },
    install: {
      type: 'boolean',
      description: 'Run the package manager after editing package.json',
      default: true,
    },
    'dry-run': { type: 'boolean', description: 'Print what would change', default: false },
    verbose: { type: 'boolean', default: false },
  },
  async run({ args, rawArgs }) {
    const ctx = createContext({ dryRun: args['dry-run'], verbose: args.verbose })
    const names = [args.packages, ...rawArgs.slice(1).filter((a) => !a.startsWith('-'))]
    const installed = ctx.readRc().packages
    const list = resolveRecipes(names, installed)
    const codemods = new Codemods(ctx)
    ctx.log.title(`Adding ${list.map((r) => r.name).join(', ')}`)
    for (const recipe of list) {
      if (recipe.package && installed.includes(recipe.package)) {
        ctx.log.info(`${recipe.name} is already added`)
        continue
      }
      if (recipe.client && ctx.isServerOnly()) {
        ctx.log.warn(`${recipe.name} is a client package; this project is server-only. Skipping.`)
        continue
      }
      await recipe.configure(ctx, codemods)
      ctx.log.success(`${recipe.name}: ${recipe.description}`)
    }
    await codemods.flush({ install: args.install })
    ctx.log.plain('')
    ctx.log.success(
      `${ctx.dryRun ? 'Would change' : 'Done. Changed'}: ${[...ctx.touched].join(', ') || 'nothing'}`,
    )
    if (names.includes('ui')) ctx.log.info('Pull components with `kitr ui add button input form`.')
  },
})

export const remove = defineCommand({
  meta: {
    name: 'remove',
    description:
      'Remove a kitr package: unregisters its provider, config entry and dependency, then lists remaining imports.',
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
      const recipe = recipes[name]
      if (!recipe) {
        ctx.log.error(`Unknown package "${name}"`)
        continue
      }
      await recipe.unconfigure?.(ctx, codemods)
      // kitr owns config/<name>.ts; the recipe's other files (stubs, routes) stay because the app may have edited them.
      codemods.remove(`${ctx.readRc().directories.config ?? 'config'}/${name}.ts`)
      ctx.log.success(`removed ${name}`)
      if (recipe.package) {
        const { execSync } = await import('node:child_process')
        try {
          const hits = execSync(
            `grep -rl "kitr/${name}\\|${recipe.package}" app config start 2>/dev/null || true`,
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
