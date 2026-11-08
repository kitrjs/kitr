import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { defineCommand } from 'citty'
import pc from 'picocolors'
import { createContext, findRcPath, log, readRcInfo } from './context'

/**
 * Monorepo mode. A `kitr.workspace.ts` at the repository root names the apps; every app is a
 * complete kitr project beneath it. The CLI reads the file statically (no execution), the same
 * way it reads `kitrrc.ts`.
 */

export interface WorkspaceInfo {
  /** The directory holding `kitr.workspace.ts`. */
  root: string
  path: string
  /** App name → absolute directory. */
  apps: Record<string, string>
}

const WORKSPACE_FILES = [
  'kitr.workspace.ts',
  'kitr.workspace.mts',
  'kitr.workspace.js',
  'kitr.workspace.mjs',
]

/** The nearest `kitr.workspace.*` at or above `start`, or undefined. */
export function findWorkspacePath(start = process.cwd()): string | undefined {
  let dir = resolve(start)
  for (;;) {
    for (const name of WORKSPACE_FILES) if (existsSync(join(dir, name))) return join(dir, name)
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

/** Read the apps from the workspace file's source: `apps: { web: 'apps/web', ... }`. */
export function readWorkspace(path: string): WorkspaceInfo {
  const root = dirname(path)
  const src = readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
  const block = src.match(/apps\s*:\s*\{([\s\S]*?)\}/)?.[1] ?? ''
  const apps: Record<string, string> = {}
  for (const m of block.matchAll(/['"]?([\w-]+)['"]?\s*:\s*['"]([^'"]+)['"]/g))
    apps[m[1]!] = resolve(root, m[2]!)
  return { root, path, apps }
}

/** The workspace around `start`, when there is one. */
export function findWorkspace(start = process.cwd()): WorkspaceInfo | undefined {
  const path = findWorkspacePath(start)
  return path ? readWorkspace(path) : undefined
}

/**
 * Pull `--app <name>` (or `--app=<name>`, or `KITR_APP`) out of the arguments. Returns the app
 * and the arguments without the flag, so every command stays unaware of workspaces.
 */
export function takeAppFlag(argv: string[]): { app: string | undefined; argv: string[] } {
  const out: string[] = []
  let app = process.env.KITR_APP || undefined
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === '--app') {
      app = argv[++i]
      if (!app) throw new Error('--app needs an app name from kitr.workspace.ts')
      continue
    }
    if (arg.startsWith('--app=')) {
      app = arg.slice('--app='.length)
      continue
    }
    out.push(arg)
  }
  return { app, argv: out }
}

/** The app directory for `--app`, or an error that lists the apps. */
export function resolveApp(workspace: WorkspaceInfo | undefined, app: string): string {
  if (!workspace) throw new Error(`--app ${app}: no kitr.workspace.ts found above ${process.cwd()}`)
  const dir = workspace.apps[app]
  if (!dir)
    throw new Error(
      `No app "${app}" in ${workspace.path} (apps: ${Object.keys(workspace.apps).join(', ') || 'none'})`,
    )
  return dir
}

/** Commands that run in every app when typed at the workspace root. */
export const FAN_OUT_COMMANDS = new Set([
  'dev',
  'build',
  'start',
  'serve',
  'types',
  'doctor',
  'platforms',
  'info',
])
/** Of those, the ones that keep running and so run side by side. */
const CONCURRENT = new Set(['dev', 'start', 'serve'])

/**
 * Whether a command typed here should fan out: the words name a fan-out command, the current
 * directory is not itself a kitr project, and a workspace is found above it.
 */
export function shouldFanOut(argv: string[], cwd = process.cwd()): WorkspaceInfo | undefined {
  const first = argv[0]
  if (!first || !FAN_OUT_COMMANDS.has(first)) return undefined
  if (argv.includes('--help') || argv.includes('-h')) return undefined
  if (findRcPath(cwd)) return undefined
  const workspace = findWorkspace(cwd)
  if (!workspace || !Object.keys(workspace.apps).length) return undefined
  return workspace
}

/**
 * Run the same command in each app: side by side for `dev`/`start`, one after another otherwise.
 * `kitr build phone` from the root builds the app named `phone` when no platform has that name,
 * so app names work as positional selectors too.
 */
export async function fanOut(
  workspace: WorkspaceInfo,
  argv: string[],
  options: { run?: (dir: string, name: string, args: string[]) => Promise<void> } = {},
): Promise<void> {
  const [command, ...rest] = argv
  const appNames = Object.keys(workspace.apps)
  const selected = rest.filter((w) => !w.startsWith('-') && appNames.includes(w))
  const targets = selected.length ? selected : appNames
  const args = [command!, ...rest.filter((w) => !selected.includes(w))]
  const run = options.run ?? runCli
  if (CONCURRENT.has(command!)) {
    log.title(`${command} in ${targets.join(', ')}`)
    await Promise.all(targets.map((name) => run(workspace.apps[name]!, name, args)))
    return
  }
  for (const name of targets) {
    log.title(`${pc.bold(name)} · kitr ${args.join(' ')}`)
    await run(workspace.apps[name]!, name, args)
  }
}

function runCli(dir: string, name: string, args: string[]): Promise<void> {
  const script = process.argv[1]
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, script ? [script, ...args] : args, {
      cwd: dir,
      stdio: 'inherit',
      env: { ...process.env, KITR_APP: name },
    })
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (code === 0 || signal) resolveRun()
      else reject(new Error(`${name}: kitr ${args.join(' ')} exited with code ${code}`))
    })
  })
}

export const workspaceCommand = defineCommand({
  meta: {
    name: 'workspace',
    description:
      'List the apps of kitr.workspace.ts with their platforms. From the root, `kitr dev|build|start|types|doctor` run in every app and `--app <name>` targets one.',
  },
  args: { json: { type: 'boolean', default: false } },
  run({ args }) {
    const workspace = findWorkspace()
    if (!workspace) {
      log.info(
        'No kitr.workspace.ts found. Create one at the repository root: export default defineWorkspace({ apps: { web: "apps/web" } })',
      )
      return
    }
    const rows = Object.entries(workspace.apps).map(([name, dir]) => {
      const rcPath = findRcPath(dir)
      const rc = readRcInfo(rcPath)
      return {
        name,
        dir,
        exists: !!rcPath,
        platforms: Object.fromEntries(Object.entries(rc.platforms).map(([n, p]) => [n, p.factory])),
        packages: rc.packages,
      }
    })
    if (args.json) {
      console.log(JSON.stringify({ root: workspace.root, apps: rows }, null, 2))
      return
    }
    log.title(`Workspace ${workspace.root}`)
    for (const row of rows) {
      const platforms = Object.entries(row.platforms)
        .map(([n, t]) => `${n}:${t}`)
        .join(' ')
      log.plain(
        `  ${pc.bold(row.name.padEnd(12))} ${row.dir.replace(`${workspace.root}/`, '').padEnd(20)} ${
          row.exists ? pc.dim(platforms || 'no platforms') : pc.yellow('no kitrrc.ts')
        }`,
      )
    }
    log.plain(pc.dim('\n  kitr dev · kitr build <app> · kitr --app <app> add jobs'))
  },
})

/** `createContext()` for an app of the workspace (used by commands that take `--app`). */
export function appContext(dir: string) {
  return createContext({ root: dir })
}
