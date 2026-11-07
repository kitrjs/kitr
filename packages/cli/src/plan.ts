import { resolvePackageName, shortPackageName } from '@kitr/core/package'
import type { ProjectContext } from './context'
import { ensureAvailable, isKnown, type LoadedPackage, loadPackage } from './packages'
import { type Recipe, recipeNames, recipes } from './recipes'

/**
 * One package to configure. Either a setup module (`loaded`) or, until every package ships
 * one, a legacy recipe from the CLI. Requirements come first in the list.
 */
export interface PlanStep {
  /** Short name. */
  name: string
  /** Full npm name, when the step installs a package. */
  package?: string
  loaded?: LoadedPackage
  recipe?: Recipe
  client?: boolean
  requires: string[]
}

async function stepFor(
  ctx: ProjectContext,
  name: string,
  options: { install: boolean },
): Promise<PlanStep> {
  const scoped = name.startsWith('@') || name.includes('/')
  const pkg = resolvePackageName(name)
  const short = shortPackageName(pkg)
  // Built-in recipes answer to the short name and to the official `@kitr/<name>` it maps to.
  const recipe = !scoped || resolvePackageName(short) === pkg ? recipes[short] : undefined
  // A setup module wins over a recipe of the same name; recipes are the fallback.
  let loaded: LoadedPackage | undefined
  if (!recipe || isKnown(ctx, name)) {
    if (!recipe) {
      try {
        await ensureAvailable(ctx, name, options)
      } catch (error) {
        if (scoped) throw error
        throw new Error(
          `Unknown package "${name}": no built-in package by that name and ${pkg} could not be loaded (${(error as Error).message}). Known: ${recipeNames.join(', ')}, or any npm package that ships a kitr setup module.`,
        )
      }
    }
    try {
      loaded = await loadPackage(ctx, name)
    } catch (error) {
      if (!recipe) throw error
    }
  }
  if (loaded)
    return {
      name: loaded.name,
      package: loaded.package,
      loaded,
      client: loaded.definition.client,
      requires: loaded.definition.requires ?? [],
    }
  if (recipe)
    return {
      name: recipe.name,
      package: recipe.package,
      recipe,
      client: recipe.client,
      requires: recipe.requires ?? [],
    }
  throw new Error(
    `Unknown package "${name}". Use a short name (${recipeNames.join(', ')}) or a full npm package name.`,
  )
}

/** Steps in dependency order; packages already in kitrrc.ts are not revisited. */
export async function resolvePlan(
  ctx: ProjectContext,
  names: string[],
  installed: string[],
  options: { install: boolean } = { install: true },
): Promise<PlanStep[]> {
  const out: PlanStep[] = []
  const seen = new Set<string>()
  const visit = async (name: string, path: string[]) => {
    const key = shortPackageName(resolvePackageName(name))
    if (seen.has(key)) return
    if (path.includes(key)) throw new Error(`Circular requires: ${[...path, key].join(' → ')}`)
    const step = await stepFor(ctx, name, options)
    seen.add(key)
    for (const dep of step.requires) {
      const depPkg = recipes[dep]?.package ?? resolvePackageName(dep)
      if (!installed.includes(depPkg)) await visit(dep, [...path, key])
    }
    out.push(step)
  }
  for (const n of names) await visit(n, [])
  return out
}
