import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  type PackageDefinition,
  pickPackageDefinition,
  resolvePackageName,
  shortPackageName,
} from '@kitr/core/package'
import type { ProjectContext } from './context'

export { resolvePackageName, shortPackageName }

/**
 * Loading packages' setup modules. A kitr package exports `<package>/kitr`, a `definePackage()`
 * module the CLI runs. It is loaded from the project when installed there; inside this
 * monorepo (and for `kitr new --no-install`) it falls back to the CLI's own resolution, so
 * the examples regenerate without an install.
 */

export interface LoadedPackage {
  /** Full npm name. */
  package: string
  /** The short name the definition declares. */
  name: string
  definition: PackageDefinition
  /** Where it was found. */
  source: 'project' | 'cli'
}

const cache = new WeakMap<ProjectContext, Map<string, Promise<LoadedPackage | undefined>>>()

function cacheFor(ctx: ProjectContext) {
  const existing = cache.get(ctx)
  if (existing) return existing
  const created = new Map<string, Promise<LoadedPackage | undefined>>()
  cache.set(ctx, created)
  return created
}

async function projectJiti(ctx: ProjectContext) {
  const { createJiti } = await import('jiti')
  return createJiti(ctx.rcPath ?? ctx.path('package.json'), { interopDefault: true })
}

/** Is `pkg` resolvable from the project (installed in its node_modules)? */
export function isInstalled(ctx: ProjectContext, pkg: string): boolean {
  try {
    createRequire(ctx.path('package.json')).resolve(`${pkg}/package.json`)
    return true
  } catch {
    return false
  }
}

/**
 * Resolve a module from where the running CLI lives: the `kitr` bin's package (which depends
 * on every official package), then this one. `cliResolve('@kitr/jobs')` finds its setup module.
 */
export function cliResolve(pkg: string, sub = 'kitr'): string | undefined {
  const bases = [process.argv[1], import.meta.url].filter(Boolean) as string[]
  for (const base of bases) {
    try {
      const req = createRequire(base.startsWith('file:') ? base : pathToFileURL(base).href)
      return req.resolve(sub ? `${pkg}/${sub}` : pkg)
    } catch {}
  }
  return undefined
}

function hasKitrExport(ctx: ProjectContext, pkg: string): boolean {
  try {
    const req = createRequire(ctx.path('package.json'))
    const manifest = JSON.parse(readFileSync(req.resolve(`${pkg}/package.json`), 'utf8'))
    return !!manifest.exports?.['./kitr']
  } catch {
    return false
  }
}

/**
 * Load a package's definition by short or full name. `undefined` when the package exists but
 * has no `./kitr` export (a legacy recipe may still handle it); throws when it cannot be
 * found anywhere.
 */
export function loadPackage(ctx: ProjectContext, name: string): Promise<LoadedPackage | undefined> {
  const pkg = resolvePackageName(name)
  const m = cacheFor(ctx)
  let p = m.get(pkg)
  if (!p) {
    p = load(ctx, pkg)
    m.set(pkg, p)
  }
  return p
}

async function load(ctx: ProjectContext, pkg: string): Promise<LoadedPackage | undefined> {
  if (isInstalled(ctx, pkg)) {
    if (!hasKitrExport(ctx, pkg)) return undefined
    const jiti = await projectJiti(ctx)
    const mod = await jiti.import(`${pkg}/kitr`)
    const definition = pickPackageDefinition(mod)
    if (!definition) throw new Error(`${pkg}/kitr does not export a definePackage() definition`)
    return { package: pkg, name: definition.name, definition, source: 'project' }
  }
  const fromCli = cliResolve(pkg)
  if (!fromCli) return undefined
  const mod = await import(pathToFileURL(fromCli).href)
  const definition = pickPackageDefinition(mod)
  if (!definition) throw new Error(`${pkg}/kitr does not export a definePackage() definition`)
  return { package: pkg, name: definition.name, definition, source: 'cli' }
}

/** Is the package findable at all (project or CLI), with or without a setup module? */
export function isKnown(ctx: ProjectContext, name: string): boolean {
  const pkg = resolvePackageName(name)
  return isInstalled(ctx, pkg) || !!cliResolve(pkg) || cliHasPackage(pkg)
}

function cliHasPackage(pkg: string): boolean {
  for (const base of [process.argv[1], import.meta.url].filter(Boolean) as string[]) {
    try {
      createRequire(base.startsWith('file:') ? base : pathToFileURL(base).href).resolve(
        `${pkg}/package.json`,
      )
      return true
    } catch {}
  }
  return false
}

/**
 * Make sure `pkg` can be loaded: install it into the project when it is not resolvable from
 * the project or the CLI. With `install: false` that is an error naming the flag.
 */
export async function ensureAvailable(
  ctx: ProjectContext,
  name: string,
  options: { install: boolean },
): Promise<void> {
  const pkg = resolvePackageName(name)
  if (isInstalled(ctx, pkg) || cliResolve(pkg) || cliHasPackage(pkg)) return
  if (!options.install || ctx.dryRun) {
    if (ctx.dryRun) return
    throw new Error(
      `${pkg} is not installed and --no-install was given. Install it first: ${ctx.pm} add ${pkg}`,
    )
  }
  const spec = pkg.startsWith('@kitr/') ? `${pkg}@^${ctx.kitrVersion}` : pkg
  const cmd = `${ctx.pm} add ${spec}`
  ctx.log.step(cmd)
  try {
    execSync(cmd, { cwd: ctx.root, stdio: ctx.verbose ? 'inherit' : 'pipe' })
  } catch (error) {
    throw new Error(
      `${cmd} failed: ${(error as { stderr?: Buffer }).stderr?.toString().trim().split('\n').pop() ?? (error as Error).message}`,
    )
  }
  ctx.pkg = JSON.parse(ctx.read('package.json'))
  cacheFor(ctx).delete(pkg)
}

/** Every package in kitrrc.ts `packages` that has a setup module. */
export async function installedPackages(ctx: ProjectContext): Promise<LoadedPackage[]> {
  const out: LoadedPackage[] = []
  for (const pkg of ctx.readRc().packages) {
    try {
      const loaded = await loadPackage(ctx, pkg)
      if (loaded) out.push(loaded)
    } catch (error) {
      if (ctx.verbose) ctx.log.warn(`${pkg}: ${(error as Error).message}`)
    }
  }
  return out
}

/** The directory a resolved module lives in, for messages. */
export function packageDir(ctx: ProjectContext, pkg: string): string | undefined {
  try {
    return dirname(createRequire(ctx.path('package.json')).resolve(`${pkg}/package.json`))
  } catch {
    return undefined
  }
}
