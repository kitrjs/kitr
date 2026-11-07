import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineCommand } from 'citty'
import { Codemods } from '../codemods'
import { createContext, detectPackageManager, log, type PackageManager } from '../context'
import { type KitName, kits } from '../kits'
import { addPlatform, loadFactory, platformTypeNames } from '../platforms'
import { resolveRecipes } from '../recipes'
import { generateTypesQuietly } from '../types'
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
    platform: {
      type: 'string',
      description: `Platforms as name=type pairs, replacing the kit's: --platform site=web,api=server (types: ${platformTypeNames.join(', ')})`,
    },
    mode: { type: 'string', description: 'web platform mode: static | spa | ssr' },
    pwa: { type: 'boolean', description: 'web platform: installable (manifest + service worker)' },
    runtime: {
      type: 'string',
      description: 'server platform runtime: node | bun | deno | workers',
    },
    shell: { type: 'string', description: 'desktop platform shell: tauri | electron' },
    targets: { type: 'string', description: 'mobile platform targets: ios,android' },
    port: { type: 'string', description: 'Port for the first platform' },
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
    const platforms = parsePlatformArg(args.platform) ?? kit.platforms ?? {}
    // What the platforms need (react, router, server...) goes first, so later recipes find app/env.ts and friends.
    const platformRequires: string[] = []
    for (const spec of Object.values(platforms))
      platformRequires.push(...((await loadFactory(ctx, spec.type))({}).definition.requires ?? []))
    for (const recipe of resolveRecipes([...platformRequires, ...kit.recipes], [])) {
      await recipe.configure(ctx, codemods)
      log.success(recipe.name)
    }
    await codemods.flush({ install: false })
    let first = true
    for (const [name, spec] of Object.entries(platforms)) {
      const options: Record<string, unknown> = { ...spec.options }
      if (spec.type === 'web') {
        if (args.mode) options.mode = args.mode
        if (args.pwa !== undefined) options.pwa = args.pwa
      }
      if (spec.type === 'server' && args.runtime) options.runtime = args.runtime
      if (spec.type === 'desktop' && args.shell) options.shell = args.shell
      if (spec.type === 'mobile' && args.targets) options.targets = args.targets.split(',')
      if (first && args.port) options.port = Number(args.port)
      first = false
      await addPlatform(ctx, codemods, { type: spec.type, name, options })
      log.success(`platform ${name} (${spec.type})`)
      ctx.pkg = JSON.parse(ctx.read('package.json'))
    }
    await codemods.flush({ install: false })
    if (kit.components?.length && kit.recipes.includes('theme')) {
      await addComponents(ctx, kit.components, { registry: args.registry, overwrite: true })
    }
    await kit.extra?.(ctx, projectName)
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
      await generateTypesQuietly(ctx)
    }
    log.plain('')
    log.success(
      `Ready. Next:\n  cd ${args.name}\n  ${args.install ? '' : `${pm} install\n  `}${pm} ${pm === 'npm' ? 'run ' : ''}dev${Object.keys(platforms).length > 1 ? `   # or: kitr dev ${Object.keys(platforms)[0]}` : ''}`,
    )
  },
})

/** `site=web,api=server` → { site: { type: 'web' }, api: { type: 'server' } }. */
function parsePlatformArg(value: string | undefined) {
  if (!value) return undefined
  const out: Record<string, { type: string; options?: Record<string, unknown> }> = {}
  for (const pair of value.split(',')) {
    const [name, type] = pair.split('=').map((s) => s.trim())
    if (!name || !type) throw new Error(`--platform expects name=type pairs, got "${pair}"`)
    if (!platformTypeNames.includes(type))
      throw new Error(`Unknown platform type "${type}" (types: ${platformTypeNames.join(', ')})`)
    out[name] = { type }
  }
  return out
}
