import { resolvePackageName, shortPackageName } from '@kitr/core/package'
import type { ProjectContext } from './context'
import { manifests } from './manifests.gen'
import { ensureAvailable, type LoadedPackage, loadPackage } from './packages'
import { assertReleased, isPreview } from './preview'

/** The short names of the official packages, for messages. */
export const knownPackageNames = Object.keys(manifests).filter(
  (n) => !manifests[n]!.included && !isPreview(n),
)

/** One package to configure: its loaded setup module. Requirements come first in the list. */
export interface PlanStep {
  /** Short name. */
  name: string
  /** Full npm name. */
  package: string
  loaded: LoadedPackage
  client?: boolean
  requires: string[]
}

async function stepFor(
  ctx: ProjectContext,
  name: string,
  options: { install: boolean },
): Promise<PlanStep> {
  const pkg = resolvePackageName(name)
  assertReleased(name)
  try {
    await ensureAvailable(ctx, name, options)
  } catch (error) {
    if (name.startsWith('@') || name.includes('/')) throw error
    throw new Error(
      `Unknown package "${name}": ${pkg} could not be loaded (${(error as Error).message}). Known: ${knownPackageNames.join(', ')}, or any npm package that ships a kitr setup module.`,
    )
  }
  const loaded = await loadPackage(ctx, name)
  if (!loaded)
    throw new Error(
      `${pkg} is not a kitr package: it has no "./kitr" export (a definePackage() setup module). Install it with ${ctx.pm} add ${pkg} and wire it by hand.`,
    )
  return {
    name: loaded.name,
    package: loaded.package,
    loaded,
    client: loaded.definition.client,
    requires: loaded.definition.requires ?? [],
  }
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
    for (const dep of step.requires)
      if (!installed.includes(resolvePackageName(dep))) await visit(dep, [...path, key])
    out.push(step)
  }
  for (const n of names) await visit(n, [])
  return out
}
