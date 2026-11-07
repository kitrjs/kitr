import type { Question } from '@kitr/core/package'
import { createAddContext, createProjectInfo } from './add-context'
import type { Codemods } from './codemods'
import type { ProjectContext } from './context'
import { type PlanStep, resolvePlan } from './plan'
import { resolveAnswers } from './questions'

/** The questions a package asks right now, as a list. */
export async function questionsOf(step: PlanStep, ctx: ProjectContext): Promise<Question[]> {
  const q = step.loaded?.definition.questions
  if (!q) return []
  return typeof q === 'function' ? await q(createProjectInfo(ctx)) : q
}

/**
 * Configure a list of packages into the project: setup modules get their questions answered
 * and `add(ctx)` run; legacy recipes run as before. Shared by `kitr add` and `kitr new`.
 */
export async function configurePackages(
  ctx: ProjectContext,
  codemods: Codemods,
  names: string[],
  options: {
    install: boolean
    flags?: Record<string, string | boolean>
    yes?: boolean
    added?: Set<string>
    /** Pre-filled answers per short name (kits). */
    answers?: Record<string, Record<string, string | boolean | string[] | undefined>>
    /** Log a line per package; default on. */
    report?: boolean
  },
): Promise<PlanStep[]> {
  const installed = ctx.readRc().packages
  const plan = await resolvePlan(ctx, names, installed, { install: options.install })
  const added = options.added ?? new Set<string>()
  const done: PlanStep[] = []
  for (const step of plan) {
    if (step.package && (installed.includes(step.package) || added.has(step.package))) {
      if (names.includes(step.name) && options.report !== false)
        ctx.log.info(`${step.name} is already added`)
      continue
    }
    if (step.client && createProjectInfo(ctx, codemods, added).isServerOnly) {
      ctx.log.warn(`${step.name} is a client package; this project is server-only. Skipping.`)
      continue
    }
    if (step.loaded) {
      const def = step.loaded.definition
      const questions = await questionsOf(step, ctx)
      const flags = { ...options.flags, ...(options.answers?.[step.name] as any) }
      const answers = await resolveAnswers(
        questions,
        flags,
        createProjectInfo(ctx, codemods, added),
        {
          yes: options.yes,
        },
      )
      codemods.installPackages([step.package!])
      codemods.addPackage(step.package!)
      await def.add?.(createAddContext(ctx, codemods, answers, added))
      added.add(step.package!)
    } else if (step.recipe) {
      await step.recipe.configure(ctx, codemods)
      if (step.package) added.add(step.package)
    }
    done.push(step)
    if (options.report !== false)
      ctx.log.success(
        `${step.name}${step.loaded ? '' : `: ${step.recipe?.description ?? ''}`}`.trimEnd(),
      )
  }
  return done
}
