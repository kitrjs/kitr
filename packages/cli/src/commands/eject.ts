import type { Generator } from '@kitr/core/package'
import { defineCommand } from 'citty'
import { createContext } from '../context'
import { installedPackages } from '../packages'
import { coreGenerators, packageGeneratorList } from './make'

/**
 * Eject is deliberately small. kitr ships no runtime magic to eject: `@kitr/*` packages
 * re-export upstream libraries unchanged, so leaving kitr is "replace imports", and each
 * package says what replaces it. What you can eject are the generator stubs (to customise
 * `make:*`) and the providers (to wire the libraries by hand).
 */
export const eject = defineCommand({
  meta: {
    name: 'eject',
    description:
      'Copy generator stubs into stubs/ (customise make:*), or print the import rewrites that leave kitr entirely.',
  },
  args: {
    what: { type: 'positional', description: 'stub <name> | stubs | all', required: true },
    name: { type: 'positional', required: false },
    force: { type: 'boolean', default: false },
  },
  async run({ args }) {
    const ctx = createContext()
    const dir = ctx.readRc().directories.stubs ?? 'stubs'
    const generators: Record<string, Generator> = { ...coreGenerators }
    for (const { kind, generator } of await packageGeneratorList(ctx)) generators[kind] = generator
    const writeStub = (name: string) => {
      const generator = generators[name]
      if (!generator)
        return ctx.log.error(
          `Unknown stub "${name}". Known: ${Object.keys(generators).join(', ')} (packages add theirs once added)`,
        )
      const body = `/** Ejected kitr stub for \`kitr make:${name}\`. Receives the template vars and returns the file source. */\nexport default ${generator.stub.toString()}\n`
      ctx.write(`${dir}/${name}.ts`, body, { overwrite: args.force })
    }
    if (args.what === 'stub') {
      if (!args.name) return ctx.log.error('Usage: kitr eject stub <name>')
      writeStub(args.name)
    } else if (args.what === 'stubs') {
      for (const name of Object.keys(generators)) writeStub(name)
    } else if (args.what === 'all') {
      for (const name of Object.keys(generators)) writeStub(name)
      ctx.log.title('Leaving kitr altogether')
      ctx.log.plain(
        'kitr adds nothing at runtime that you cannot replace with the upstream library. Rewrite imports:',
      )
      const rewrites: Record<string, string> = {}
      for (const loaded of await installedPackages(ctx))
        Object.assign(rewrites, loaded.definition.eject)
      if (!Object.keys(rewrites).length)
        ctx.log.plain('  (no package in kitrrc.ts declares a rewrite)')
      for (const [from, to] of Object.entries(rewrites))
        ctx.log.plain(`  ${from.padEnd(18)} → ${to}`)
      ctx.log.plain(
        'Then inline the providers from kitrrc.ts into your own bootstrap and delete kitrrc.ts, config/, and the `kitr` dependency.',
      )
    } else ctx.log.error(`Unknown target "${args.what}". Use: stub <name> | stubs | all`)
    ctx.log.success(`Stubs in ${dir}/ override the built-in ones for make:*`)
  },
})
