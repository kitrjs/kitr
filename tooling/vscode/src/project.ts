import { spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import * as vscode from 'vscode'
import { cliInvocation, detectPackageManager, type PackageManager, shellQuote } from './cli'

export interface RunResult {
  stdout: string
  stderr: string
  code: number
}

const windows = process.platform === 'win32'

/** One kitr project: the folder holding kitrrc.ts, and how to run its CLI. */
export class Project {
  readonly pm: PackageManager
  readonly cli: { command: string; args: string[] }
  private readonly terminals = new Map<string, vscode.Terminal>()

  constructor(
    readonly root: string,
    private readonly output: vscode.OutputChannel,
  ) {
    this.pm = findPackageManager(root)
    const configured = vscode.workspace.getConfiguration('kitr').get<string>('cliPath')?.trim()
    this.cli = cliInvocation({ configured, localBin: findLocalBin(root), pm: this.pm })
  }

  path(rel: string): string {
    return join(this.root, rel)
  }

  exists(rel: string): boolean {
    return existsSync(this.path(rel))
  }

  read(rel: string): string | undefined {
    try {
      return readFileSync(this.path(rel), 'utf8')
    } catch {
      return undefined
    }
  }

  /** The first candidate that exists, for the tree model. */
  find = (candidates: string[]): string | undefined => candidates.find((c) => this.exists(c))

  /** Run `kitr <args>` without a terminal and capture its output. Never rejects on exit codes. */
  run(args: string[], timeoutMs = 120_000): Promise<RunResult> {
    const all = [...this.cli.args, ...args]
    this.output.appendLine(`$ ${this.commandLine(args)}`)
    return new Promise((resolve) => {
      const child = spawn(this.cli.command, all, {
        cwd: this.root,
        shell: windows,
        env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', CI: '1' },
      })
      let stdout = ''
      let stderr = ''
      const timer = setTimeout(() => child.kill(), timeoutMs)
      child.stdout.on('data', (d: Buffer) => {
        stdout += d.toString()
      })
      child.stderr.on('data', (d: Buffer) => {
        stderr += d.toString()
      })
      child.on('error', (error) => {
        clearTimeout(timer)
        this.output.appendLine(String(error))
        resolve({ stdout, stderr: `${stderr}${error.message}`, code: -1 })
      })
      child.on('close', (code) => {
        clearTimeout(timer)
        if (stderr.trim()) this.output.appendLine(stderr.trimEnd())
        resolve({ stdout, stderr, code: code ?? -1 })
      })
    })
  }

  commandLine(args: string[]): string {
    return [this.cli.command, ...this.cli.args, ...args]
      .map((a) => shellQuote(a, windows))
      .join(' ')
  }

  /** Run `kitr <args>` in a named terminal, reusing it while it is open. */
  terminal(name: string, args: string[]): void {
    let term = this.terminals.get(name)
    if (!term || term.exitStatus !== undefined) {
      term = vscode.window.createTerminal({ name, cwd: this.root })
      this.terminals.set(name, term)
    }
    term.show()
    term.sendText(this.commandLine(args))
  }

  dispose(): void {
    this.terminals.clear()
  }
}

/** Walk up from `dir` (monorepos hoist the binary to the workspace root). */
function findLocalBin(dir: string): string | undefined {
  for (let d = dir; ; d = dirname(d)) {
    const bin = join(d, 'node_modules', '.bin', windows ? 'kitr.cmd' : 'kitr')
    if (existsSync(bin)) return bin
    if (dirname(d) === d) return undefined
  }
}

function findPackageManager(dir: string): PackageManager {
  const files: string[] = []
  let field: string | undefined
  for (let d = dir; ; d = dirname(d)) {
    try {
      files.push(...readdirSync(d))
    } catch {}
    if (existsSync(join(d, 'package.json')))
      try {
        field = JSON.parse(readFileSync(join(d, 'package.json'), 'utf8')).packageManager
      } catch {}
    if (field || dirname(d) === d || existsSync(join(d, '.git'))) break
  }
  return detectPackageManager(files, field)
}
