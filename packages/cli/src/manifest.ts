/**
 * The `kitr` block a package declares in its package.json. The CLI and kitr.dev both read it,
 * so official and community packages are listed, installed and documented the same way.
 */
export interface KitrManifest {
  /** Short name used by `kitr add <name>`. */
  name: string
  /** Display name on kitr.dev. */
  title: string
  /** One plain sentence on what the package does for your app. No library names. */
  summary: string
  category: KitrCategory
  /** Where the package's code runs. */
  runsOn: 'client' | 'server' | 'both'
  /** Upstream libraries it re-exports or wraps, shown as "Built on" on kitr.dev. */
  builtOn?: string[]
  /** Other kitr packages (short names) that must be added first. */
  requires?: string[]
  /** Needs a React frontend: refused in server-only projects. */
  client?: boolean
  /** Part of every app; not added on its own. */
  included?: boolean
  /** Folder of markdown docs, relative to the package root. */
  docs?: string
  /**
   * The subpath exporting a `defineTypes()` generator that `kitr types` runs: `"./types"` means
   * `<package>/types`. Its files land in the project's `.kitr/` folder.
   */
  types?: string
  /** The setup module's export path (`./kitr`), when the package ships one. */
  setup?: string
}

export const categories = {
  'data-fetching': 'Data fetching',
  'app-state': 'App state',
  backend: 'Backend',
  realtime: 'Real-time',
  interface: 'Interface',
  forms: 'Forms',
  auth: 'Auth',
  pages: 'Pages & routing',
  platforms: 'Platforms',
  device: 'Device features',
  insights: 'Analytics & errors',
  'dev-tools': 'Developer tools',
} as const

export type KitrCategory = keyof typeof categories

/** Problems with a manifest, as human-readable strings. Empty when valid. */
export function validateManifest(m: unknown, known: string[] = []): string[] {
  const errors: string[] = []
  if (!m || typeof m !== 'object') return ['the "kitr" block must be an object']
  const k = m as Record<string, unknown>
  for (const field of ['name', 'title', 'summary'] as const)
    if (typeof k[field] !== 'string' || !(k[field] as string).trim())
      errors.push(`"${field}" must be a non-empty string`)
  if (typeof k.summary === 'string' && k.summary.length > 140)
    errors.push('"summary" must be 140 characters or fewer')
  if (!(typeof k.category === 'string' && k.category in categories))
    errors.push(`"category" must be one of: ${Object.keys(categories).join(', ')}`)
  if (!['client', 'server', 'both'].includes(k.runsOn as string))
    errors.push('"runsOn" must be "client", "server" or "both"')
  for (const field of ['builtOn', 'requires'] as const)
    if (
      k[field] !== undefined &&
      !(Array.isArray(k[field]) && k[field].every((x) => typeof x === 'string'))
    )
      errors.push(`"${field}" must be a list of strings`)
  if (k.types !== undefined && !(typeof k.types === 'string' && k.types.startsWith('./')))
    errors.push('"types" must be a relative subpath such as "./types"')
  if (k.setup !== undefined && k.setup !== './kitr')
    errors.push('"setup" must be "./kitr" (the export the CLI loads)')
  if (known.length && Array.isArray(k.requires))
    for (const dep of k.requires)
      if (!known.includes(dep)) errors.push(`requires unknown package "${dep}"`)
  return errors
}
