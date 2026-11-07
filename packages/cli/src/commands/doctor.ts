import { existsSync, readFileSync } from 'node:fs'
import { defineCommand } from 'citty'
import pc from 'picocolors'
import { createProjectInfo } from '../add-context'
import { createContext, type ProjectContext } from '../context'
import { installedPackages } from '../packages'
import { createPlatformContext, loadPlatforms, platformTypes } from '../platforms'
import { recipes } from '../recipes'
import { runTypes } from '../types'
import { versions } from '../versions'

export interface Finding {
  level: 'error' | 'warn' | 'info'
  message: string
  fix?: string
}

/** Every check kitr knows how to run on a project. Each is pure: it reads, it never writes. */
export function runChecks(ctx: ProjectContext): Finding[] {
  const out: Finding[] = []
  const rc = ctx.readRc()
  const deps: Record<string, string> = { ...ctx.pkg.dependencies, ...ctx.pkg.devDependencies }
  const serverOnly = ctx.isServerOnly()

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

  // Legacy recipes that need a config file should have one. Packages with a setup module check themselves.
  for (const name of rc.packages) {
    const short = name.replace('@kitr/', '')
    const recipe = recipes[short]
    if (!recipe) continue
    if (
      !ctx.exists(rc.directories.config ?? 'config', `${short}.ts`) &&
      ![
        'react',
        'router',
        'actions',
        'testing',
        'mocks',
        'table',
        'state',
        'forms',
        'web',
        'mobile',
        'desktop',
      ].includes(short)
    ) {
      out.push({
        level: 'warn',
        message: `config/${short}.ts is missing`,
        fix: `kitr add ${short}`,
      })
    }
  }

  // Direct upstream imports where a kitr entry exists.
  const upstream: Record<string, string> = {
    '@tanstack/react-router': 'kitr/router',
    '@tanstack/react-query': 'kitr/query',
    '@tanstack/react-start': 'kitr/actions',
    'react-hook-form': 'kitr/forms',
    '@tanstack/react-table': 'kitr/table',
    zustand: 'kitr/state',
    ky: 'kitr/http',
    h3: 'kitr/server',
    'react-i18next': 'kitr/i18n',
  }
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

  // Server-only guard: React must not be present.
  if (serverOnly) {
    for (const name of [
      'react',
      'react-dom',
      '@kitr/react',
      '@kitr/router',
      '@kitr/query',
      '@kitr/theme',
      '@kitr/forms',
    ]) {
      if (name in deps)
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

  // Platforms: each one's package must be installed; a UI app needs at least one UI platform.
  const platformNames = Object.keys(rc.platforms)
  for (const [name, p] of Object.entries(rc.platforms)) {
    const info = platformTypes[p.factory]
    if (info && !(info.package in deps))
      out.push({
        level: 'error',
        message: `platform ${name} needs ${info.package}`,
        fix: `${ctx.pm} add ${info.package}`,
      })
    if (info && !rc.packages.includes(info.package))
      out.push({
        level: 'warn',
        message: `${info.package} (platform ${name}) is not listed in kitrrc.ts packages`,
        fix: `kitr add ${p.factory} ${name}`,
      })
  }
  if (!platformNames.length)
    out.push({
      level: serverOnly || 'react' in deps ? 'error' : 'info',
      message: 'kitrrc.ts has no platforms, so `kitr dev` has nothing to run',
      fix: serverOnly
        ? 'kitr add server api'
        : 'kitr add web site (or desktop app, mobile phone, server api)',
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
export async function packageChecks(ctx: ProjectContext): Promise<Finding[]> {
  const out: Finding[] = []
  const info = createProjectInfo(ctx)
  for (const loaded of await installedPackages(ctx)) {
    if (!loaded.definition.doctor) continue
    try {
      out.push(...(await loaded.definition.doctor(info)))
    } catch (error) {
      out.push({
        level: 'error',
        message: `${loaded.name}: doctor failed: ${(error as Error).message}`,
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

/** Generated types under `.kitr/` must match what the generators produce now. */
export async function typesChecks(ctx: ProjectContext): Promise<Finding[]> {
  try {
    const result = await runTypes(ctx, { check: true, quiet: true })
    return result.stale.map((file) => ({
      level: 'warn' as const,
      message: `${file} is stale`,
      fix: 'kitr types',
    }))
  } catch (error) {
    return [{ level: 'error', message: `kitr types failed: ${(error as Error).message}` }]
  }
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
    const findings = runChecks(ctx)
    findings.push(...(await packageChecks(ctx)))
    findings.push(...(await platformChecks(ctx)))
    findings.push(...(await typesChecks(ctx)))
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
