import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineCommand } from 'citty'
import { Codemods } from '../codemods'
import { createContext, detectPackageManager, log, type PackageManager } from '../context'
import { type KitName, kits } from '../kits'
import { resolveRecipes } from '../recipes'
import { addComponents } from './ui'

export const newCommand = defineCommand({
  meta: {
    name: 'new',
    description:
      'Create a kitr app. Every question has a flag, so agents and CI never hit a prompt.',
  },
  args: {
    name: { type: 'positional', description: 'Directory name', required: true },
    kit: {
      type: 'string',
      description: `Starter kit: ${Object.keys(kits).join(' | ')}`,
      default: 'blank',
    },
    pm: { type: 'string', description: 'pnpm | npm | yarn | bun (default: detected)' },
    install: { type: 'boolean', description: 'Install dependencies', default: true },
    git: { type: 'boolean', description: 'git init', default: true },
    registry: {
      type: 'string',
      description: 'Component registry URL or local path for the kit components',
    },
    force: { type: 'boolean', description: 'Allow a non-empty directory', default: false },
  },
  async run({ args }) {
    const kit = kits[args.kit as KitName]
    if (!kit) throw new Error(`Unknown kit "${args.kit}". Kits: ${Object.keys(kits).join(', ')}`)
    const dir = resolve(args.name)
    if (existsSync(dir) && readdirSync(dir).length && !args.force)
      throw new Error(`${dir} is not empty (use --force)`)
    mkdirSync(dir, { recursive: true })
    const pm = (args.pm as PackageManager | undefined) ?? detectPackageManager(dir)
    const ctx = createContext({ root: dir, pm })
    const projectName = args.name
      .split('/')
      .pop()!
      .replace(/[^a-z0-9-_.]/gi, '-')
      .toLowerCase()
    log.title(`Creating ${projectName} with the ${kit.name} kit`)
    kit.base(ctx, projectName)
    ctx.pkg = JSON.parse(ctx.read('package.json'))
    ctx.rcPath = ctx.path('kitrrc.ts')
    const codemods = new Codemods(ctx)
    for (const recipe of resolveRecipes(kit.recipes, [])) {
      await recipe.configure(ctx, codemods)
      log.success(recipe.name)
    }
    await codemods.flush({ install: false })
    if (kit.components?.length && kit.recipes.includes('ui')) {
      await addComponents(ctx, kit.components, { registry: args.registry, overwrite: true })
    }
    if (args.git && !existsSync(ctx.path('.git'))) {
      try {
        execSync('git init -q', { cwd: dir })
      } catch {}
    }
    if (args.install) {
      log.step(`${pm} install`)
      execSync(pm === 'yarn' ? 'yarn' : `${pm} install`, { cwd: dir, stdio: 'inherit' })
      // Kit files are templates; let the project's own Biome format them and sort imports,
      // so a fresh project passes its own `lint` script.
      const biome = ctx.path('node_modules', '.bin', 'biome')
      if (existsSync(biome)) {
        try {
          execSync(`"${biome}" check --write .`, { cwd: dir, stdio: 'pipe' })
        } catch {}
      }
    }
    log.plain('')
    log.success(
      `Ready. Next:\n  cd ${args.name}\n  ${args.install ? '' : `${pm} install\n  `}${pm} ${pm === 'npm' ? 'run ' : ''}dev`,
    )
  },
})
