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
  /** A `platform` is added as `kitr add <name> <platform-name>`; a `kit` by `kitr new --kit`. Default `package`. */
  kind?: 'package' | 'platform' | 'kit'
  /** Folder of markdown docs, relative to the package root. */
  docs?: string
  /**
   * The subpath exporting a `defineTypes()` generator that `kitr types` runs: `"./types"` means
   * `<package>/types`. Its files land in the project's `.kitr/` folder.
   */
  types?: string
  /** The setup module's export path (`./kitr`), when the package ships one. */
  setup?: string
  /** For `kind: 'platform'`: what the platform is, as kitr.dev's /platforms pages show it. */
  platform?: KitrPlatformInfo
}

/**
 * The prose a platform package carries in its `kitr.platform` block. kitr.dev's /platforms pages
 * read it through `kitr catalog --json`, so the text ships with the package it describes.
 */
export interface KitrPlatformInfo {
  /** The short label on the platform's card: `SSR · SPA · PWA`. */
  label: string
  /** One or two sentences on what the platform builds. */
  tagline: string
  /** What it ships to, as chips: `['Windows', 'macOS', 'Linux']`. */
  targets: string[]
  /** What the app runs in: `Electron`, `Capacitor`, `Rust + system webview`. */
  shell: string
  /** The platform's accent colour, as `#RRGGBB`. */
  color: string
  /** The command that adds it to a project: `kitr add web site --mode ssr`. */
  command?: string
  /** The platform type to consider instead, when two do the same job: `tauri` for `desktop`. */
  alternative?: string
  /** Three to five things the platform does, each a title and a sentence or two of markdown. */
  highlights: Array<{ title: string; text: string }>
  /** A short code sample whose first line is the file's path comment: `// kitrrc.ts`. */
  snippet: string
  /** The commands that run it, each with what it does: `['kitr dev site', 'Vite on port 3000']`. */
  run: Array<[command: string, what: string]>
  /** Upstream docs worth reading, each a title, an `https://` URL and one line on why. */
  resources: Array<{ title: string; url: string; text: string }>
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
  kits: 'Kits',
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
  if (k.kind !== undefined && !['package', 'platform', 'kit'].includes(k.kind as string))
    errors.push('"kind" must be "package", "platform" or "kit"')
  if (k.platform !== undefined) {
    if (k.kind !== 'platform') errors.push('"platform" is only for packages with kind "platform"')
    errors.push(...validatePlatformInfo(k.platform).map((e) => `"platform": ${e}`))
    const alternative = (k.platform as { alternative?: unknown } | null)?.alternative
    if (known.length && typeof alternative === 'string' && !known.includes(alternative))
      errors.push(`"platform": "alternative" names unknown package "${alternative}"`)
  }
  if (known.length && Array.isArray(k.requires))
    for (const dep of k.requires)
      if (!known.includes(dep)) errors.push(`requires unknown package "${dep}"`)
  return errors
}

const isText = (v: unknown) => typeof v === 'string' && v.trim() !== ''

/** Problems with a `kitr.platform` block. */
function validatePlatformInfo(p: unknown): string[] {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return ['must be an object']
  const errors: string[] = []
  const v = p as Record<string, unknown>
  for (const field of ['label', 'tagline', 'shell', 'snippet'] as const)
    if (!isText(v[field])) errors.push(`"${field}" must be a non-empty string`)
  for (const field of ['command', 'alternative'] as const)
    if (v[field] !== undefined && !isText(v[field]))
      errors.push(`"${field}" must be a non-empty string`)
  if (!(typeof v.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.color)))
    errors.push('"color" must be a hex colour such as "#38BDF8"')
  if (!(Array.isArray(v.targets) && v.targets.length && v.targets.every(isText)))
    errors.push('"targets" must be a non-empty list of strings')
  const list = (field: string, ok: (item: unknown) => boolean, shape: string) => {
    if (!(Array.isArray(v[field]) && (v[field] as unknown[]).length))
      errors.push(`"${field}" must be a non-empty list of ${shape}`)
    else
      (v[field] as unknown[]).forEach((item, i) => {
        if (!ok(item)) errors.push(`"${field}[${i}]" must be ${shape}`)
      })
  }
  const fields = (item: unknown, keys: string[]) =>
    !!item &&
    typeof item === 'object' &&
    keys.every((key) => isText((item as Record<string, unknown>)[key]))
  list('highlights', (h) => fields(h, ['title', 'text']), '{ title, text }')
  list('run', (r) => Array.isArray(r) && r.length === 2 && r.every(isText), '[command, what]')
  list(
    'resources',
    (r) => fields(r, ['title', 'url', 'text']) && /^https:\/\//.test((r as { url: string }).url),
    '{ title, url, text } with an https:// url',
  )
  return errors
}
