import { watch } from 'node:fs'
import { defineCommand } from 'citty'
import { createContext } from '../context'
import { GENERATED_DIR, generatorsFor, loadGenerators, runTypes } from '../types'

export const types = defineCommand({
  meta: {
    name: 'types',
    description:
      'Write the generated types under .kitr/ (operation names, platform names, and whatever your packages declare). Runs before `kitr dev` and `kitr build`.',
  },
  args: {
    check: {
      type: 'boolean',
      description: 'Fail if any generated file is stale instead of writing',
      default: false,
    },
    watch: {
      type: 'boolean',
      description: 'Keep running and regenerate on change',
      default: false,
    },
    only: { type: 'string', description: 'Run one generator by name' },
  },
  async run({ args }) {
    const ctx = createContext()
    const generators = await loadGenerators(ctx)
    const only = args.only ? [args.only] : undefined
    if (only && !generators.some((g) => only.includes(g.name)))
      throw new Error(
        `No generator named "${args.only}". Generators: ${generators.map((g) => g.name).join(', ')}`,
      )
    const result = await runTypes(ctx, { check: args.check, only }, generators)
    if (args.check) {
      for (const file of result.stale) ctx.log.warn(`stale: ${file}`)
      if (result.stale.length) {
        ctx.log.error(`${result.stale.length} generated file(s) are stale. Run: kitr types`)
        process.exitCode = 1
      } else ctx.log.success(`${GENERATED_DIR}/ is up to date (${result.generators.join(', ')})`)
      return
    }
    ctx.log.success(
      `${result.written.length} file(s) written, ${result.unchanged.length} unchanged (${result.generators.join(', ')})`,
    )
    if (!args.watch) return
    ctx.log.info('watching for changes (ctrl-c to stop)')
    const pending = new Set<string>()
    let timer: NodeJS.Timeout | undefined
    const rc = ctx.readRc()
    watch(ctx.root, { recursive: true }, (_event, filename) => {
      if (!filename) return
      const file = String(filename).split('\\').join('/')
      if (file.startsWith(`${GENERATED_DIR}/`) || file.includes('node_modules/')) return
      const hit = generatorsFor(generators, rc, file)
      if (!hit.length) return
      for (const g of hit) pending.add(g.name)
      clearTimeout(timer)
      timer = setTimeout(async () => {
        const only = [...pending]
        pending.clear()
        try {
          await runTypes(ctx, { only }, generators)
        } catch (error) {
          ctx.log.error((error as Error).message)
        }
      }, 50)
    })
    await new Promise(() => {})
  },
})
