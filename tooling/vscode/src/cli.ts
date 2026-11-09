/**
 * Parsers for what the project's own `kitr` CLI prints. Pure: no VS Code API, no I/O, so the
 * shapes are unit-tested against fixtures copied from real output.
 */

/** `kitr info`: the project summary. */
export interface KitrInfo {
  root: string
  kitr: string
  packageManager: PackageManager
  serverOnly: boolean
  platforms: Record<string, PlatformSpec>
  packages: string[]
  providers: string[]
  directories: Record<string, string>
}

/** One entry of `platforms` in `kitrrc.ts`, as `kitr info` reports it. */
export interface PlatformSpec {
  /** The factory called in kitrrc.ts: `web`, `server`, `desktop`, `tauri`, `mobile`. */
  factory: string
  /** The module the factory comes from: `@kitr/web`. */
  source?: string
  /** The options passed in kitrrc.ts (not the resolved defaults). */
  options?: Record<string, unknown>
}

/** One row of `kitr make --json`. */
export interface GeneratorRow {
  kind: string
  owner: string
  /** Where `make:<kind> <name>` writes: `server/controllers/<name>-controller.ts`. */
  pattern: string
  description: string
  definition?: string
}

/** One finding of `kitr doctor --json`. */
export interface Finding {
  level: 'error' | 'warn' | 'info'
  message: string
  fix?: string
}

/** One line of `kitr routes:list`. */
export interface ApiRoute {
  /** `GET`, `POST`, ..., `WS`, `SSE`. */
  verb: string
  path: string
  name: string
}

/** One line of `kitr platforms`: the platform with its resolved options. */
export interface PlatformRow {
  name: string
  type: string
  options: Record<string, string>
}

export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun'

// ESC [ ... m: the colour codes picocolors writes when NO_COLOR is ignored.
const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

export function stripAnsi(text: string): string {
  return text.replace(ansi, '')
}

/**
 * The JSON document in a command's stdout. Package setup modules may log a line before it, so
 * this takes the span from the first `{` or `[` that parses to the end.
 */
export function extractJson(stdout: string): unknown {
  const text = stripAnsi(stdout).trim()
  try {
    return JSON.parse(text)
  } catch {}
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c !== '{' && c !== '[') continue
    if (i > 0 && text[i - 1] !== '\n') continue
    try {
      return JSON.parse(text.slice(i))
    } catch {}
  }
  throw new Error(`Expected JSON from kitr, got: ${text.slice(0, 200) || '(nothing)'}`)
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []

/** `kitr info` (always JSON; `--json` is accepted and ignored). */
export function parseInfo(stdout: string): KitrInfo {
  const raw = extractJson(stdout)
  if (!isRecord(raw) || typeof raw.kitr !== 'string')
    throw new Error('kitr info printed something that is not a project summary')
  const platforms: Record<string, PlatformSpec> = {}
  if (isRecord(raw.platforms))
    for (const [name, spec] of Object.entries(raw.platforms)) {
      if (!isRecord(spec)) continue
      platforms[name] = {
        factory: typeof spec.factory === 'string' ? spec.factory : '?',
        source: typeof spec.source === 'string' ? spec.source : undefined,
        options: isRecord(spec.options) ? spec.options : undefined,
      }
    }
  const directories: Record<string, string> = {}
  if (isRecord(raw.directories))
    for (const [k, v] of Object.entries(raw.directories))
      if (typeof v === 'string') directories[k] = v
  const pm = raw.packageManager
  return {
    root: typeof raw.root === 'string' ? raw.root : '',
    kitr: raw.kitr,
    packageManager: pm === 'npm' || pm === 'yarn' || pm === 'bun' ? pm : 'pnpm',
    serverOnly: raw.serverOnly === true,
    platforms,
    packages: strings(raw.packages),
    providers: strings(raw.providers),
    directories,
  }
}

/** `kitr make --json`. */
export function parseGenerators(stdout: string): GeneratorRow[] {
  const raw = extractJson(stdout)
  if (!Array.isArray(raw)) throw new Error('kitr make --json did not print a list')
  return raw.filter(isRecord).flatMap((r) =>
    typeof r.kind === 'string'
      ? [
          {
            kind: r.kind,
            owner: typeof r.owner === 'string' ? r.owner : 'kitr',
            pattern: typeof r.pattern === 'string' ? r.pattern : '?',
            description: typeof r.description === 'string' ? r.description : '',
            definition: typeof r.definition === 'string' ? r.definition : undefined,
          },
        ]
      : [],
  )
}

/** `kitr doctor --json`. Doctor exits 1 when it finds errors; the output is still the list. */
export function parseFindings(stdout: string): Finding[] {
  const raw = extractJson(stdout)
  if (!Array.isArray(raw)) throw new Error('kitr doctor --json did not print a list')
  return raw.filter(isRecord).flatMap((f) =>
    typeof f.message === 'string'
      ? [
          {
            level: f.level === 'error' || f.level === 'warn' ? f.level : 'info',
            message: f.message,
            fix: typeof f.fix === 'string' ? f.fix : undefined,
          },
        ]
      : [],
  )
}

/** `kitr routes:list`: `  GET     /api/health                              health`. */
export function parseRoutesList(stdout: string): ApiRoute[] {
  const out: ApiRoute[] = []
  for (const line of stripAnsi(stdout).split(/\r?\n/)) {
    const m = /^\s+([A-Z]+)\s+(\/\S*)\s+(.+?)\s*$/.exec(line)
    if (m) out.push({ verb: m[1]!, path: m[2]!, name: m[3]! })
  }
  return out
}

/** `kitr platforms`: `  site       web      mode=ssr port=3000 pwa=false`. */
export function parsePlatformsList(stdout: string): PlatformRow[] {
  const out: PlatformRow[] = []
  for (const line of stripAnsi(stdout).split(/\r?\n/)) {
    const m = /^ {2}(\S+)\s+([a-z][\w-]*)\s*(.*)$/.exec(line)
    if (!m || m[3]?.startsWith('(')) continue
    const options: Record<string, string> = {}
    for (const pair of (m[3] ?? '').split(/\s+/)) {
      const eq = pair.indexOf('=')
      if (eq > 0) options[pair.slice(0, eq)] = pair.slice(eq + 1)
    }
    out.push({ name: m[1]!, type: m[2]!, options })
  }
  return out
}

/**
 * The file a `make:<kind>` run wrote (`✔ page: app/pages/x.tsx`), or the existing file it
 * refused to overwrite (`⚠ app/pages/x.tsx exists (use --force)`).
 */
export function parseMakeOutput(output: string): { file: string; existed: boolean } | undefined {
  const text = stripAnsi(output)
  const written = /^\S+\s+[\w:-]+: (\S+)\s*$/m.exec(text)
  if (written) return { file: written[1]!, existed: false }
  const exists = /^\S+\s+(\S+) exists \(use --force\)/m.exec(text)
  if (exists) return { file: exists[1]!, existed: true }
  return undefined
}

/**
 * Where a doctor finding points. Findings carry no file field; the ones about a file start
 * with its project-relative path (`app/pages/x.tsx imports ...`, `.kitr/actions.ts is stale`).
 * Everything else is about the wiring, so it lands on kitrrc.ts, on the line naming the
 * package or provider when there is one.
 */
export function findingLocation(finding: Finding): { file?: string; needle?: string } {
  const lead = /^([\w.@-]+(?:\/[\w.@[\]$-]+)+|\.?[\w-]+\.[a-z]{2,4})\s/.exec(finding.message)
  if (lead && lead[1] !== 'kitrrc.ts' && !lead[1]!.startsWith('@')) return { file: lead[1] }
  const named = /(@[\w-]+\/[\w./-]+)/.exec(finding.message) ?? /"([^"\n]+)"/.exec(finding.message)
  return { needle: named?.[1] }
}

/** The 0-based line of the first occurrence of `needle` in `source`, or 0. */
export function lineOf(source: string, needle: string | undefined): number {
  if (!needle) return 0
  const at = source.indexOf(needle)
  return at < 0 ? 0 : source.slice(0, at).split('\n').length - 1
}

/** The package manager from the lockfiles present (nearest first) or `packageManager`. */
export function detectPackageManager(
  files: string[],
  packageManagerField?: string,
): PackageManager {
  const fromField = packageManagerField?.split('@')[0]
  if (fromField === 'pnpm' || fromField === 'npm' || fromField === 'yarn' || fromField === 'bun')
    return fromField
  for (const f of files) {
    if (f === 'pnpm-lock.yaml' || f === 'pnpm-workspace.yaml') return 'pnpm'
    if (f === 'yarn.lock') return 'yarn'
    if (f === 'bun.lock' || f === 'bun.lockb') return 'bun'
    if (f === 'package-lock.json') return 'npm'
  }
  return 'npm'
}

/**
 * How to run the CLI: the configured path, else the project's `node_modules/.bin/kitr`, else
 * the package manager's runner.
 */
export function cliInvocation(options: {
  configured?: string
  localBin?: string
  pm: PackageManager
}): { command: string; args: string[] } {
  if (options.configured) return { command: options.configured, args: [] }
  if (options.localBin) return { command: options.localBin, args: [] }
  switch (options.pm) {
    case 'pnpm':
      return { command: 'pnpm', args: ['exec', 'kitr'] }
    case 'yarn':
      return { command: 'yarn', args: ['kitr'] }
    case 'bun':
      return { command: 'bunx', args: ['kitr'] }
    default:
      return { command: 'npx', args: ['kitr'] }
  }
}

/** Quote one argument for a POSIX shell or PowerShell/cmd when it needs it. */
export function shellQuote(arg: string, windows = false): string {
  if (/^[\w@%+=:,./-]+$/.test(arg)) return arg
  if (!windows) return `'${arg.replace(/'/g, `'\\''`)}'`
  // Windows argv rules: backslashes are literal unless they precede a quote, so double those runs.
  return `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1')}"`
}

/** Short summary of findings: `2 errors, 1 warning`. */
export function summarizeFindings(findings: Finding[]): {
  errors: number
  warnings: number
  text: string
} {
  const errors = findings.filter((f) => f.level === 'error').length
  const warnings = findings.filter((f) => f.level === 'warn').length
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  const text =
    errors || warnings
      ? `${plural(errors, 'error')}, ${plural(warnings, 'warning')}`
      : 'No problems found'
  return { errors, warnings, text }
}
