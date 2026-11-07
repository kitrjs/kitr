import { existsSync, readFileSync } from 'node:fs'
import { defineCommand } from 'citty'
import pc from 'picocolors'
import { createProjectInfo } from '../add-context'
import { createContext, type ProjectContext } from '../context'
import { installedPackages, type LoadedPackage } from '../packages'
import { createPlatformContext, loadPlatforms } from '../platforms'
import { versions } from '../versions'

export interface Finding {
  level: 'error' | 'warn' | 'info'
  message: string
  fix?: string
}

/**
 * Every check kitr knows how to run on a project. Each is pure: it reads, it never writes.
 * `loaded` is the setup module of every package in kitrrc.ts; what they declare (`client`,
 * `wraps`) drives the checks, so the core names no package.
 */
export function runChecks(ctx: ProjectContext, loaded: LoadedPackage[] = []): Finding[] {
  const out: Finding[] = []
  const rc = ctx.readRc()
  const deps: Record<string, string> = { ...ctx.pkg.dependencies, ...ctx.pkg.devDependencies }
  const serverOnly = ctx.isServerOnly()
  const definitions = new Map(loaded.map((l) => [l.package, l.definition]))

  if (!ctx.rcPath)
    out.push({
      level: 'error',
      message: 'No kitrrc.ts found',
      fix: 'Run `kitr new` in an empty folder, or create kitrrc.ts with defineKitrConfig({ packages: [], providers: [] })',
    })
  if (!('kitr' in deps))
    out.push({ level: 'error', message: '`kitr` is not a dependency', fix: `${ctx.pm} add kitr` })

  // Packages listed in kitrrc.ts must be installed, and installed @kitr/* packages should be listed.
  for (const name of rc.packages) {
    if (!(name in deps))
      out.push({
        level: 'error',
        message: `${name} is listed in kitrrc.ts but not in package.json`,
        fix: `${ctx.pm} add ${name}`,
      })
  }
  for (const name of Object.keys(deps)) {
    if (
      name.startsWith('@kitr/') &&
      !['@kitr/cli', '@kitr/core', '@kitr/vite', '@kitr/testing'].includes(name) &&
      !rc.packages.includes(name)
    ) {
      out.push({
        level: 'warn',
        message: `${name} is installed but not listed in kitrrc.ts packages`,
        fix: `kitr add ${name.replace('@kitr/', '')}`,
      })
    }
  }

  // Providers must resolve to an installed package.
  for (const spec of rc.providers) {
    const pkgName = spec.startsWith('@')
      ? spec.split('/').slice(0, 2).join('/')
      : spec.startsWith('.') || spec.startsWith('#')
        ? null
        : spec.split('/')[0]!
    if (pkgName && !(pkgName in deps))
      out.push({
        level: 'error',
        message: `provider "${spec}" points at ${pkgName}, which is not installed`,
        fix: `${ctx.pm} add ${pkgName}`,
      })
    if (spec.startsWith('.') || spec.startsWith('#')) {
      const rel = spec.replace(/^#app\//, `${rc.directories.app ?? 'app'}/`).replace(/^\.\//, '')
      if (!['', '.ts', '.tsx', '/index.ts'].some((ext) => ctx.exists(`${rel}${ext}`)))
        out.push({ level: 'error', message: `provider "${spec}" file does not exist` })
    }
  }

  // Direct upstream imports where a kitr entry exists: each package declares what it wraps.
  const upstream: Record<string, string> = {}
  for (const def of definitions.values()) Object.assign(upstream, def.wraps)
  const appDir = ctx.path(rc.directories.app ?? 'app')
  if (existsSync(appDir)) {
    for (const file of walk(appDir)) {
      if (!/\.(ts|tsx)$/.test(file) || file.endsWith('.gen.ts')) continue
      const src = readFileSync(file, 'utf8')
      const isRouteFile = file.includes(`/${rc.directories.routes ?? 'app/routes'}/`)
      for (const [lib, entry] of Object.entries(upstream)) {
        if (!new RegExp(`from ['"]${lib}['"]`).test(src)) continue
        // The route generator owns `createFileRoute` imports from @tanstack/react-router in route files.
        if (isRouteFile && lib === '@tanstack/react-router' && onlyRouteCreators(src)) continue
        out.push({
          level: 'warn',
          message: `${rel(ctx, file)} imports ${lib} directly`,
          fix: `import from '${entry}' instead; it re-exports ${lib} unchanged`,
        })
      }
      if (/queryClient\.invalidateQueries\(/.test(src) && !file.includes('/providers/'))
        out.push({
          level: 'info',
          message: `${rel(ctx, file)} invalidates inline; prefer \`effects\` on defineMutation/defineAction`,
        })
    }
  }

  // Server-only guard: React, and any package that needs it, must not be present.
  if (serverOnly) {
    for (const name of Object.keys(deps)) {
      const client = name === 'react' || name === 'react-dom' || definitions.get(name)?.client
      if (client)
        out.push({
          level: 'error',
          message: `server-only project depends on ${name}`,
          fix: `${ctx.pm} remove ${name}`,
        })
    }
  } else {
    if (!('react' in deps))
      out.push({
        level: 'error',
        message: 'react is not installed',
        fix: `${ctx.pm} add react react-dom`,
      })
    if (ctx.exists('app/routeTree.gen.ts') === false && ctx.exists('app/routes'))
      out.push({
        level: 'info',
        message: 'app/routeTree.gen.ts not generated yet',
        fix: `${ctx.pm} dev (TanStack Router writes it on first start)`,
      })
    if (ctx.exists('vite.config.ts') && !ctx.read('vite.config.ts').includes('kitr/vite'))
      out.push({
        level: 'warn',
        message: 'vite.config.ts does not use the kitr() plugin',
        fix: "import { kitr } from 'kitr/vite' and add kitr() to plugins",
      })
  }

  // Platforms: each one's package (what kitrrc.ts imports the factory from) must be installed and listed.
  const platformNames = Object.keys(rc.platforms)
  for (const [name, p] of Object.entries(rc.platforms)) {
    const pkg = platformPackage(p.source)
    if (!pkg) continue
    if (!(pkg in deps))
      out.push({
        level: 'error',
        message: `platform ${name} needs ${pkg}`,
        fix: `${ctx.pm} add ${pkg}`,
      })
    if (!rc.packages.includes(pkg))
      out.push({
        level: 'warn',
        message: `${pkg} (platform ${name}) is not listed in kitrrc.ts packages`,
        fix: `kitr add ${p.factory} ${name}`,
      })
  }
  if (!platformNames.length)
    out.push({
      level: serverOnly || 'react' in deps ? 'error' : 'info',
      message: 'kitrrc.ts has no platforms, so `kitr dev` has nothing to run',
      fix: serverOnly
        ? 'kitr add server api'
        : 'kitr add web site (`kitr platforms types` lists the rest)',
    })
  else if (
    !serverOnly &&
    'react' in deps &&
    !Object.values(rc.platforms).some((p) => p.factory !== 'server')
  )
    out.push({
      level: 'warn',
      message: 'React is installed but no UI platform is listed',
      fix: 'kitr add web site',
    })
  if (
    Object.values(rc.platforms).some((p) => p.factory === 'server') &&
    !ctx.exists('server/main.ts')
  )
    out.push({
      level: 'error',
      message: 'server/main.ts is missing',
      fix: 'kitr platforms scaffold <server platform name>',
    })

  // Version drift against the blessed set.
  for (const [name, wanted] of Object.entries(versions)) {
    const have = deps[name]
    if (!have || have.startsWith('workspace:') || have === 'latest') continue
    const majorHave = have.replace(/^[\^~>=<\s]+/, '').split('.')[0]
    const majorWant = wanted.replace(/^[\^~>=<\s]+/, '').split('.')[0]
    if (majorHave !== majorWant)
      out.push({
        level: 'warn',
        message: `${name}@${have} differs in major from the version kitr ${ctx.kitrVersion} is tested with (${wanted})`,
        fix: 'kitr upgrade',
      })
  }

  // Kitr version consistency.
  const kitrVersions = new Set(
    Object.entries(deps)
      .filter(([n]) => n === 'kitr' || n.startsWith('@kitr/'))
      .map(([, v]) => v),
  )
  if (kitrVersions.size > 1)
    out.push({
      level: 'warn',
      message: `kitr packages are on different versions: ${[...kitrVersions].join(', ')}`,
      fix: 'kitr upgrade',
    })

  if (!ctx.exists('AGENTS.md'))
    out.push({
      level: 'info',
      message: 'No AGENTS.md; `kitr add` writes one so coding agents follow the conventions',
    })
  return out
}

/** Each installed package's own `doctor` hook. */
export async function packageChecks(
  ctx: ProjectContext,
  loaded?: LoadedPackage[],
): Promise<Finding[]> {
  const out: Finding[] = []
  const info = createProjectInfo(ctx)
  for (const pkg of loaded ?? (await installedPackages(ctx))) {
    if (!pkg.definition.doctor) continue
    try {
      out.push(...(await pkg.definition.doctor(info)))
    } catch (error) {
      out.push({
        level: 'error',
        message: `${pkg.name}: doctor failed: ${(error as Error).message}`,
      })
    }
  }
  return out
}

/** Each platform's own `doctor` hook, run with the real instances from kitrrc.ts. */
export async function platformChecks(ctx: ProjectContext): Promise<Finding[]> {
  const out: Finding[] = []
  let all: Awaited<ReturnType<typeof loadPlatforms>>
  try {
    all = await loadPlatforms(ctx)
  } catch (error) {
    return [
      { level: 'error', message: `kitrrc.ts could not be loaded: ${(error as Error).message}` },
    ]
  }
  const instances = Object.values(all)
  for (const [name, instance] of Object.entries(all)) {
    if (!instance.doctor) continue
    try {
      out.push(
        ...(await instance.doctor(
          createPlatformContext(ctx, name, instance, { platforms: instances }),
        )),
      )
    } catch (error) {
      out.push({ level: 'error', message: `${name}: doctor failed: ${(error as Error).message}` })
    }
  }
  return out
}

/** `kitr/web` → `@kitr/web`; `@acme/shell` or `@acme/shell/platform` → `@acme/shell`; a relative path → none. */
function platformPackage(source: string | undefined): string | undefined {
  if (!source || source.startsWith('.') || source.startsWith('#')) return undefined
  if (source.startsWith('kitr/')) return `@kitr/${source.split('/')[1]}`
  return source.startsWith('@') ? source.split('/').slice(0, 2).join('/') : source.split('/')[0]
}

const ROUTE_CREATORS = new Set([
  'createFileRoute',
  'createLazyFileRoute',
  'createRootRoute',
  'createRootRouteWithContext',
])
/** True when every `@tanstack/react-router` import in the file is a route creator. */
function onlyRouteCreators(src: string) {
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]@tanstack\/react-router['"]/g)) {
    const names = m[1]!
      .split(',')
      .map(
        (n) =>
          n
            .trim()
            .replace(/^type\s+/, '')
            .split(/\s+as\s+/)[0]!,
      )
      .filter(Boolean)
    if (names.some((n) => !ROUTE_CREATORS.has(n))) return false
  }
  return true
}

function* walk(dir: string): Generator<string> {
  const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs')
  for (const entry of readdirSync(dir)) {
    const full = `${dir}/${entry}`
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    if (statSync(full).isDirectory()) yield* walk(full)
    else yield full
  }
}

function rel(ctx: ProjectContext, file: string) {
  return file.startsWith(ctx.root) ? file.slice(ctx.root.length + 1) : file
}

export const doctor = defineCommand({
  meta: {
    name: 'doctor',
    description:
      'Check the project: kitrrc.ts vs package.json, providers, config files, upstream imports, version drift.',
  },
  args: {
    json: { type: 'boolean', description: 'Print findings as JSON', default: false },
    strict: { type: 'boolean', description: 'Exit non-zero on warnings too', default: false },
  },
  async run({ args }) {
    const ctx = createContext()
    const loaded = await installedPackages(ctx)
    const findings = runChecks(ctx, loaded)
    findings.push(...(await packageChecks(ctx, loaded)))
    findings.push(...(await platformChecks(ctx)))
    if (args.json) {
      console.log(JSON.stringify(findings, null, 2))
    } else {
      ctx.log.title(`kitr doctor (${ctx.root})`)
      if (!findings.length) ctx.log.success('No problems found')
      for (const f of findings) {
        const icon =
          f.level === 'error' ? pc.red('✖') : f.level === 'warn' ? pc.yellow('⚠') : pc.cyan('ℹ')
        console.log(`${icon} ${f.message}${f.fix ? pc.dim(`\n    fix: ${f.fix}`) : ''}`)
      }
      const errors = findings.filter((f) => f.level === 'error').length
      const warns = findings.filter((f) => f.level === 'warn').length
      ctx.log.plain('')
      ctx.log.plain(pc.dim(`${errors} error(s), ${warns} warning(s)`))
    }
    const bad = findings.some((f) => f.level === 'error' || (args.strict && f.level === 'warn'))
    if (bad) process.exitCode = 1
  },
})
