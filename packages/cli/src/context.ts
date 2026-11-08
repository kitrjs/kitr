import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import pc from 'picocolors'

export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun'

export interface ProjectContext {
  root: string
  pm: PackageManager
  rcPath: string | undefined
  pkg: Record<string, any>
  dryRun: boolean
  verbose: boolean
  /** Written files, for the summary. */
  touched: Set<string>
  log: typeof log
  path(...parts: string[]): string
  exists(...parts: string[]): boolean
  read(...parts: string[]): string
  write(path: string, content: string, options?: { overwrite?: boolean }): boolean
  readRc(): RcInfo
  isServerOnly(): boolean
  kitrVersion: string
}

export interface RcInfo {
  packages: string[]
  providers: string[]
  directories: Record<string, string>
  /** `platforms: { site: web({...}) }`, read statically: the key and the factory it calls. */
  platforms: Record<string, RcPlatform>
}

export interface RcPlatform {
  /** The factory called (`web`, `server`...), by its exported name: the platform type for kitr's packages. */
  factory: string
  /** The name the factory is called by in kitrrc.ts, when the import renames it (`web as webPlatform`). */
  local?: string
  /** Where the factory is imported from, when it is (`@kitr/web`). */
  source?: string
  /** Literal options, when they parse as JSON-ish; otherwise undefined. */
  options?: Record<string, unknown>
}

// kitr-allow-module-state: CLI logger, stateless functions
export const log = {
  info: (msg: string) => console.log(`${pc.cyan('ℹ')} ${msg}`),
  success: (msg: string) => console.log(`${pc.green('✔')} ${msg}`),
  warn: (msg: string) => console.log(`${pc.yellow('⚠')} ${msg}`),
  error: (msg: string) => console.error(`${pc.red('✖')} ${msg}`),
  step: (msg: string) => console.log(`${pc.dim('→')} ${msg}`),
  title: (msg: string) => console.log(`\n${pc.bold(msg)}`),
  plain: (msg: string) => console.log(msg),
}

export function detectPackageManager(root: string): PackageManager {
  if (existsSync(join(root, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(root, 'bun.lock')) || existsSync(join(root, 'bun.lockb'))) return 'bun'
  if (existsSync(join(root, 'yarn.lock'))) return 'yarn'
  if (existsSync(join(root, 'package-lock.json'))) return 'npm'
  const ua = process.env.npm_config_user_agent ?? ''
  if (ua.startsWith('pnpm')) return 'pnpm'
  if (ua.startsWith('bun')) return 'bun'
  if (ua.startsWith('yarn')) return 'yarn'
  return 'pnpm'
}

export function findRcPath(root: string): string | undefined {
  for (const name of ['kitrrc.ts', 'kitrrc.mts', 'kitrrc.js', 'kitrrc.mjs'])
    if (existsSync(join(root, name))) return join(root, name)
  return undefined
}

export function findProjectRoot(start = process.cwd()): string {
  let dir = resolve(start)
  for (;;) {
    if (findRcPath(dir) || existsSync(join(dir, 'package.json'))) return dir
    const parent = dirname(dir)
    if (parent === dir) return resolve(start)
    dir = parent
  }
}

export function readRcInfo(rcPath: string | undefined): RcInfo {
  const info: RcInfo = {
    packages: [],
    providers: [],
    directories: {
      app: 'app',
      routes: 'app/routes',
      config: 'config',
      components: 'app/components',
      server: 'server',
      platforms: 'platforms',
      stubs: 'stubs',
    },
    platforms: {},
  }
  if (!rcPath || !existsSync(rcPath)) return info
  const src = stripComments(readFileSync(rcPath, 'utf8'))
  const providersBlock = arrayBlock(src, 'providers')
  info.providers = [...providersBlock.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map(
    (m) => m[1]!,
  )
  const packagesBlock = arrayBlock(src, 'packages')
  info.packages = [...packagesBlock.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]!)
  const dirs = src.match(/directories\s*:\s*\{([\s\S]*?)\}/)?.[1] ?? ''
  for (const m of dirs.matchAll(/(\w+)\s*:\s*['"]([^'"]+)['"]/g)) info.directories[m[1]!] = m[2]!
  info.platforms = readRcPlatforms(src)
  return info
}

/** Static read of the `platforms` dictionary. Nothing is executed; `loadPlatforms()` does that. */
export function readRcPlatforms(src: string): Record<string, RcPlatform> {
  const out: Record<string, RcPlatform> = {}
  const imports = new Map<string, { source: string; imported: string }>()
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g))
    for (const name of m[1]!.split(',')) {
      const parts = name.trim().split(/\s+as\s+/)
      const imported = parts[0]!.trim()
      const local = (parts[1] ?? parts[0])!.trim()
      if (local) imports.set(local, { source: m[2]!, imported })
    }
  const start = src.search(/platforms\s*:\s*\{/)
  if (start < 0) return out
  const open = src.indexOf('{', start)
  let depth = 0
  let end = open
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}' && --depth === 0) {
      end = i
      break
    }
  }
  const block = src.slice(open + 1, end)
  const entry = /(\w+)\s*:\s*(\w+)\s*\(/g
  for (let m = entry.exec(block); m; m = entry.exec(block)) {
    const name = m[1]!
    const factory = m[2]!
    const argStart = m.index + m[0].length
    let d = 1
    let i = argStart
    for (; i < block.length && d > 0; i++) {
      if (block[i] === '(') d++
      else if (block[i] === ')') d--
    }
    const arg = block.slice(argStart, i - 1).trim()
    let options: Record<string, unknown> | undefined
    if (arg) {
      try {
        options = new Function(`return (${arg})`)()
      } catch {}
    }
    const from = imports.get(factory)
    const renamed = from !== undefined && from.imported !== factory
    out[name] = {
      factory: from?.imported ?? factory,
      ...(renamed ? { local: factory } : {}),
      source: from?.source,
      options,
    }
    entry.lastIndex = i
  }
  return out
}

export function createContext(
  options: { root?: string; dryRun?: boolean; verbose?: boolean; pm?: PackageManager } = {},
): ProjectContext {
  const root = options.root ? resolve(options.root) : findProjectRoot()
  const pkgPath = join(root, 'package.json')
  const pkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, 'utf8')) : {}
  const touched = new Set<string>()
  const ctx: ProjectContext = {
    root,
    pm: options.pm ?? detectPackageManager(root),
    rcPath: findRcPath(root),
    pkg,
    dryRun: options.dryRun ?? false,
    verbose: options.verbose ?? false,
    touched,
    log,
    kitrVersion: cliVersion(),
    path: (...parts) => join(root, ...parts),
    exists: (...parts) => existsSync(join(root, ...parts)),
    read: (...parts) => readFileSync(join(root, ...parts), 'utf8'),
    write(path, content, { overwrite = false } = {}) {
      const full = resolve(root, path)
      const rel = relative(root, full).split('\\').join('/')
      if (existsSync(full) && !overwrite) {
        if (ctx.verbose) log.step(`skip ${rel} (exists)`)
        return false
      }
      if (ctx.dryRun) {
        log.step(`would write ${rel}`)
        return true
      }
      mkdirSync(dirname(full), { recursive: true })
      writeFileSync(full, content)
      touched.add(rel)
      log.step(`${existsSync(full) ? 'write' : 'create'} ${rel}`)
      return true
    },
    readRc: () => readRcInfo(ctx.rcPath ?? findRcPath(root)),
    isServerOnly() {
      const deps = { ...ctx.pkg.dependencies, ...ctx.pkg.devDependencies }
      const rc = ctx.readRc()
      return (
        !('react' in deps) &&
        // Installed from a registry, every package is added to package.json before any setup
        // module runs, so @kitr/react can be there before `react` is in kitrrc.ts.
        !('@kitr/react' in deps) &&
        !rc.packages.includes('@kitr/react') &&
        ('@kitr/server' in deps || rc.packages.includes('@kitr/server'))
      )
    },
  }
  return ctx
}

/** A binary in the project's node_modules/.bin. On Windows the runnable shim is `<name>.cmd`. */
export function projectBin(root: string, name: string): string {
  return join(root, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name)
}

function cliVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    return pkg.version
  } catch {
    return '0.0.0'
  }
}

/** Source without comments, so a commented-out provider is not loaded. Strings are kept intact. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\/|(['"`])(?:\\.|(?!\1)[^\\\n])*\1|\/\/[^\n]*/g, (m, quote) =>
    quote ? m : '',
  )
}

/** The text inside `key: [ ... ]`, with nested brackets balanced (one line or many). */
function arrayBlock(src: string, key: string): string {
  const start = new RegExp(`\\b${key}\\s*:\\s*\\[`).exec(src)
  if (!start) return ''
  let depth = 1
  let i = start.index + start[0].length
  const from = i
  for (; i < src.length && depth > 0; i++) {
    if (src[i] === '[') depth++
    else if (src[i] === ']') depth--
  }
  return src.slice(from, i - 1)
}
