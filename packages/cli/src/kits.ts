import type { Answers, KitPackage } from '@kitr/core/package'
import type { ProjectContext } from './context'
import { kitManifests } from './manifests.gen'
import { ensureAvailable, loadPackage } from './packages'

/**
 * Kits are packages (`kind: 'kit'`, `@kitr/kit-saas`) the CLI loads the way it loads any setup
 * module. The one exception is `blank`, which is the base files and nothing else, so it needs
 * no package. A kit is a template, not a dependency: `kitr new` runs it once and the project
 * never lists it.
 */
export interface Kit extends KitPackage {
  name: string
  /** The npm package the kit came from; `undefined` for `blank`. */
  package?: string
}

export const blankKit: Kit = {
  name: 'blank',
  description:
    'The wiring files and nothing else: no platform, no React, no server. Add what you need with kitr add.',
  packages: [],
}

/** The kits this CLI ships: `blank` first, then every official kit package. */
export const kitNames: string[] = [blankKit.name, ...Object.keys(kitManifests)]

/** The short names of a kit's packages, in order. */
export const kitPackageNames = (kit: Kit): string[] =>
  kit.packages.map((p) => (typeof p === 'string' ? p : p.name))

/** Pre-filled answers by short name, for `configurePackages`. */
export function kitAnswers(kit: Kit): Record<string, Answers> {
  const out: Record<string, Answers> = {}
  for (const p of kit.packages) if (typeof p !== 'string' && p.answers) out[p.name] = p.answers
  return out
}

/**
 * Load a kit by name: `blank`, an official kit's short name (`saas`) or any npm package that
 * exports a `kind: 'kit'` setup module (`@acme/starter`). An official kit resolves from the
 * CLI's own package; anything else is installed into the project when `install` allows it,
 * and `kitr new` drops it again once the files are written.
 */
export async function loadKit(
  ctx: ProjectContext,
  name: string,
  options: { install: boolean },
): Promise<Kit> {
  if (name === blankKit.name) return blankKit
  const official = kitManifests[name]
  const pkg = official?.package ?? (name.includes('/') ? name : undefined)
  if (!pkg) throw new Error(`Unknown kit "${name}". Kits: ${kitNames.join(', ')}`)
  await ensureAvailable(ctx, pkg, options)
  const loaded = await loadPackage(ctx, pkg)
  const definition = loaded?.definition
  if (!definition?.kit || definition.kind !== 'kit')
    throw new Error(
      `${pkg} is not a kit: its setup module must declare kind: 'kit' and a kit block`,
    )
  return { ...definition.kit, name: definition.name, package: pkg }
}
