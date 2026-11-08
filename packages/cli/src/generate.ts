import { log, type ProjectContext } from './context'
import { installedPackages } from './packages'
import { loadGenerators, runTypes, type TypesRunResult } from './types'

/**
 * `kitr generate`: every generator in one run. The type generators write `.kitr/`; a package
 * that also writes files elsewhere (`@kitr/api` writes `routes.gen.ts` and `openapi.json`)
 * declares `generate: { command }` in its setup module and `kitr generate` runs that command of
 * its own. The CLI knows no package by name, so a community package gets the same hook.
 */

/** One package-declared generate step. */
export interface GenerateStep {
  /** Full npm name of the package that declared it. */
  package: string
  /** The package's command, e.g. `api:sync`. */
  command: string
  /** Globs (relative to the root) whose change re-runs it under `--watch`. */
  watch: string[]
  run(): Promise<void>
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

/** The generate steps the project's packages declare, in kitrrc.ts order. */
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
  return steps
}

export interface GenerateOptions {
  /** Report stale type files instead of writing; package steps are skipped (they only write). */
  check?: boolean
  quiet?: boolean
  /** Throw when a package step fails (default); false collects it in `failed` so `dev` can warn and carry on. */
  strict?: boolean
}

/** Run the type generators, then every package step. */
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
      await step.run()
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
