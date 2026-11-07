import type { Codemods } from './codemods'
import type { ProjectContext } from './context'
import { manifests } from './manifests.gen'

export interface Recipe {
  name: string
  /** npm package this recipe installs, if any (recipes without one are setup-only). */
  package?: string
  description: string
  /** Other recipes that must be present first. */
  requires?: string[]
  /** Client-side recipe: refused in server-only projects. */
  client?: boolean
  configure(ctx: ProjectContext, codemods: Codemods): void | Promise<void>
  unconfigure?(ctx: ProjectContext, codemods: Codemods): void | Promise<void>
}

/** A recipe's description, requires and client flag come from its package's `kitr` block when it has one. */
export const r = (recipe: Recipe): Recipe => {
  const m = manifests[recipe.name]
  if (!m) return recipe
  return {
    ...recipe,
    description: m.summary,
    ...(m.requires?.length ? { requires: m.requires } : {}),
    ...(m.client ? { client: true } : {}),
  }
}
