import { type ChildProcess, execFileSync, spawn } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  statSync,
  symlinkSync,
} from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = fileURLToPath(new URL('../..', import.meta.url))
export const kitrBin = join(root, 'packages/kitr/bin/kitr.mjs')

/** Run the kitr CLI in `cwd`; throws with stdout+stderr on a non-zero exit. */
export function kitr(cwd: string, ...args: string[]): string {
  try {
    return execFileSync(process.execPath, [kitrBin, ...args], {
      cwd,
      encoding: 'utf8',
      stdio: 'pipe',
      env: { ...process.env, CI: '1', NO_COLOR: '1', FORCE_COLOR: '0' },
    })
  } catch (error: any) {
    throw new Error(`kitr ${args.join(' ')} failed:\n${error.stdout ?? ''}\n${error.stderr ?? ''}`)
  }
}

export function run(cwd: string, cmd: string, args: string[], timeout = 180_000): string {
  try {
    // pnpm's Windows shims are .cmd files, which Node only runs through a shell.
    const shell = process.platform === 'win32' && cmd.endsWith('.cmd')
    return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: 'pipe', timeout, shell })
  } catch (error: any) {
    throw new Error(
      `${cmd} ${args.join(' ')} failed:\n${error.stdout ?? ''}\n${error.stderr ?? ''}`,
    )
  }
}

/** Binary from the workspace root node_modules/.bin (tsc, vite...). */
export const bin = (name: string) =>
  join(root, 'node_modules/.bin', process.platform === 'win32' ? `${name}.cmd` : name)

/**
 * A scratch copy of an example with its installed node_modules symlinked in, so generated
 * code can be typechecked and built without a fresh install.
 */
export function copyExample(name: string): string {
  const source = join(root, 'examples', name)
  const dir = mkdtempSync(join(tmpdir(), `kitr-${name}-`))
  cpSync(source, dir, {
    recursive: true,
    filter: (src) => {
      const rel = relative(source, src).split('\\').join('/')
      return !/^(node_modules|dist|\.output|\.tanstack|\.nitro)(\/|$)/.test(rel)
    },
  })
  // 'junction' needs no privilege on Windows and means 'dir' elsewhere.
  symlinkSync(join(source, 'node_modules'), join(dir, 'node_modules'), 'junction')
  // Examples drop the kit's biome.json (the repo root config applies); restore it so the CLI's
  // formatting pass sees the same config a fresh project has.
  const kit = mkdtempSync(join(tmpdir(), 'kitr-kit-'))
  kitr(kit, 'new', 'p', '--kit', 'blank', '--no-install', '--no-git')
  cpSync(join(kit, 'p', 'biome.json'), join(dir, 'biome.json'))
  remove(kit)
  return dir
}

/**
 * Install workspace `@kitr/*` packages into a copied example without touching the example: its
 * linked node_modules becomes a folder of links to the example's entries, plus the new packages.
 */
export function linkPackages(dir: string, names: string[]) {
  const modules = join(dir, 'node_modules')
  const source = readlinkSync(modules)
  rmSync(modules)
  mkdirSync(join(modules, '@kitr'), { recursive: true })
  for (const name of readdirSync(source)) {
    if (name === '@kitr') continue
    symlinkSync(join(source, name), join(modules, name))
  }
  for (const name of readdirSync(join(source, '@kitr')))
    symlinkSync(join(source, '@kitr', name), join(modules, '@kitr', name))
  for (const name of names)
    if (!existsSync(join(modules, '@kitr', name)))
      symlinkSync(join(root, 'packages', name), join(modules, '@kitr', name), 'dir')
}

export function remove(dir: string) {
  rmSync(dir, { recursive: true, force: true })
}

/** Every file under `dir` (minus node_modules) with its contents. */
export function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      if (name === 'node_modules' || name === 'dist') continue
      const p = join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else out[relative(dir, p)] = readFileSync(p, 'utf8')
    }
  }
  walk(dir)
  return out
}

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, () => {
      const { port } = srv.address() as { port: number }
      srv.close(() => resolve(port))
    })
  })
}

/** Start a long-running process and wait until `url` answers. */
export async function startProcess(
  cwd: string,
  cmd: string,
  args: string[],
  url: string,
  env: Record<string, string> = {},
  timeoutMs = 60_000,
): Promise<{ proc: ChildProcess; output: () => string; stop: () => Promise<void> }> {
  let output = ''
  const proc = spawn(cmd, args, {
    cwd,
    env: { ...process.env, NO_COLOR: '1', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  proc.stdout?.on('data', (d) => (output += d))
  proc.stderr?.on('data', (d) => (output += d))
  const stop = () =>
    new Promise<void>((resolve) => {
      if (proc.exitCode !== null) return resolve()
      proc.once('exit', () => resolve())
      proc.kill('SIGTERM')
      setTimeout(() => proc.kill('SIGKILL'), 5000).unref()
    })
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) throw new Error(`${cmd} exited early:\n${output}`)
    try {
      await fetch(url)
      return { proc, output: () => output, stop }
    } catch {
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  await stop()
  throw new Error(`${url} did not answer within ${timeoutMs}ms:\n${output}`)
}

export const exists = (dir: string, file: string) => existsSync(join(dir, file))
