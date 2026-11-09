import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import type { AppGenerateStep } from '@kitr/core'
import { log, type ProjectContext } from './context'
import { installedPackages } from './packages'
import { loadGenerators, runTypes, type TypesRunResult } from './types'

/**
 * `kitr generate`: every generator in one run. The type generators write `.kitr/`; a package
 * that also writes files elsewhere (`@kitr/api` writes `routes.gen.ts` and `openapi.json`)
 * declares `generate: { command }` in its setup module and `kitr generate` runs that command of
 * its own. The CLI knows no package by name, so a community package gets the same hook. The app
 * adds its own steps in `kitrrc.ts` (`generate: [{ name, run, watch }]`); they run last.
 */

/** One generate step, declared by a package or by the app in `kitrrc.ts`. */
export interface GenerateStep {
  /** Full npm name of the package that declared it; `app` for a step from `kitrrc.ts`. */
  package: string
  /** The package's command, e.g. `api:sync`; the step's `name` for an app step. */
  command: string
  /** What the step runs, for `kitr doctor`: the shell command, or `a function` for an app step. */
  describe?: string
  /** Globs (relative to the root) whose change re-runs it under `--watch`. */
  watch: string[]
  run(options?: { quiet?: boolean }): Promise<void>
}

export interface GenerateRunResult {
  types: TypesRunResult
  /** The package steps that ran, as `package:command`. */
  steps: string[]
  /** Steps that failed, with the message; empty on success. */
  failed: Array<{ step: string; message: string }>
}

type RunnableCommand = {
  meta?: { name?: string } | Promise<{ name?: string }>
  run?: (context: { args: Record<string, unknown>; rawArgs: string[]; cmd: unknown }) => unknown
}

/** The generate steps the project's packages declare, in kitrrc.ts order, then the app's own. */
export async function loadGenerateSteps(ctx: ProjectContext): Promise<GenerateStep[]> {
  const steps: GenerateStep[] = []
  for (const loaded of await installedPackages(ctx)) {
    const spec = loaded.definition.generate
    if (!spec || !loaded.definition.commands) continue
    const commands = loaded.definition.commands
    steps.push({
      package: loaded.package,
      command: spec.command,
      watch: spec.watch ?? [],
      async run() {
        const mod = (await commands()) as Record<string, unknown>
        const table = (
          mod.default && typeof mod.default === 'object' && !(mod.default as RunnableCommand).meta
            ? mod.default
            : mod
        ) as Record<string, RunnableCommand>
        let command: RunnableCommand | undefined
        for (const [key, candidate] of Object.entries(table)) {
          const meta = await candidate?.meta
          if ((meta?.name ?? key) === spec.command) command = candidate
        }
        if (!command?.run)
          throw new Error(
            `${loaded.package} declares generate "${spec.command}" but has no such command`,
          )
        // The package commands read the project from the working directory.
        const cwd = process.cwd()
        if (cwd !== ctx.root) process.chdir(ctx.root)
        try {
          await command.run({ args: {}, rawArgs: [], cmd: command })
        } finally {
          if (cwd !== ctx.root) process.chdir(cwd)
        }
      },
    })
  }
  for (const entry of await loadAppSteps(ctx)) steps.push(appStep(ctx, entry))
  return steps
}

/**
 * `generate` from kitrrc.ts. The file is executed only when it mentions `generate:`, so a project
 * without app steps pays nothing for them.
 */
export async function loadAppSteps(ctx: ProjectContext): Promise<AppGenerateStep[]> {
  if (!ctx.rcPath || !/\bgenerate\s*:/.test(readFileSync(ctx.rcPath, 'utf8'))) return []
  const { projectJiti } = await import('./platforms')
  const mod = (await (await projectJiti(ctx)).import(ctx.rcPath)) as Record<string, any>
  const list: unknown = (mod.default ?? mod).generate
  if (list === undefined) return []
  if (!Array.isArray(list)) throw new Error('kitrrc.ts: `generate` must be a list of steps')
  return list.map((entry, index) => {
    const step = entry as Partial<AppGenerateStep>
    if (
      !step ||
      typeof step.name !== 'string' ||
      (typeof step.run !== 'string' && typeof step.run !== 'function')
    )
      throw new Error(
        `kitrrc.ts: generate[${index}] needs a \`name\` and a \`run\` (a shell command or a function), e.g. { name: 'content', run: 'node scripts/content.mjs' }`,
      )
    return step as AppGenerateStep
  })
}

/** An app step as a `GenerateStep`: a shell command from the root, or a function. */
function appStep(ctx: ProjectContext, entry: AppGenerateStep): GenerateStep {
  return {
    package: 'app',
    command: entry.name,
    watch: entry.watch ?? [],
    describe: typeof entry.run === 'string' ? entry.run : 'a function',
    async run(options: { quiet?: boolean } = {}) {
      if (typeof entry.run === 'string') return runShell(ctx, entry.run, options.quiet)
      const cwd = process.cwd()
      if (cwd !== ctx.root) process.chdir(ctx.root)
      try {
        const out = (await entry.run()) as { default?: unknown } | undefined
        // `() => import('./scripts/content')`: call the module's default export when it is a function.
        if (out && typeof out === 'object' && typeof out.default === 'function')
          await (out.default as () => unknown)()
      } finally {
        if (cwd !== ctx.root) process.chdir(cwd)
      }
    },
  }
}

/** Run a step's shell command from the project root. Quiet keeps the output unless it fails. */
function runShell(ctx: ProjectContext, command: string, quiet = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd: ctx.root,
      shell: true,
      stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      env: { ...process.env, KITR_GENERATE: '1' },
    })
    let output = ''
    child.stdout?.on('data', (chunk) => {
      output += chunk
    })
    child.stderr?.on('data', (chunk) => {
      output += chunk
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) return resolve()
      const tail = output.trim().split('\n').slice(-20).join('\n')
      reject(new Error(`\`${command}\` exited with code ${code}${tail ? `\n${tail}` : ''}`))
    })
  })
}

export interface GenerateOptions {
  /** Report stale type files instead of writing; package and app steps are skipped (they only write). */
  check?: boolean
  quiet?: boolean
  /** Throw when a package step fails (default); false collects it in `failed` so `dev` can warn and carry on. */
  strict?: boolean
}

/** Run the type generators, then every package step, then the app's own steps from kitrrc.ts. */
export async function runGenerate(
  ctx: ProjectContext,
  options: GenerateOptions = {},
): Promise<GenerateRunResult> {
  const generators = await loadGenerators(ctx)
  const types = await runTypes(ctx, { check: options.check, quiet: options.quiet }, generators)
  const result: GenerateRunResult = { types, steps: [], failed: [] }
  if (options.check) return result
  for (const step of await loadGenerateSteps(ctx)) {
    const name = `${step.package}:${step.command}`
    try {
      await step.run({ quiet: options.quiet })
      result.steps.push(name)
    } catch (error) {
      const message = (error as Error).message
      if (options.strict !== false)
        throw new Error(`kitr generate: ${name} failed: ${message}`, { cause: error })
      result.failed.push({ step: name, message })
      log.warn(`kitr generate: ${name} failed: ${message}`)
    }
  }
  return result
}
