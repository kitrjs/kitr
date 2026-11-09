import { spawn } from 'node:child_process'
import { existsSync, watch } from 'node:fs'
import { globToRegExp } from '@kitr/core'
import { defineCommand } from 'citty'
import { createContext } from '../context'
import { loadGenerateSteps, runGenerate } from '../generate'
import { GENERATED_DIR, generatorsFor, loadGenerators, runTypes } from '../types'

export const generate = defineCommand({
  meta: {
    name: 'generate',
    description:
      "Run every generator: the types under .kitr/, each package's own (the route table and openapi.json for @kitr/api), then the app's `generate` steps from kitrrc.ts. `kitr dev`, `kitr build` and `kitr typecheck` run it first.",
  },
  args: {
    check: {
      type: 'boolean',
      description:
        'Fail if a generated type file is stale instead of writing; package and app steps are skipped',
      default: false,
    },
    quiet: {
      type: 'boolean',
      description: "Print only failures; app steps' output is shown only when they fail",
      default: false,
    },
    watch: {
      type: 'boolean',
      description: 'Keep running and regenerate on change',
      default: false,
    },
  },
  async run({ args }) {
    const ctx = createContext()
    const result = await runGenerate(ctx, { check: args.check, quiet: args.quiet })
    if (args.check) {
      for (const file of result.types.stale) ctx.log.warn(`stale: ${file}`)
      if (result.types.stale.length) {
        ctx.log.error(
          `${result.types.stale.length} generated file(s) are stale. Run: kitr generate`,
        )
        process.exitCode = 1
      } else
        ctx.log.success(`${GENERATED_DIR}/ is up to date (${result.types.generators.join(', ')})`)
      return
    }
    if (!args.quiet)
      ctx.log.success(
        `generated ${result.types.written.length} type file(s) (${result.types.generators.join(', ')})${result.steps.length ? `, ran ${result.steps.join(', ')}` : ''}`,
      )
    if (!args.watch) return
    ctx.log.info('watching for changes (ctrl-c to stop)')
    const generators = await loadGenerators(ctx)
    const steps = await loadGenerateSteps(ctx)
    const rc = ctx.readRc()
    const pendingTypes = new Set<string>()
    const pendingSteps = new Set<(typeof steps)[number]>()
    let timer: NodeJS.Timeout | undefined
    watch(ctx.root, { recursive: true }, (_event, filename) => {
      if (!filename) return
      const file = String(filename).split('\\').join('/')
      if (file.startsWith(`${GENERATED_DIR}/`) || file.includes('node_modules/')) return
      for (const g of generatorsFor(generators, rc, file)) pendingTypes.add(g.name)
      for (const step of steps)
        if (step.watch.some((glob) => globToRegExp(glob).test(file))) pendingSteps.add(step)
      if (!pendingTypes.size && !pendingSteps.size) return
      clearTimeout(timer)
      timer = setTimeout(async () => {
        const only = [...pendingTypes]
        const due = [...pendingSteps]
        pendingTypes.clear()
        pendingSteps.clear()
        try {
          if (only.length) await runTypes(ctx, { only, quiet: true }, generators)
          for (const step of due) await step.run({ quiet: args.quiet })
        } catch (error) {
          ctx.log.error((error as Error).message)
        }
      }, 50)
    })
    await new Promise(() => {})
  },
})

/** `kitr typecheck`: generate, then `tsc --noEmit`. What the kits' `typecheck` script runs. */
export const typecheck = defineCommand({
  meta: {
    name: 'typecheck',
    description:
      'Run `kitr generate`, then `tsc --noEmit`, so the check never sees stale generated files.',
  },
  args: {
    project: { type: 'string', description: 'tsconfig to check (default: tsconfig.json)' },
  },
  async run({ args }) {
    const ctx = createContext()
    await runGenerate(ctx, { quiet: true })
    const bin = ctx.path('node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc')
    const command = existsSync(bin) ? bin : 'tsc'
    const tscArgs = ['--noEmit', ...(args.project ? ['-p', args.project] : [])]
    const code = await new Promise<number | null>((resolve, reject) => {
      const child = spawn(command, tscArgs, {
        cwd: ctx.root,
        stdio: 'inherit',
        shell: process.platform === 'win32',
      })
      child.on('error', reject)
      child.on('exit', resolve)
    })
    if (code !== 0) process.exitCode = code ?? 1
  },
})
