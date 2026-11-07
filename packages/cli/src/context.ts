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
}

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
      stubs: 'stubs',
    },
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
  return info
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
      const rel = relative(root, full)
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
      return (
        !('react' in deps) &&
        ('@kitr/server' in deps || ctx.readRc().packages.includes('@kitr/server'))
      )
    },
  }
  return ctx
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
