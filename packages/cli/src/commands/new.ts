import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { defineCommand } from 'citty'
import { createAddContext } from '../add-context'
import { Codemods } from '../codemods'
import { configurePackages } from '../configure'
import {
  createContext,
  detectPackageManager,
  log,
  type PackageManager,
  projectBin,
} from '../context'
import { kitAnswers, kitNames, kitPackageNames, loadKit } from '../kits'
import { base, writeReadme, writeVscode } from '../kits-base'
import { cliResolve, ensureAvailable } from '../packages'
import { addPlatform, loadFactory, platformTypeNames } from '../platforms'
import { generateTypesQuietly } from '../types'

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
      description: `Starter kit: ${kitNames.join(' | ')}, or a package that exports one`,
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
    targets: { type: 'string', description: 'mobile platform targets: ios,android' },
    port: { type: 'string', description: 'Port for the first platform' },
    pm: { type: 'string', description: 'pnpm | npm | yarn | bun (default: detected)' },
    install: { type: 'boolean', description: 'Install dependencies', default: true },
    git: { type: 'boolean', description: 'git init', default: true },
    vscode: {
      type: 'boolean',
      description: 'Write .vscode/extensions.json recommending the kitr VS Code extension',
      default: true,
    },
    registry: {
      type: 'string',
      description: 'Component registry URL or local path for the kit components',
    },
    force: { type: 'boolean', description: 'Allow a non-empty directory', default: false },
  },
  async run({ args, rawArgs }) {
    if (!kitNames.includes(args.kit) && !args.kit.includes('/'))
      throw new Error(`Unknown kit "${args.kit}". Kits: ${kitNames.join(', ')}`)
    const dir = resolve(args.name)
    if (existsSync(dir) && readdirSync(dir).length && !args.force)
      throw new Error(`${dir} is not empty (use --force)`)
    mkdirSync(dir, { recursive: true })
    const pm = (args.pm as PackageManager | undefined) ?? detectPackageManager(dir)
    const ctx = createContext({ root: dir, pm })
    const projectName = args.name
      .split(/[\\/]/)
      .pop()!
      .replace(/[^a-z0-9-_.]/gi, '-')
      .toLowerCase()
    log.title(`Creating ${projectName} with the ${args.kit} kit`)
    base(ctx, projectName)
    ctx.pkg = JSON.parse(ctx.read('package.json'))
    ctx.rcPath = ctx.path('kitrrc.ts')
    const kit = await loadKit(ctx, args.kit, { install: args.install })
    const codemods = new Codemods(ctx)
    const kitPackages = kitPackageNames(kit)
    const platforms = parsePlatformArg(args.platform) ?? kit.platforms ?? {}
    // What the platforms need (react, router, server...) goes first, so later recipes find app/env.ts and friends.
    const platformRequires: string[] = []
    for (const spec of Object.values(platforms)) {
      // The platform package is an optional peer of `kitr`, so a CLI installed from a registry
      // cannot see it until it is installed into the project.
      await ensureAvailable(ctx, spec.type, { install: args.install })
      platformRequires.push(...((await loadFactory(ctx, spec.type))({}).definition.requires ?? []))
    }
    const added = new Set<string>()
    await configurePackages(ctx, codemods, [...platformRequires, ...kitPackages], {
      install: args.install,
      yes: true,
      added,
      client: Object.values(platforms).some((p) => p.type !== 'server'),
      answers: kitAnswers(kit),
    })
    await codemods.flush({ install: false })
    let first = true
    for (const [name, spec] of Object.entries(platforms)) {
      const options: Record<string, unknown> = { ...spec.options }
      if (spec.type === 'web') {
        if (args.mode) options.mode = args.mode
        if (args.pwa !== undefined) options.pwa = args.pwa
      }
      if (spec.type === 'server' && args.runtime) options.runtime = args.runtime
      if (spec.type === 'mobile' && args.targets) options.targets = args.targets.split(',')
      if (first && args.port) options.port = Number(args.port)
      first = false
      await addPlatform(ctx, codemods, { type: spec.type, name, options })
      log.success(`platform ${name} (${spec.type})`)
      ctx.pkg = JSON.parse(ctx.read('package.json'))
    }
    await codemods.flush({ install: false })
    if (kit.components?.length && kitPackages.includes('theme')) {
      // The registry client lives with the theme package (`kitr ui add`): found next to the CLI in a
      // checkout, in the project once the kit installed it (a CLI from a registry has no @kitr/theme).
      const commands =
        cliResolve('@kitr/theme', 'commands') ??
        (() => {
          try {
            return createRequire(ctx.path('package.json')).resolve('@kitr/theme/commands')
          } catch {}
        })()
      if (!commands)
        throw new Error(
          '@kitr/theme is not available to this CLI, so the kit components cannot be pulled',
        )
      const { addComponents } = (await import(pathToFileURL(commands).href)) as {
        addComponents: (
          ctx: ReturnType<typeof createContext>,
          names: string[],
          options: { registry?: string; overwrite?: boolean; install?: boolean },
        ) => Promise<void>
      }
      await addComponents(ctx, kit.components, { registry: args.registry, overwrite: true })
    }
    if (kit.files) {
      await kit.files(createAddContext(ctx, codemods, {}, added), projectName)
      ctx.pkg = JSON.parse(ctx.read('package.json'))
    }
    // A kit that had to be installed to run is a template, not a dependency: drop it again.
    if (kit.package && kit.package in { ...ctx.pkg.dependencies, ...ctx.pkg.devDependencies })
      codemods.removePackages([kit.package])
    await codemods.flush({ install: false })
    writeReadme(ctx, projectName, args.kit)
    if (args.vscode) writeVscode(ctx)
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
      const biome = projectBin(ctx.root, 'biome')
      if (existsSync(biome)) {
        try {
          execSync(`"${biome}" check --write .`, { cwd: dir, stdio: 'pipe' })
        } catch {}
      }
      await generateTypesQuietly(ctx)
    }
    log.plain('')
    if (args.kit === 'blank' && !rawArgs.some((a) => a === '--kit' || a.startsWith('--kit=')))
      log.plain(
        `Using the blank kit: no platform and no dev server yet. For a web app, run kitr new ${args.name} --kit app, or kitr add web site in this project.`,
      )
    log.success(
      `Ready. Next:\n  cd ${args.name}\n  ${args.install ? '' : `${pm} install\n  `}${pm} ${pm === 'npm' ? 'run ' : ''}dev${Object.keys(platforms).length > 1 ? `   # or: kitr dev ${Object.keys(platforms)[0]}` : ''}\n\nDocs: https://kitr.dev/docs/getting-started\nRun kitr --help for every command.`,
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
