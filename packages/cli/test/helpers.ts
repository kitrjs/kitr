import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { vi } from 'vitest'
import { runMain } from '../src'

const repo = resolve(__dirname, '../../..')
const dirs: string[] = []

/** Remove every project made by `copyExample` and `project`. */
export function cleanup() {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
}

/** A scratch copy of an example with its installed node_modules linked in, as `kitr` sees a user's project. */
export function copyExample(name: string): string {
  const source = join(repo, 'examples', name)
  const dir = mkdtempSync(join(tmpdir(), `kitr-cli-${name}-`))
  dirs.push(dir)
  cpSync(source, dir, {
    recursive: true,
    filter: (src) => {
      const rel = relative(source, src).split('\\').join('/')
      return !/^(node_modules|dist|\.output|\.tanstack|\.nitro|\.kitr)(\/|$)/.test(rel)
    },
  })
  symlinkSync(join(source, 'node_modules'), join(dir, 'node_modules'), 'junction')
  return dir
}

/** An empty scratch directory. */
export function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), 'kitr-cli-scratch-'))
  dirs.push(dir)
  return dir
}

export const read = (dir: string, file: string) => readFileSync(join(dir, file), 'utf8')
export const write = (dir: string, file: string, content: string) =>
  writeFileSync(join(dir, file), content)

export interface Run {
  /** Everything the command printed to stdout (console.log). */
  out: string
  /** Everything it printed to stderr (console.error), including the final error message. */
  err: string
  /** `process.exitCode` when it finished: 1 for a failed command. */
  code: number | undefined
}

/**
 * Run the kitr CLI in-process, from `cwd`, the way `kitr <args>` runs it: through `runMain`, so
 * errors are printed and set the exit code instead of throwing. Output is captured.
 */
export async function kitr(cwd: string, ...argv: string[]): Promise<Run> {
  const previous = process.cwd()
  const stdout: string[] = []
  const stderr: string[] = []
  // CI sets `CI`, which turns colours on; the assertions read plain text.
  const text = (args: unknown[]) =>
    args
      .map(String)
      .join(' ')
      .replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g'), '')
  const logs = [
    vi.spyOn(console, 'log').mockImplementation((...a) => void stdout.push(text(a))),
    vi.spyOn(console, 'info').mockImplementation((...a) => void stdout.push(text(a))),
    vi.spyOn(console, 'warn').mockImplementation((...a) => void stderr.push(text(a))),
    vi.spyOn(console, 'error').mockImplementation((...a) => void stderr.push(text(a))),
  ]
  const oldCode = process.exitCode
  process.exitCode = undefined
  process.chdir(cwd)
  try {
    await runMain(argv)
    return {
      out: stdout.join('\n'),
      err: stderr.join('\n'),
      code: process.exitCode as number | undefined,
    }
  } finally {
    process.chdir(previous)
    for (const spy of logs) spy.mockRestore()
    process.exitCode = oldCode
  }
}
